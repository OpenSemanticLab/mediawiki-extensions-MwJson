<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\Mw\GuardedCategories;
use MediaWiki\Extension\MwJson\OOLD\JsonLoader;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWikiUnitTestCase;

/**
 * @covers \MediaWiki\Extension\MwJson\Mw\GuardedCategories
 */
class GuardedCategoriesTest extends MediaWikiUnitTestCase {

	private const GUARD = [ 'Category:Device' => 'mwjson-editdevice' ];

	/**
	 * A small class tree:
	 *
	 *   Category:Item
	 *     Category:Device        <- guarded
	 *       Category:Laptop
	 *         Category:Ultrabook
	 *     Category:Book          <- not guarded
	 */
	private function newLoader(): JsonLoader {
		return new class implements JsonLoader {
			public array $reads = [];

			private const SCHEMAS = [
				'Category:Item' => [],
				'Category:Device' => [ 'allOf' => [ [ '$ref' => '/wiki/Category:Item?action=raw&slot=jsonschema' ] ] ],
				'Category:Laptop' => [ 'allOf' => [ [ '$ref' => '/wiki/Category:Device?action=raw&slot=jsonschema' ] ] ],
				'Category:Ultrabook' => [ 'allOf' => [ [ '$ref' => '/wiki/Category:Laptop?action=raw&slot=jsonschema' ] ] ],
				'Category:Book' => [ 'allOf' => [ [ '$ref' => '/wiki/Category:Item?action=raw&slot=jsonschema' ] ] ],
				// A cycle, to prove the walk terminates.
				'Category:Ouroboros' => [ 'allOf' => [ [ '$ref' => '/wiki/Category:Ouroboros?action=raw&slot=jsonschema' ] ] ],
			];

			public function load( string $pageTitle, ?string $slot = null ): array {
				$this->reads[] = $pageTitle;
				return self::SCHEMAS[$pageTitle] ?? [];
			}
		};
	}

	private function newGuard( array $map = self::GUARD ): GuardedCategories {
		return new GuardedCategories( $map, $this->newLoader() );
	}

	public function testAnEmptyMapReadsNothing() {
		$loader = $this->newLoader();
		$guard = new GuardedCategories( [], $loader );

		$this->assertTrue( $guard->isEmpty() );
		$this->assertSame( [], $guard->rightsForData( [ 'type' => [ 'Category:Device' ] ] ) );
		$this->assertSame( [], $guard->rightsForCategory( 'Category:Device' ) );

		// The point of the short circuit: getUserPermissionsErrors runs on every
		// read of every title, so the default configuration must not touch a slot.
		$this->assertSame( [], $loader->reads );
	}

	public function testDirectInstanceIsGuarded() {
		$this->assertSame(
			[ 'mwjson-editdevice' ],
			$this->newGuard()->rightsForData( [ 'type' => [ 'Category:Device' ] ] )
		);
	}

	public function testInstanceOfASubclassIsGuarded() {
		// The bypass the instance root exists to close: declare a subclass of
		// the guarded category and instantiate that instead.
		$this->assertSame(
			[ 'mwjson-editdevice' ],
			$this->newGuard()->rightsForData( [ 'type' => [ 'Category:Ultrabook' ] ] )
		);
	}

	public function testSubclassOfAGuardedCategoryIsGuarded() {
		// The bypass the subclass root exists to close: a category's own type is
		// Category:Category, so it never reaches Device on the instance path.
		$this->assertSame(
			[ 'mwjson-editdevice' ],
			$this->newGuard()->rightsForData( [
				'type' => [ 'Category:Category' ],
				'subclass_of' => [ 'Category:Device' ],
			] )
		);
	}

	public function testAnUnrelatedPageIsNotGuarded() {
		$this->assertSame(
			[],
			$this->newGuard()->rightsForData( [ 'type' => [ 'Category:Book' ] ] )
		);
	}

	public function testDataWithoutTypeIsNotGuarded() {
		$this->assertSame( [], $this->newGuard()->rightsForData( [] ) );
		$this->assertSame( [], $this->newGuard()->rightsForData( [ 'type' => null ] ) );
		$this->assertSame( [], $this->newGuard()->rightsForData( [ 'type' => [ 42, [] ] ] ) );
	}

	public function testATypeGivenAsAStringIsAccepted() {
		$this->assertSame(
			[ 'mwjson-editdevice' ],
			$this->newGuard()->rightsForData( [ 'type' => 'Category:Laptop' ] )
		);
	}

	public function testUnderscoresAndSpacesAreTheSameTitle() {
		$guard = new GuardedCategories( [ 'Category:Two_Words' => 'r' ], $this->newLoader() );
		$this->assertSame( [ 'r' ], $guard->rightsForData( [ 'type' => [ 'Category:Two Words' ] ] ) );
	}

	public function testEveryMatchingRightIsRequiredNotJustTheFirst() {
		$guard = new GuardedCategories( [
			'Category:Device' => 'right-a',
			'Category:Laptop' => 'right-b',
		], $this->newLoader() );

		$rights = $guard->rightsForData( [ 'type' => [ 'Category:Ultrabook' ] ] );
		sort( $rights );
		$this->assertSame( [ 'right-a', 'right-b' ], $rights );
	}

	public function testACycleInTheChainTerminates() {
		$guard = new GuardedCategories( [ 'Category:Nowhere' => 'r' ], $this->newLoader() );
		$this->assertSame( [], $guard->rightsForCategory( 'Category:Ouroboros' ) );
	}

	public function testTheSameCategoryIsWalkedOnce() {
		$loader = $this->newLoader();
		$guard = new GuardedCategories( self::GUARD, $loader );

		$guard->rightsForCategory( 'Category:Ultrabook' );
		$before = count( $loader->reads );
		$guard->rightsForCategory( 'Category:Ultrabook' );

		$this->assertCount( $before, $loader->reads, 'second lookup should be memoised' );
	}

	public function testTheGuardedCategoryItselfIsGuarded() {
		// Editing Category:Device is editing the definition every instance
		// inherits, so it takes the same right.
		$this->assertSame(
			[ 'mwjson-editdevice' ],
			$this->newGuard()->rightsForCategory( 'Category:Device' )
		);
	}

	public function testTheJsonschemaSlotIsWhatIsRead() {
		$loader = $this->newLoader();
		$loader = new class( $loader ) implements JsonLoader {
			public array $slots = [];

			public function __construct( private JsonLoader $inner ) {
			}

			public function load( string $pageTitle, ?string $slot = null ): array {
				$this->slots[] = $slot;
				return $this->inner->load( $pageTitle, $slot );
			}
		};

		( new GuardedCategories( self::GUARD, $loader ) )->rightsForCategory( 'Category:Laptop' );

		$this->assertNotSame( [], $loader->slots );
		$this->assertSame( [ Slots::JSONSCHEMA ], array_values( array_unique( $loader->slots ) ) );
	}
}
