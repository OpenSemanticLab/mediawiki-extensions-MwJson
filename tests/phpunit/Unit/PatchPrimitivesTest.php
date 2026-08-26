<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\OOLD\Patch\JsonValue;
use MediaWiki\Extension\MwJson\OOLD\Patch\MergePatch;
use MediaWiki\Extension\MwJson\OOLD\Patch\OverlayPatch;
use MediaWiki\Extension\MwJson\OOLD\Patch\WikitextOps;
use MediaWikiUnitTestCase;

/**
 * The three things a patch can do to a slot.
 *
 * Pure functions over decoded data, so they are tested without a wiki. The
 * cases that matter are the ones a patch author will actually hit: swapping an
 * enum, taking one member out of a list, and extending a template without
 * restating it.
 *
 * @covers \MediaWiki\Extension\MwJson\OOLD\Patch\JsonValue
 * @covers \MediaWiki\Extension\MwJson\OOLD\Patch\MergePatch
 * @covers \MediaWiki\Extension\MwJson\OOLD\Patch\OverlayPatch
 * @covers \MediaWiki\Extension\MwJson\OOLD\Patch\WikitextOps
 */
class PatchPrimitivesTest extends MediaWikiUnitTestCase {

	public function testMergePatchMergesObjectsRecursively() {
		$this->assertSame(
			[ 'a' => [ 'b' => 1, 'c' => 3 ], 'd' => 4 ],
			( new MergePatch() )->apply(
				[ 'a' => [ 'b' => 1, 'c' => 2 ], 'd' => 4 ],
				[ 'a' => [ 'c' => 3 ] ]
			)
		);
	}

	public function testNullDeletesAKey() {
		$this->assertSame(
			[ 'keep' => 1 ],
			( new MergePatch() )->apply( [ 'keep' => 1, 'drop' => 2 ], [ 'drop' => null ] )
		);
	}

	public function testAnArrayReplacesRatherThanMerges() {
		// The reason a merge patch is the right tool for swapping an enum: the
		// new list is the whole list, so it cannot end up a different length
		// from the enum_titles beside it.
		$this->assertSame(
			[ 'enum' => [ 'x' ], 'options' => [ 'enum_titles' => [ 'X' ] ] ],
			( new MergePatch() )->apply(
				[ 'enum' => [ 'a', 'b', 'c' ], 'options' => [ 'enum_titles' => [ 'A', 'B', 'C' ] ] ],
				[ 'enum' => [ 'x' ], 'options' => [ 'enum_titles' => [ 'X' ] ] ]
			)
		);
	}

	public function testAScalarPatchReplacesTheWholeTarget() {
		$this->assertSame( 'gone', ( new MergePatch() )->apply( [ 'a' => 1 ], 'gone' ) );
	}

	public function testPatchingASubtreeThatIsNotThereCreatesIt() {
		$this->assertSame(
			[ 'a' => [ 'b' => 1 ] ],
			( new MergePatch() )->apply( [], [ 'a' => [ 'b' => 1 ] ] )
		);
	}

	public function testAnEmptyPatchAgainstAnObjectChangesNothing() {
		// PHP cannot tell {} from [] after decoding, so this is decided by what
		// is being patched. Read as an array it would wipe properties, which is
		// a silent and destructive reading of a patch that means nothing.
		$this->assertSame(
			[ 'properties' => [ 'a' => [ 'type' => 'string' ] ] ],
			( new MergePatch() )->apply(
				[ 'properties' => [ 'a' => [ 'type' => 'string' ] ] ],
				[ 'properties' => [] ]
			)
		);
	}

	public function testAnEmptyPatchAgainstAListEmptiesIt() {
		$this->assertSame(
			[ 'enum' => [] ],
			( new MergePatch() )->apply( [ 'enum' => [ 'a', 'b' ] ], [ 'enum' => [] ] )
		);
	}

