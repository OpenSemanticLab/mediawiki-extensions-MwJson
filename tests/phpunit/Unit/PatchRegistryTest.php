<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\Mw\GuardedCategories;
use MediaWiki\Extension\MwJson\Mw\PatchRegistry;
use MediaWiki\Extension\MwJson\OOLD\JsonLoader;
use MediaWikiUnitTestCase;
use SMW\DIWikiPage;
use SMW\Store;

/**
 * Which pages the registry will honour as patches.
 *
 * Discovery finds pages by the semantic property they carry, and any page can
 * be made to carry it: declaring `target` in a category's `@context` is enough,
 * and writing such a category is not itself restricted. So carrying the
 * property cannot be the test, or a user who may not create a patch creates an
 * unguarded class that maps the same property and patches through it.
 *
 * @covers \MediaWiki\Extension\MwJson\Mw\PatchRegistry
 */
class PatchRegistryTest extends MediaWikiUnitTestCase {

	private const GUARDED = 'Category:PagePatch';
	private const TARGET = 'Category:Time';

	/** @var array<string,array> page title => jsondata */
	private array $pages = [];

	private function newLoader(): JsonLoader {
		$pages = &$this->pages;
		return new class( $pages ) implements JsonLoader {
			public function __construct( private array &$pages ) {
			}

			public function load( string $pageTitle, ?string $slot = null ): array {
				return $this->pages[$pageTitle] ?? [];
			}
		};
	}

	private function newStore(): Store {
		$subjects = [];
		foreach ( array_keys( $this->pages ) as $title ) {
			if ( strpos( $title, 'Item:' ) === 0 ) {
				$page = $this->createMock( DIWikiPage::class );
				$mwTitle = $this->createMock( \MediaWiki\Title\Title::class );
				$mwTitle->method( 'getPrefixedText' )->willReturn( $title );
				$page->method( 'getTitle' )->willReturn( $mwTitle );
				$subjects[] = $page;
			}
		}

		$store = $this->createMock( Store::class );
		$store->method( 'getAllPropertySubjects' )->willReturn( $subjects );
		return $store;
	}

	private function newRegistry( array $rights ): PatchRegistry {
		$loader = $this->newLoader();
		$titleFactory = $this->createMock( \MediaWiki\Title\TitleFactory::class );
		$titleFactory->method( 'newFromText' )->willReturn( null );

		return new PatchRegistry(
			$this->newStore(),
			$loader,
			[ 'render' ],
			new GuardedCategories( $rights, $loader ),
			$titleFactory,
			self::GUARDED
		);
	}

	private function patch( array $type ): array {
		return [
			'type' => $type,
			'patchset' => [ 'render' ],
			'target' => [ self::TARGET ],
			'jsonschema' => [ [ 'mode' => 'json-merge-patch', 'value' => '{"title":"patched"}' ] ],
		];
	}

	public function testAGuardedPatchIsHonoured() {
		$this->pages = [
			self::GUARDED => [],
			'Item:RealPatch' => $this->patch( [ self::GUARDED ] ),
		];

		$registry = $this->newRegistry( [ self::GUARDED => 'mwjson-editpatch' ] );

		$this->assertCount( 1, $registry->forPage( self::TARGET ) );
	}

	public function testAPageOfAnotherTypeIsIgnored() {
		// The query is a hint: {{#set: HasPatchTarget=... }} on any page puts it
		// in the result, and writing that takes no right at all.
		$this->pages = [
			self::GUARDED => [],
			'Item:SetProbe' => [ 'patchset' => [ 'render' ], 'target' => [ self::TARGET ] ],
		];

		$registry = $this->newRegistry( [ self::GUARDED => 'mwjson-editpatch' ] );

		$this->assertSame( [], $registry->forPage( self::TARGET ) );
	}

	public function testASubclassOfThePatchCategoryIsNotFollowed() {
		// Deliberate: the candidate list is attacker controlled, so a class walk
		// per candidate would read slots per candidate.
		$this->pages = [
			self::GUARDED => [],
			'Category:SubPatch' => [
				'allOf' => [ [ '$ref' => '/wiki/' . self::GUARDED . '?action=raw&slot=jsonschema' ] ],
			],
			'Item:SubclassPatch' => $this->patch( [ 'Category:SubPatch' ] ),
		];

		$registry = $this->newRegistry( [ self::GUARDED => 'mwjson-editpatch' ] );

		$this->assertSame( [], $registry->forPage( self::TARGET ) );
	}

	public function testAPageInAnUnguardedClassIsIgnored() {
		// The bypass: the property is granted by a schema, and writing a schema
		// that grants it takes no right, so a page can carry it without ever
		// having been restricted.
		$this->pages = [
			self::GUARDED => [],
			'Category:Innocent' => [],
			'Item:PseudoPatch' => $this->patch( [ 'Category:Innocent' ] ),
		];

		$registry = $this->newRegistry( [ self::GUARDED => 'mwjson-editpatch' ] );

		$this->assertSame( [], $registry->forPage( self::TARGET ) );
	}

	public function testThePatchCategoryMustItselfBeGuarded() {
		// Otherwise it is a patch class in name only and anyone may populate it.
		$this->pages = [
			self::GUARDED => [],
			'Item:RealPatch' => $this->patch( [ self::GUARDED ] ),
		];

		$this->assertSame( [], $this->newRegistry( [] )->forPage( self::TARGET ) );
	}

	public function testNothingPatchesWhenNoPatchCategoryIsConfigured() {
		$this->pages = [
			self::GUARDED => [],
			'Item:RealPatch' => $this->patch( [ self::GUARDED ] ),
		];

		$loader = $this->newLoader();
		$titleFactory = $this->createMock( \MediaWiki\Title\TitleFactory::class );
		$titleFactory->method( 'newFromText' )->willReturn( null );
		$registry = new PatchRegistry(
			$this->newStore(), $loader, [ 'render' ],
			new GuardedCategories( [ self::GUARDED => 'r' ], $loader ), $titleFactory, ''
		);

		$this->assertSame( [], $registry->forPage( self::TARGET ) );
	}

	public function testNothingPatchesWhenNoRuleIsConfigured() {
		// A half-finished configuration reads as "no patching", not as "anyone".
		$this->pages = [
			self::GUARDED => [],
			'Item:RealPatch' => $this->patch( [ self::GUARDED ] ),
		];

		$this->assertSame( [], $this->newRegistry( [] )->forPage( self::TARGET ) );
	}

	public function testAPatchIsStillRecordedWhenItDoesNotApply() {
		// Its revision is part of what decided that, so a later edit has to
		// invalidate whatever was cached on the strength of it.
		$this->pages = [
			self::GUARDED => [],
			'Category:Innocent' => [],
			'Item:PseudoPatch' => $this->patch( [ 'Category:Innocent' ] ),
		];

		$registry = $this->newRegistry( [ self::GUARDED => 'mwjson-editpatch' ] );
		$registry->forPage( self::TARGET );

		$this->assertArrayHasKey( 'Item:PseudoPatch', $registry->getPatchPages() );
	}
}
