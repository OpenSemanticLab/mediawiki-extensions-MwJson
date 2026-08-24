<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\OOLD\JsonUtil;
use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
use PHPUnit\Framework\TestCase;

/**
 * Differential test: replays results captured from the *real* Module:MwJson
 * source, executed under the same Lua 5.1 that Scribunto's luastandalone engine
 * uses, against the PHP port.
 *
 * The other unit tests encode what the port is believed to do; this one encodes
 * what the Lua actually does. When they disagree, the Lua wins.
 *
 * Fixture: tests/phpunit/Unit/fixtures/lua-primitives.json
 * Generator: tests/parity/lua/dumpPrimitives.lua (see its header to regenerate)
 *
 * @covers \MediaWiki\Extension\MwJson\OOLD\JsonUtil
 * @covers \MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy
 */
class LuaPrimitivesFixtureTest extends TestCase {
	use LuaFixtureTrait;

	/**
	 * @dataProvider provideLuaCases
	 * @param mixed $expected
	 */
	public function testMatchesLua( string $fn, array $args, $expected ): void {
		switch ( $fn ) {
			case 'tableMerge':
				$actual = ( new LegacyLuaMergeStrategy() )->merge( $args[0], $args[1] );
				break;
			case 'splitString':
				$actual = JsonUtil::splitString( $args[0], $args[1] );
				break;
			case 'defaultArgPath':
				$actual = JsonUtil::defaultArgPath( $args[0], $args[1] ?? [], $args[2] );
				break;
			case 'nilOrEmpty':
				$actual = JsonUtil::nilOrEmpty( $args[0] );
				break;
			case 'tablefy':
				$actual = JsonUtil::tablefy( $args[0] );
				break;
			case 'tableContains':
				$actual = JsonUtil::tableContains( $args[0], $args[1] );
				break;
			case 'tableLength':
				$actual = JsonUtil::tableLength( $args[0] );
				break;
			default:
				$this->fail( "Fixture references unknown function '$fn'" );
		}

		$this->assertSame( self::canonicalize( $expected ), self::canonicalize( $actual ) );
	}

	public static function provideLuaCases(): array {
		return self::loadLuaFixture( 'lua-primitives.json' );
	}
}
