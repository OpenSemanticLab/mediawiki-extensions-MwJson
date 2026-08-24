<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
use PHPUnit\Framework\TestCase;

/**
 * tableMerge() drives OSL's whole schema-inheritance model, so its quirks are
 * pinned here rather than left to be rediscovered from rendered output.
 *
 * @covers \MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy
 */
class LegacyLuaMergeStrategyTest extends TestCase {

	private LegacyLuaMergeStrategy $merge;

	protected function setUp(): void {
		parent::setUp();
		$this->merge = new LegacyLuaMergeStrategy();
	}

	/**
	 * The worked example in MwJson.lua:
	 *   p.tableMerge({"string", test1="test1", subtable1={"test"}},
	 *                {"string2", test1="test2", test3="test4"})
	 *
	 * String keys overwrite; the positional member appends rather than
	 * replacing, so both "string" and "string2" survive.
	 */
	public function testDocumentedExample(): void {
		$result = $this->merge->merge(
			[ 0 => 'string', 'test1' => 'test1', 'subtable1' => [ 'test' ] ],
			[ 0 => 'string2', 'test1' => 'test2', 'test3' => 'test4' ]
		);

		$this->assertSame( 'test2', $result['test1'], 'string keys overwrite' );
		$this->assertSame( 'test4', $result['test3'], 'new string keys are added' );
		$this->assertSame( [ 'test' ], $result['subtable1'], 'untouched keys survive' );
		$this->assertSame( [ 'string', 'string2' ], array_values(
			array_filter( $result, 'is_int', ARRAY_FILTER_USE_KEY )
		), 'integer keys append' );
	}

	public function testIntegerKeysAppendRatherThanOverwrite(): void {
		// This is what makes a schema chain accumulate enum/required entries
		// instead of the most-derived schema winning, the opposite of RFC 7396.
		$this->assertSame(
			[ 'a', 'b', 'c', 'd' ],
			$this->merge->merge( [ 'a', 'b' ], [ 'c', 'd' ] )
		);
	}

	public function testNestedArraysMergeByPositionInsteadOfAppending(): void {
		// Quirk (2): both sides are arrays at index 0, so they merge
		// element-wise. The intuitive answer would be [["a"],["b"],["c"]].
		$this->assertSame(
			[ [ 'a', 'c' ], [ 'b' ] ],
			$this->merge->merge( [ [ 'a' ], [ 'b' ] ], [ [ 'c' ] ] )
		);
	}

	public function testMapsMergeRecursively(): void {
		$this->assertSame(
			[ 'properties' => [ 'a' => [ 'title' => 'A' ], 'b' => [ 'title' => 'B' ] ] ],
			$this->merge->merge(
				[ 'properties' => [ 'a' => [ 'title' => 'A' ] ] ],
				[ 'properties' => [ 'b' => [ 'title' => 'B' ] ] ]
			)
		);
	}

	public function testDeeperKeyInSourceOverwritesScalarInTarget(): void {
		$this->assertSame(
			[ 'properties' => [ 'a' => [ 'title' => 'from source' ] ] ],
			$this->merge->merge(
				[ 'properties' => [ 'a' => [ 'title' => 'from target' ] ] ],
				[ 'properties' => [ 'a' => [ 'title' => 'from source' ] ] ]
			)
		);
	}

	public function testScalarTargetOverwrittenByArraySourceOnStringKey(): void {
		// v is a table but t1[k] is not, so the "else" branch assigns.
		$this->assertSame(
			[ 'a' => [ 'x' ] ],
			$this->merge->merge( [ 'a' => 'scalar' ], [ 'a' => [ 'x' ] ] )
		);
	}

	public function testArrayTargetOverwrittenByScalarSourceOnStringKey(): void {
		// v is not a table, so the type of t1[k] is irrelevant.
		$this->assertSame(
			[ 'a' => 'scalar' ],
			$this->merge->merge( [ 'a' => [ 'x' ] ], [ 'a' => 'scalar' ] )
		);
	}

	/**
	 * @dataProvider provideScalarPromotion
	 * @param mixed $target
	 * @param mixed $source
	 */
	public function testScalarsArePromotedToLists( array $expected, $target, $source ): void {
		$this->assertSame( $expected, $this->merge->merge( $target, $source ) );
	}

	public static function provideScalarPromotion(): array {
		return [
			'both scalars' => [ [ 'x', 'y' ], 'x', 'y' ],
			'scalar target' => [ [ 'x', 'y' ], 'x', [ 'y' ] ],
			'scalar source' => [ [ 'x', 'y' ], [ 'x' ], 'y' ],
			'null target' => [ [ 'y' ], null, [ 'y' ] ],
			'null source' => [ [ 'x' ], [ 'x' ], null ],
			'both null' => [ [], null, null ],
			// false is a value, so it is promoted rather than treated as absent.
			'false is a value' => [ [ false ], null, false ],
		];
	}

	public function testArgumentsAreNotMutated(): void {
		// The Lua original mutates t1 in place and returns it; aliasing bugs
		// downstream are why p.copy() is sprinkled through walkJsonSchema.
		// The port must not inherit that.
		$target = [ 'a' => [ 'x' ] ];
		$source = [ 'a' => [ 'y' ], 'b' => 'new' ];

		$this->merge->merge( $target, $source );

		$this->assertSame( [ 'a' => [ 'x' ] ], $target );
		$this->assertSame( [ 'a' => [ 'y' ], 'b' => 'new' ], $source );
	}

	public function testMergeIsAssociativeOverAChainOfSchemas(): void {
		// walkJsonSchema folds the whole ancestor chain left to right; this
		// pins the accumulation order that the propertyOrder ranking assumes.
		$base = [ 'properties' => [ 'uuid' => [ 'propertyOrder' => 10 ] ] ];
		$mid = [ 'properties' => [ 'label' => [ 'propertyOrder' => 20 ] ] ];
		$leaf = [ 'properties' => [ 'uuid' => [ 'propertyOrder' => 99 ] ] ];

		$result = $this->merge->merge( $this->merge->merge( $base, $mid ), $leaf );

		$this->assertSame( 99, $result['properties']['uuid']['propertyOrder'] );
		$this->assertSame( 20, $result['properties']['label']['propertyOrder'] );
	}
}
