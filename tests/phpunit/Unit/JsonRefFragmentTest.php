<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\OOLD\JsonLoader;
use MediaWiki\Extension\MwJson\OOLD\JsonRefExpander;
use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
use MediaWikiUnitTestCase;

/**
 * JSON Pointer fragments in `$ref`, which the Lua never resolved.
 *
 * Without them a schema cannot use `$defs`, and every reusable subschema has to
 * be written out at each place it is used. The editor has always resolved them,
 * through $RefParser, so a schema using `$defs` worked in the form and left a
 * bare `$ref` in the render.
 *
 * @covers \MediaWiki\Extension\MwJson\OOLD\JsonRefExpander
 */
class JsonRefFragmentTest extends MediaWikiUnitTestCase {

	private function newExpander( array $pages = [] ): JsonRefExpander {
		$loader = new class( $pages ) implements JsonLoader {
			public function __construct( private array $pages ) {
			}

			public function load( string $pageTitle, ?string $slot = null ): array {
				return $this->pages[$pageTitle] ?? [];
			}
		};

		return new JsonRefExpander( $loader, new LegacyLuaMergeStrategy() );
	}

	public function testASameDocumentPointerIsResolved() {
		$result = $this->newExpander()->expand( [
			'$defs' => [ 'operation' => [ 'type' => 'object', 'title' => 'Operation' ] ],
			'properties' => [
				'footer' => [ 'items' => [ '$ref' => '#/$defs/operation' ] ],
			],
		] );

		$this->assertSame(
			[ 'type' => 'object', 'title' => 'Operation' ],
			$result['properties']['footer']['items']
		);
	}

	public function testTheReferringNodeKeepsItsOwnKeywords() {
		$result = $this->newExpander()->expand( [
			'$defs' => [ 'op' => [ 'type' => 'object', 'title' => 'Generic' ] ],
			'properties' => [
				'footer' => [ '$ref' => '#/$defs/op', 'title' => 'Footer operations' ],
			],
		] );

		$this->assertSame( 'Footer operations', $result['properties']['footer']['title'] );
		$this->assertSame( 'object', $result['properties']['footer']['type'] );
		$this->assertArrayNotHasKey( '$ref', $result['properties']['footer'] );
	}

	public function testTheSamePointerCanBeUsedManyTimes() {
		// The whole point: one definition, used at every slot.
		$result = $this->newExpander()->expand( [
			'$defs' => [ 'op' => [ 'title' => 'Operation' ] ],
			'properties' => [
				'header' => [ '$ref' => '#/$defs/op' ],
				'footer' => [ '$ref' => '#/$defs/op' ],
				'schema' => [ '$ref' => '#/$defs/op' ],
			],
		] );

		foreach ( [ 'header', 'footer', 'schema' ] as $key ) {
			$this->assertSame( 'Operation', $result['properties'][$key]['title'], $key );
		}
	}

	public function testAPointerIntoAnExternalDocument() {
		$expander = $this->newExpander( [
			'JsonSchema:Shared' => [ '$defs' => [ 'unit' => [ 'title' => 'Unit' ] ] ],
		] );

		$result = $expander->expand( [
			'properties' => [
				'unit' => [ '$ref' => '/wiki/JsonSchema:Shared?action=raw#/$defs/unit' ],
			],
		] );

		$this->assertSame( 'Unit', $result['properties']['unit']['title'] );
	}

	public function testAnEncodedDollarIsDecoded() {
		// How an encoded pointer reaches us; the client rewrites the same thing.
		$result = $this->newExpander()->expand( [
			'$defs' => [ 'op' => [ 'title' => 'Operation' ] ],
			'properties' => [ 'footer' => [ '$ref' => '#/%24defs/op' ] ],
		] );

		$this->assertSame( 'Operation', $result['properties']['footer']['title'] );
	}

	public function testEscapedTokensFollowRfc6901() {
		$result = $this->newExpander()->expand( [
			'$defs' => [ 'a/b' => [ 'title' => 'Slash' ], 'c~d' => [ 'title' => 'Tilde' ] ],
			'properties' => [
				'x' => [ '$ref' => '#/$defs/a~1b' ],
				'y' => [ '$ref' => '#/$defs/c~0d' ],
			],
		] );

		$this->assertSame( 'Slash', $result['properties']['x']['title'] );
		$this->assertSame( 'Tilde', $result['properties']['y']['title'] );
	}