	public function testOverlayRemovesOneArrayMemberByValue() {
		// The case a merge patch cannot express.
		$result = ( new OverlayPatch() )->apply(
			[ 'properties' => [ 'unit' => [ 'enum' => [ 'a', 'b', 'c' ] ] ] ],
			[ 'actions' => [ [
				'target' => "$.properties.unit.enum[?(@ == 'b')]",
				'remove' => true,
			] ] ]
		);

		$this->assertSame( [ 'a', 'c' ], $result['properties']['unit']['enum'] );
		// Renumbered, not left as 0 and 2, which would re-encode as an object.
		$this->assertSame( [ 0, 1 ], array_keys( $result['properties']['unit']['enum'] ) );
	}

	public function testOverlayUpdateMergesIntoAnObject() {
		$result = ( new OverlayPatch() )->apply(
			[ 'properties' => [ 'unit' => [ 'title' => 'Unit', 'type' => 'string' ] ] ],
			[ 'actions' => [ [
				'target' => '$.properties.unit',
				'update' => [ 'title' => 'Narrowed' ],
			] ] ]
		);

		$this->assertSame(
			[ 'title' => 'Narrowed', 'type' => 'string' ],
			$result['properties']['unit']
		);
	}

	public function testOverlayUpdateAppendsToAnArray() {
		// Spec behaviour, and the reason replacing a list takes a merge patch.
		$result = ( new OverlayPatch() )->apply(
			[ 'enum' => [ 'a' ] ],
			[ 'actions' => [ [ 'target' => '$.enum', 'update' => 'b' ] ] ]
		);

		$this->assertSame( [ 'a', 'b' ], $result['enum'] );
	}

	public function testRemoveSuppressesUpdateInTheSameAction() {
		$result = ( new OverlayPatch() )->apply(
			[ 'a' => [ 'keep' => 1 ] ],
			[ 'actions' => [ [
				'target' => '$.a',
				'update' => [ 'added' => 2 ],
				'remove' => true,
			] ] ]
		);

		$this->assertSame( [], $result );
	}

	public function testATargetThatMatchesNothingIsNotAnError() {
		// Patches outlive the pages they target.
		$document = [ 'a' => 1 ];
		$this->assertSame(
			$document,
			( new OverlayPatch() )->apply( $document, [ 'actions' => [ [
				'target' => '$.does.not.exist',
				'update' => [ 'x' => 1 ],
			] ] ] )
		);
	}

	public function testAMalformedTargetLeavesTheDocumentAlone() {
		$document = [ 'a' => 1 ];
		$this->assertSame(
			$document,
			( new OverlayPatch() )->apply( $document, [ 'actions' => [ [
				'target' => '$.a[',
				'update' => [ 'x' => 1 ],
			] ] ] )
		);
	}

	public function testActionsApplyInOrder() {
		$result = ( new OverlayPatch() )->apply(
			[ 'enum' => [ 'a', 'b' ] ],
			[ 'actions' => [
				[ 'target' => "$.enum[?(@ == 'a')]", 'remove' => true ],
				[ 'target' => '$.enum', 'update' => 'c' ],
			] ]
		);

		$this->assertSame( [ 'b', 'c' ], $result['enum'] );
	}

	public function testAnUpdateWrittenAsTextIsDecoded() {
		// What the editor stores: format "json" on a string is an ace editor, so
		// the payload arrives as text rather than as an object.
		$result = ( new OverlayPatch() )->apply(
			[ 'properties' => [ 'unit' => [ 'title' => 'Unit' ] ] ],
			[ 'actions' => [ [
				'target' => '$.properties.unit',
				'update' => '{"title": "Narrowed"}',
			] ] ]
		);

		$this->assertSame( 'Narrowed', $result['properties']['unit']['title'] );
	}

	public function testAnUpdateThatIsNotJsonStaysAString() {
		// An overlay update may legitimately be a bare string, so text that does
		// not parse is used as itself rather than discarded.
		$result = ( new OverlayPatch() )->apply(
			[ 'enum' => [ 'a' ] ],
			[ 'actions' => [ [ 'target' => '$.enum', 'update' => 'b' ] ] ]
		);

		$this->assertSame( [ 'a', 'b' ], $result['enum'] );
	}

