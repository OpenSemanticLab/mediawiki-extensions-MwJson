<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\OOLD\JsonUtil;
use PHPUnit\Framework\TestCase;

/**
 * @covers \MediaWiki\Extension\MwJson\OOLD\JsonUtil
 */
class JsonUtilTest extends TestCase {

	/**
	 * From MwJson.lua:
	 *   mw.logObject(p.defaultArgPath({some={defined={path="value"}}}, {"some","defined","path"}, "default_value"))
	 *   mw.logObject(p.defaultArgPath({some={defined={path="value"}}}, {"some","undefined","path"}, "default_value"))
	 *
	 * @dataProvider provideDefaultArgPath
	 * @param mixed $expected
	 */
	public function testDefaultArgPath( $expected, $value, array $path, $default ): void {
		$this->assertSame( $expected, JsonUtil::defaultArgPath( $value, $path, $default ) );
	}

	public static function provideDefaultArgPath(): array {
		$tree = [ 'some' => [ 'defined' => [ 'path' => 'value' ] ] ];
		return [
			'documented hit' => [ 'value', $tree, [ 'some', 'defined', 'path' ], 'default_value' ],
			'documented miss' => [ 'default_value', $tree, [ 'some', 'undefined', 'path' ], 'default_value' ],
			'empty path returns the node' => [ $tree, $tree, [], null ],
			'null root yields default' => [ 'fallback', null, [ 'a' ], 'fallback' ],
			// Lua tolerates indexing a string (yields nil via the string
			// metatable), so a scalar mid-path must not throw.
			'scalar mid-path yields default' => [ 'fallback', $tree, [ 'some', 'defined', 'path', 'deeper' ], 'fallback' ],
			// defaultArg only substitutes for nil, so falsy leaves survive.
			'false leaf survives' => [ false, [ 'a' => false ], [ 'a' ], 'fallback' ],
			'zero leaf survives' => [ 0, [ 'a' => 0 ], [ 'a' ], 'fallback' ],
			'null leaf yields default' => [ 'fallback', [ 'a' => null ], [ 'a' ], 'fallback' ],
			'integer keys walk lists' => [ 'b', [ 'a', 'b' ], [ 1 ], null ],
		];
	}

	/**
	 * splitString's separator is a character *class* in the Lua pattern
	 * "([^sep]+)", so runs collapse and empty fields never appear.
	 *
	 * @dataProvider provideSplitString
	 */
	public function testSplitString( array $expected, string $input, string $separators ): void {
		$this->assertSame( $expected, JsonUtil::splitString( $input, $separators ) );
	}

	public static function provideSplitString(): array {
		return [
			'plain' => [ [ 'a', 'b' ], 'a;b', ';' ],
			'namespaced title' => [ [ 'Category', 'Entity' ], 'Category:Entity', ':' ],
			// getSemanticProperties() splits context terms on "*" to strip the
			// OO-LD multi-mapping shorthand.
			'single star shorthand' => [ [ 'label' ], 'label*', '*' ],
			'double star shorthand' => [ [ 'label' ], 'label**', '*' ],
			'star in the middle' => [ [ 'a', 'b' ], 'a*b', '*' ],
			// setNormalizedLabel() splits "text@lang" on "@".
			'label with language' => [ [ 'Keyword', 'en' ], 'Keyword@en', '@' ],
			'runs collapse' => [ [ 'a', 'b' ], 'a::b', ':' ],
			'leading separators dropped' => [ [ 'a' ], '::a', ':' ],
			'trailing separators dropped' => [ [ 'a' ], 'a::', ':' ],
			'no separator present' => [ [ 'abc' ], 'abc', ';' ],
			'empty input' => [ [], '', ';' ],
			'only separators' => [ [], ';;;', ';' ],
			// A URL path split on ":". Several call sites do this on titles.
			'multi-char separator set' => [ [ 'a', 'b', 'c' ], 'a:b;c', ':;' ],
			// Regex metacharacters must be treated literally, not as syntax.
			'metacharacter separator' => [ [ 'a', 'b' ], 'a.b', '.' ],
		];
	}