	public function testANestedRefInsideTheTargetIsResolvedToo() {
		$expander = $this->newExpander( [
			'JsonSchema:Label' => [ 'title' => 'Label' ],
		] );

		$result = $expander->expand( [
			'$defs' => [
				'wrapper' => [ 'items' => [ '$ref' => '/wiki/JsonSchema:Label?action=raw' ] ],
			],
			'properties' => [ 'label' => [ '$ref' => '#/$defs/wrapper' ] ],
		] );

		$this->assertSame( 'Label', $result['properties']['label']['items']['title'] );
	}

	public function testADanglingPointerIsLeftAlone() {
		// An authoring mistake worth seeing in the output rather than silently
		// becoming an empty schema, which would render as a missing field.
		$result = $this->newExpander()->expand( [
			'properties' => [ 'x' => [ '$ref' => '#/$defs/nothing' ] ],
		] );

		$this->assertSame( '#/$defs/nothing', $result['properties']['x']['$ref'] );
	}

	public function testASelfReferencingPointerTerminates() {
		$result = $this->newExpander()->expand( [
			'$defs' => [ 'loop' => [ '$ref' => '#/$defs/loop', 'title' => 'Loop' ] ],
			'properties' => [ 'x' => [ '$ref' => '#/$defs/loop' ] ],
		] );

		$this->assertSame( 'Loop', $result['properties']['x']['title'] );
	}

	public function testTwoPointersThatReferToEachOtherTerminate() {
		$result = $this->newExpander()->expand( [
			'$defs' => [
				'a' => [ '$ref' => '#/$defs/b', 'title' => 'A' ],
				'b' => [ '$ref' => '#/$defs/a', 'title' => 'B' ],
			],
			'properties' => [ 'x' => [ '$ref' => '#/$defs/a' ] ],
		] );

		$this->assertSame( 'A', $result['properties']['x']['title'] );
	}

	public function testAUrlWithoutAFragmentStillWorks() {
		$expander = $this->newExpander( [ 'JsonSchema:Label' => [ 'title' => 'Label' ] ] );

		$result = $expander->expand( [
			'properties' => [ 'label' => [ '$ref' => '/wiki/JsonSchema:Label?action=raw' ] ],
		] );

		$this->assertSame( 'Label', $result['properties']['label']['title'] );
	}

	public function testAWholeDocumentSelfReferenceIsLeftAlone() {
		// "#" is how a schema declares itself recursive: JsonSchema:Statement's
		// substatements are statements. There is nothing to inline, only an
		// infinite regress, and inlining it once exhausted memory on the one
		// corpus page that uses it.
		$result = $this->newExpander()->expand( [
			'title' => 'Statement',
			'properties' => [ 'substatements' => [ 'items' => [ '$ref' => '#' ] ] ],
		] );

		$this->assertSame( '#', $result['properties']['substatements']['items']['$ref'] );
	}

	public function testARecursiveExternalSchemaIsLeftAloneToo() {
		$expander = $this->newExpander( [
			'JsonSchema:Statement' => [
				'title' => 'Statement',
				'properties' => [ 'sub' => [ 'items' => [ '$ref' => '#' ] ] ],
			],
		] );

		$result = $expander->expand( [
			'properties' => [ 'statements' => [ '$ref' => '/wiki/JsonSchema:Statement?action=raw' ] ],
		] );

		$statements = $result['properties']['statements'];
		$this->assertSame( 'Statement', $statements['title'] );
		$this->assertSame( '#', $statements['properties']['sub']['items']['$ref'] );
	}

	public function testAFragmentInsideALoadedDocumentResolvesThere() {
		// Not against the document that pulled it in. Both define $defs/thing,
		// and the loaded one must win inside its own content.
		$expander = $this->newExpander( [
			'JsonSchema:Outer' => [
				'$defs' => [ 'thing' => [ 'title' => 'From the loaded document' ] ],
				'properties' => [ 'x' => [ '$ref' => '#/$defs/thing' ] ],
			],
		] );

		$result = $expander->expand( [
			'$defs' => [ 'thing' => [ 'title' => 'From the root' ] ],
			'properties' => [ 'outer' => [ '$ref' => '/wiki/JsonSchema:Outer?action=raw' ] ],
		] );

		$this->assertSame(
			'From the loaded document',
			$result['properties']['outer']['properties']['x']['title']
		);
	}

	public function testAPointerToANonObjectDoesNotApply() {
		$result = $this->newExpander()->expand( [
			'$defs' => [ 'scalar' => 'not a schema' ],
			'properties' => [ 'x' => [ '$ref' => '#/$defs/scalar' ] ],
		] );

		$this->assertSame( '#/$defs/scalar', $result['properties']['x']['$ref'] );
	}
}