	public function testJsonValueAcceptsBothForms() {
		$this->assertSame( [ 'a' => 1 ], JsonValue::decode( '{"a": 1}' ) );
		$this->assertSame( [ 'a' => 1 ], JsonValue::decode( [ 'a' => 1 ] ) );
		$this->assertSame( 'not json', JsonValue::decode( 'not json' ) );
		$this->assertSame( '', JsonValue::decode( '' ) );
		$this->assertNull( JsonValue::decode( null ) );
	}

	public function testWikitextOperationsApplyInOrder() {
		$this->assertSame(
			'<start>body<end>',
			( new WikitextOps() )->apply( 'original', [
				[ 'mode' => 'set', 'value' => 'body' ],
				[ 'mode' => 'prepend', 'value' => '<start>' ],
				[ 'mode' => 'append', 'value' => '<end>' ],
			] )
		);
	}

	public function testReplaceIsLiteralNotAPattern() {
		$this->assertSame(
			'a.c',
			( new WikitextOps() )->apply( 'a.c', [ [ 'mode' => 'replace', 'find' => 'a.c', 'with' => 'a.c' ] ] )
		);
		$this->assertSame(
			'xbc',
			( new WikitextOps() )->apply( 'abc', [ [ 'mode' => 'replace', 'find' => 'a', 'with' => 'x' ] ] )
		);
	}

	public function testInsertKeepsTheMarker() {
		// So the patch still applies to a later revision of the template, and
		// two patches can insert at the same marker without fighting.
		$text = "top\n<!-- MWJSON:AFTER-GRAPH -->\nbottom";
		$once = ( new WikitextOps() )->apply( $text, [
			[ 'mode' => 'insert', 'at' => '<!-- MWJSON:AFTER-GRAPH -->', 'value' => "\nadded" ],
		] );

		$this->assertStringContainsString( '<!-- MWJSON:AFTER-GRAPH -->', $once );
		$this->assertStringContainsString( "AFTER-GRAPH -->\nadded", $once );
	}

	public function testInsertBeforeThePlaceholder() {
		$this->assertSame(
			'before<!-- M -->',
			( new WikitextOps() )->apply( '<!-- M -->', [
				[ 'mode' => 'insert', 'at' => '<!-- M -->', 'value' => 'before', 'before' => true ],
			] )
		);
	}

	public function testInsertWithNoMarkerPresentChangesNothing() {
		$this->assertSame(
			'text',
			( new WikitextOps() )->apply( 'text', [
				[ 'mode' => 'insert', 'at' => '<!-- ABSENT -->', 'value' => 'x' ],
			] )
		);
	}

	public function testRegexReplaces() {
		$this->assertSame(
			"== Usage ==\nbody",
			( new WikitextOps() )->apply( "== Use ==\nbody", [
				[ 'mode' => 'regex', 'pattern' => '/^== Use ==$/m', 'replacement' => '== Usage ==' ],
			] )
		);
	}

	public function testTheEModifierIsRejected() {
		$this->assertSame(
			'text',
			( new WikitextOps() )->apply( 'text', [
				[ 'mode' => 'regex', 'pattern' => '/t/e', 'replacement' => 'phpinfo()' ],
			] )
		);
	}

	public function testAnUndelimitedPatternIsRejected() {
		$this->assertSame(
			'text',
			( new WikitextOps() )->apply( 'text', [
				[ 'mode' => 'regex', 'pattern' => 'text', 'replacement' => 'x' ],
			] )
		);
	}

	public function testCatastrophicBacktrackingFailsTheOperationAndNotTheRender() {
		// The classic exponential pattern. Without the backtrack limit this
		// does not return; with it, preg_replace gives up and the operation is
		// treated as not having applied.
		$text = str_repeat( 'a', 40 ) . 'b';
		$before = microtime( true );

		$result = ( new WikitextOps() )->apply( $text, [
			[ 'mode' => 'regex', 'pattern' => '/(a+)+$/', 'replacement' => 'x' ],
		] );

		$this->assertSame( $text, $result, 'a failed pattern must leave the text alone' );
		$this->assertLessThan( 5, microtime( true ) - $before, 'the limit should stop it quickly' );
	}

	public function testAnUnknownOperationIsIgnored() {
		$this->assertSame(
			'text',
			( new WikitextOps() )->apply( 'text', [ [ 'mode' => 'obliterate' ] ] )
		);
	}
}