	/**
	 * @dataProvider provideNilOrEmpty
	 * @param mixed $value
	 */
	public function testNilOrEmpty( bool $expected, $value ): void {
		$this->assertSame( $expected, JsonUtil::nilOrEmpty( $value ) );
	}

	public static function provideNilOrEmpty(): array {
		return [
			'null' => [ true, null ],
			'empty string' => [ true, '' ],
			'empty array' => [ true, [] ],
			'non-empty array' => [ false, [ 'a' ] ],
			'non-empty string' => [ false, 'a' ],
			// Not PHP's empty(): Lua treats these as values.
			'zero' => [ false, 0 ],
			'zero string' => [ false, '0' ],
			'false' => [ false, false ],
		];
	}

	/**
	 * @dataProvider provideTablefy
	 * @param mixed $value
	 */
	public function testTablefy( array $expected, $value ): void {
		$this->assertSame( $expected, JsonUtil::tablefy( $value ) );
	}

	public static function provideTablefy(): array {
		return [
			'null becomes empty' => [ [], null ],
			'scalar is wrapped' => [ [ 'x' ], 'x' ],
			'zero is wrapped, not dropped' => [ [ 0 ], 0 ],
			'false is wrapped, not dropped' => [ [ false ], false ],
			'array passes through' => [ [ 'a', 'b' ], [ 'a', 'b' ] ],
			'map passes through' => [ [ 'k' => 'v' ], [ 'k' => 'v' ] ],
		];
	}

	/**
	 * hasFirstElement() is the module's `t[1] ~= nil` test and is deliberately
	 * *not* array_is_list(): the two disagree on the empty array, and call
	 * sites branch on that.
	 *
	 * @dataProvider provideShape
	 * @param mixed $value
	 */
	public function testShapePredicates( bool $hasFirst, bool $isMap, $value ): void {
		$this->assertSame( $hasFirst, JsonUtil::hasFirstElement( $value ), 'hasFirstElement' );
		$this->assertSame( $isMap, JsonUtil::isMap( $value ), 'isMap' );
	}

	public static function provideShape(): array {
		return [
			'list' => [ true, false, [ 'a', 'b' ] ],
			'map' => [ false, true, [ 'k' => 'v' ] ],
			// Neither: the Lua code routes empty tables down the list branch.
			'empty array is neither' => [ false, false, [] ],
			'scalar is neither' => [ false, false, 'x' ],
			'null is neither' => [ false, false, null ],
			'mixed with element 0 counts as list' => [ true, false, [ 0 => 'a', 'k' => 'v' ] ],
		];
	}

	public function testEmptyArrayDisagreesWithArrayIsList(): void {
		// Guards the distinction above against a future "simplification".
		$this->assertTrue( array_is_list( [] ) );
		$this->assertFalse( JsonUtil::hasFirstElement( [] ) );
	}

	public function testTableContainsUsesStrictComparison(): void {
		$this->assertTrue( JsonUtil::tableContains( [ 'a', 'b' ], 'b' ) );
		$this->assertFalse( JsonUtil::tableContains( [ 'a', 'b' ], 'c' ) );
		// Lua never coerces across types for ==.
		$this->assertFalse( JsonUtil::tableContains( [ 1, 2 ], '1' ) );
		// ipairs() only walks the list part, so map values are invisible.
		$this->assertFalse( JsonUtil::tableContains( [ 'k' => 'v' ], 'v' ) );
	}

	public function testTableLengthCountsEveryPair(): void {
		// Unlike Lua's # operator, p.tableLength() counts the map part too.
		$this->assertSame( 3, JsonUtil::tableLength( [ 0 => 'a', 1 => 'b', 'k' => 'v' ] ) );
		$this->assertSame( 0, JsonUtil::tableLength( [] ) );
	}

	public function testListPartStopsAtFirstHole(): void {
		// ipairs() stops at the first missing index; array_values() would not.
		$this->assertSame( [ 'a', 'b' ], JsonUtil::listPart( [ 0 => 'a', 1 => 'b', 3 => 'd' ] ) );
		$this->assertSame( [], JsonUtil::listPart( [ 1 => 'b' ] ) );
	}
}
