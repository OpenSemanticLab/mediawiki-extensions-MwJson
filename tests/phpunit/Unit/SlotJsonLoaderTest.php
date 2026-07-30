<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\Mw\SlotJsonLoader;
use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
use MediaWiki\Extension\MwJson\OOLD\SlotTextLoader;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\MwJson\Mw\SlotJsonLoader
 */
class SlotJsonLoaderTest extends TestCase {

	/**
	 * @param array<string,array<string,?string>> $pages title => slot => raw text
	 */
	private function newLoader( array $pages, ?array &$reads = null ): SlotJsonLoader {
		$reads = [];
		$slots = new class( $pages, $reads ) implements SlotTextLoader {
			private array $pages;
			private array $reads;

			public function __construct( array $pages, array &$reads ) {
				$this->pages = $pages;
				$this->reads = &$reads;
			}

			public function getText( string $pageTitle, string $slot ): ?string {
				$this->reads[] = "$pageTitle#$slot";
				return $this->pages[$pageTitle][$slot] ?? null;
			}
		};

		return new SlotJsonLoader( $slots, new LegacyLuaMergeStrategy() );
	}

	public function testDecodesASlot(): void {
		$loader = $this->newLoader( [ 'Category:X' => [ 'jsonschema' => '{"title":"X"}' ] ] );
		$this->assertSame( [ 'title' => 'X' ], $loader->load( 'Category:X', 'jsonschema' ) );
	}

	public function testDefaultsToTheMainSlot(): void {
		$loader = $this->newLoader( [ 'JsonSchema:X' => [ 'main' => '{"title":"X"}' ] ] );
		$this->assertSame( [ 'title' => 'X' ], $loader->load( 'JsonSchema:X' ) );
	}

	/**
	 * p.loadJson() initialises `json = {}` and only overwrites it when the slot
	 * has content, so every one of these is indistinguishable to callers.
	 *
	 * @dataProvider provideEmptyResults
	 */
	public function testEmptyResults( array $pages ): void {
		$loader = $this->newLoader( $pages );
		$this->assertSame( [], $loader->load( 'Category:X', 'jsonschema' ) );
	}

	public static function provideEmptyResults(): array {
		return [
			'missing page' => [ [] ],
			'missing slot' => [ [ 'Category:X' => [ 'main' => '{"a":1}' ] ] ],
			'empty slot' => [ [ 'Category:X' => [ 'jsonschema' => '' ] ] ],
			'whitespace only' => [ [ 'Category:X' => [ 'jsonschema' => "  \n" ] ] ],
			// Divergence from mw.text.jsonDecode(), which raises and takes the
			// whole page render down with a Lua error.
			'malformed json' => [ [ 'Category:X' => [ 'jsonschema' => '{"a":' ] ] ],
			'json scalar rather than a document' => [ [ 'Category:X' => [ 'jsonschema' => '42' ] ] ],
		];
	}

	public function testMemoisesPerPageAndSlot(): void {
		$loader = $this->newLoader( [
			'Category:X' => [ 'jsonschema' => '{"title":"X"}', 'jsondata' => '{"a":1}' ],
		], $reads );

		$loader->load( 'Category:X', 'jsonschema' );
		$loader->load( 'Category:X', 'jsonschema' );
		$loader->load( 'Category:X', 'jsondata' );

		// The schema walk reads the same Category repeatedly; each slot must
		// hit the underlying source exactly once.
		$this->assertSame( [ 'Category:X#jsonschema', 'Category:X#jsondata' ], $reads );
	}

	public function testMemoisesMissesToo(): void {
		$loader = $this->newLoader( [], $reads );
		$loader->load( 'Category:Nope', 'jsonschema' );
		$loader->load( 'Category:Nope', 'jsonschema' );
		$this->assertSame( [ 'Category:Nope#jsonschema' ], $reads );
	}

	public function testClearCacheForcesAReread(): void {
		$loader = $this->newLoader( [ 'Category:X' => [ 'jsonschema' => '{"a":1}' ] ], $reads );
		$loader->load( 'Category:X', 'jsonschema' );
		$loader->clearCache();
		$loader->load( 'Category:X', 'jsonschema' );
		$this->assertCount( 2, $reads );
	}

	// -- $defs.generated inlining -------------------------------------------

