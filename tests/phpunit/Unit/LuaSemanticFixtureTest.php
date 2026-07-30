<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\OOLD\ContextBuilder;
use MediaWiki\Extension\MwJson\OOLD\LabelHelper;
use MediaWiki\Extension\MwJson\OOLD\QuantityValueMapper;
use MediaWiki\Extension\MwJson\OOLD\SemanticPropertyMapper;
use MediaWiki\Extension\MwJson\OOLD\StatementMapper;
use PHPUnit\Framework\TestCase;

/**
 * Differential test for the JSON-LD and SMW mapping layer: replays results
 * captured from the real Module:MwJson under Lua 5.1, with mw.smw stubbed to
 * record subobject writes rather than perform them.
 *
 * That stub is what makes the comparison possible at all. The Lua writes
 * subobjects partway through its traversal; the port collects them into a
 * SemanticMapping instead. Recording the Lua's calls in order lets the two be
 * compared directly, and proves the restructuring changed nothing observable.
 *
 * Fixture: tests/phpunit/Unit/fixtures/lua-semantic.json
 * Generator: tests/parity/lua/dumpSemantic.lua
 *
 * @covers \MediaWiki\Extension\MwJson\OOLD\ContextBuilder
 * @covers \MediaWiki\Extension\MwJson\OOLD\LabelHelper
 * @covers \MediaWiki\Extension\MwJson\OOLD\QuantityValueMapper
 * @covers \MediaWiki\Extension\MwJson\OOLD\SemanticPropertyMapper
 * @covers \MediaWiki\Extension\MwJson\OOLD\StatementMapper
 */
class LuaSemanticFixtureTest extends TestCase {
	use LuaFixtureTrait;

	/** Matches mw.title.getCurrentTitle() in the generator. */
	private const SUBJECT = 'Item:OSWtest';

	/**
	 * @dataProvider provideLuaCases
	 * @param mixed $expected
	 */
	public function testMatchesLua( string $fn, array $args, $expected ): void {
		switch ( $fn ) {
			case 'buildContext':
				$actual = ( new ContextBuilder() )->build( $args[0] );
				break;

			case 'getDisplayLabel':
				$actual = ( new LabelHelper() )->getDisplayLabel( $args[0], $args[1] );
				break;

			case 'setNormalizedLabel':
				$actual = ( new LabelHelper() )->setNormalizedLabel( $args[0] );
				break;

			case 'processQuantityValue':
				// The second return is the value object with the Lua's working
				// written back into it; the fixture records only the properties.
				[ $actual, ] = ( new QuantityValueMapper() )->apply( [], $args[0], $args[1] );
				break;

			case 'processStatement':
				$actual = ( new StatementMapper() )->apply( $args[0], $args[1] );
				break;

			case 'getSemanticProperties':
				$mapping = ( new SemanticPropertyMapper() )->map( $args[1], $args[0], self::SUBJECT );
				$actual = [
					'properties' => $mapping->properties,
					'definitions' => $mapping->definitions,
					'subobjects' => $mapping->subobjects,
				];
				break;

			default:
				$this->fail( "Fixture references unknown function '$fn'" );
		}

		$this->assertSame( self::canonicalize( $expected ), self::canonicalize( $actual ) );
	}

	public static function provideLuaCases(): array {
		return self::loadLuaFixture( 'lua-semantic.json' );
	}
}
