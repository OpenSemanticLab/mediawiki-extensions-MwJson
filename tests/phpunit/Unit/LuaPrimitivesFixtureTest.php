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

	/**
	 * @dataProvider provideLuaCases
	 * @param mixed $expected
	 */
	public function testMatchesLua( string $fn, array $phpArgs, $expected ): void {
		switch ( $fn ) {
			case 'tableMerge':
				$actual = ( new LegacyLuaMergeStrategy() )->merge( $phpArgs[0], $phpArgs[1] );
				break;
			case 'splitString':
				$actual = JsonUtil::splitString( $phpArgs[0], $phpArgs[1] );
				break;
			case 'defaultArgPath':
				$actual = JsonUtil::defaultArgPath( $phpArgs[0], $phpArgs[1] ?? [], $phpArgs[2] );
				break;
			case 'nilOrEmpty':
				$actual = JsonUtil::nilOrEmpty( $phpArgs[0] );
				break;
			case 'tablefy':
				$actual = JsonUtil::tablefy( $phpArgs[0] );
				break;
			case 'tableContains':
				$actual = JsonUtil::tableContains( $phpArgs[0], $phpArgs[1] );
				break;
			case 'tableLength':
				$actual = JsonUtil::tableLength( $phpArgs[0] );
				break;
			default:
				$this->fail( "Fixture references unknown function '$fn'" );
		}

		$this->assertSame( self::canonicalize( $expected ), self::canonicalize( $actual ) );
	}

	/**
	 * Order-normalise map keys, but not list order.
	 *
	 * Lua's pairs() has no defined iteration order, so the generator sorts keys
	 * to make the fixture reproducible, which means the fixture's *map* key
	 * order is an artifact of the generator, not a fact about the Lua, and
	 * asserting on it would assert nothing. PHP's insertion order is a genuine
	 * improvement here, and is the "pairs() order" divergence recorded in the
	 * migration plan.
	 *
	 * List order is left strictly alone: it is semantic. tableMerge appending
	 * "c","d" after "a","b" is the behaviour under test, and sorting that away
	 * would hide a real regression.
	 *
	 * @param mixed $value
	 * @return mixed
	 */
	private static function canonicalize( $value ) {
		if ( !is_array( $value ) ) {
			return $value;
		}

		$list = [];
		$map = [];
		foreach ( $value as $key => $item ) {
			if ( is_int( $key ) ) {
				$list[$key] = self::canonicalize( $item );
			} else {
				$map[$key] = self::canonicalize( $item );
			}
		}

		ksort( $map, SORT_STRING );
		// Integer keys keep both their values and their relative order.
		return $list + $map;
	}

	public static function provideLuaCases(): array {
		$file = __DIR__ . '/fixtures/lua-primitives.json';
		$fixture = json_decode( file_get_contents( $file ), true, 512, JSON_THROW_ON_ERROR );

		$cases = [];
		foreach ( $fixture['cases'] as $case ) {
			$cases[$case['fn'] . ': ' . $case['name']] = [
				$case['fn'],
				$case['args'],
				$case['result'],
			];
		}
		return $cases;
	}

}