	public function testInlinesGeneratedViaRootRef(): void {
		$loader = $this->newLoader( [ 'Category:X' => [ 'jsonschema' => json_encode( [
			'$ref' => '#/$defs/generated',
			'title' => 'hand written',
			'$defs' => [ 'generated' => [
				'title' => 'generated',
				'type' => 'object',
				'properties' => [ 'a' => [ 'type' => 'string' ] ],
			] ],
		] ) ] ] );

		$result = $loader->load( 'Category:X', 'jsonschema' );

		$this->assertArrayNotHasKey( '$ref', $result, 'the fragment ref is consumed' );
		$this->assertSame( 'hand written', $result['title'], 'the document beats the generated body' );
		$this->assertSame( 'object', $result['type'], 'generated keywords are folded in' );
		$this->assertSame( [ 'a' => [ 'type' => 'string' ] ], $result['properties'] );
		$this->assertSame( [], $result['$defs'], 'the generated definition is removed' );
	}

	public function testInlinesGeneratedViaAllOfMember(): void {
		$loader = $this->newLoader( [ 'Category:X' => [ 'jsonschema' => json_encode( [
			'allOf' => [
				[ '$ref' => '/wiki/Category:Entity?action=raw&slot=jsonschema' ],
				[ '$ref' => '#/$defs/generated' ],
			],
			'$defs' => [ 'generated' => [ 'type' => 'object' ] ],
		] ) ] ] );

		$result = $loader->load( 'Category:X', 'jsonschema' );

		$this->assertSame( 'object', $result['type'] );
		$this->assertSame(
			[ [ '$ref' => '/wiki/Category:Entity?action=raw&slot=jsonschema' ] ],
			$result['allOf'],
			'only the generated member is removed, and the list is reindexed'
		);
	}

	public function testGeneratedIsMergedTwiceWhenBothBranchesReferenceIt(): void {
		// The two branches in p.loadJson() are independent ifs, not a chain, so
		// a document that references $defs.generated from the root *and* from
		// allOf merges it twice. Visible because the legacy merge appends
		// integer keys.
		$loader = $this->newLoader( [ 'Category:X' => [ 'jsonschema' => json_encode( [
			'$ref' => '#/$defs/generated',
			'allOf' => [ [ '$ref' => '#/$defs/generated' ] ],
			'$defs' => [ 'generated' => [ 'required' => [ 'uuid' ] ] ],
		] ) ] ] );

		$result = $loader->load( 'Category:X', 'jsonschema' );

		$this->assertSame( [ 'uuid', 'uuid' ], $result['required'] );
	}

	public function testGeneratedIsRemovedEvenWhenNothingReferencesIt(): void {
		$loader = $this->newLoader( [ 'Category:X' => [ 'jsonschema' => json_encode( [
			'title' => 'X',
			'$defs' => [ 'generated' => [ 'type' => 'object' ], 'other' => [ 'type' => 'string' ] ],
		] ) ] ] );

		$result = $loader->load( 'Category:X', 'jsonschema' );

		$this->assertSame( 'X', $result['title'] );
		$this->assertArrayNotHasKey( 'type', $result, 'nothing referenced it, so nothing is folded in' );
		$this->assertSame( [ 'other' => [ 'type' => 'string' ] ], $result['$defs'] );
	}

	public function testLeavesDocumentsWithoutGeneratedDefsAlone(): void {
		$document = [ 'title' => 'X', '$defs' => [ 'other' => [ 'type' => 'string' ] ] ];
		$loader = $this->newLoader( [ 'Category:X' => [ 'jsonschema' => json_encode( $document ) ] ] );
		$this->assertSame( $document, $loader->load( 'Category:X', 'jsonschema' ) );
	}

	public function testIgnoresANonArrayGeneratedDefinition(): void {
		$document = [ '$ref' => '#/$defs/generated', '$defs' => [ 'generated' => 'nonsense' ] ];
		$loader = $this->newLoader( [ 'Category:X' => [ 'jsonschema' => json_encode( $document ) ] ] );
		$this->assertSame( $document, $loader->load( 'Category:X', 'jsonschema' ) );
	}

	public function testIgnoresAllOfMembersThatAreNotObjects(): void {
		// Guards the PHP port against the Lua's `item["$ref"]` on a string,
		// which would raise "attempt to index a string value".
		$loader = $this->newLoader( [ 'Category:X' => [ 'jsonschema' => json_encode( [
			'allOf' => [ 'not an object', [ '$ref' => '#/$defs/generated' ] ],
			'$defs' => [ 'generated' => [ 'type' => 'object' ] ],
		] ) ] ] );

		$result = $loader->load( 'Category:X', 'jsonschema' );

		$this->assertSame( 'object', $result['type'] );
		$this->assertSame( [ 'not an object' ], $result['allOf'] );
	}
}
