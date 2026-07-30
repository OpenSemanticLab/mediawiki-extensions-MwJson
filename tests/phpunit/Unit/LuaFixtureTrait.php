<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

/**
 * Shared plumbing for the tests that replay results captured from the real
 * Module:MwJson under Lua 5.1.
 *
 * @see tests/parity/lua/
 */
trait LuaFixtureTrait {

	/**
	 * @return array<string,array> PHPUnit data set name => [ fn, args, result ]
	 */
	private static function loadLuaFixture( string $name ): array {
		$file = __DIR__ . '/fixtures/' . $name;
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

	/**
	 * Order-normalise map keys, but not list order.
	 *
	 * Lua's pairs() has no defined iteration order, so the generator sorts keys
	 * to make the fixture reproducible. That makes the fixture's *map* key
	 * order an artifact of the generator rather than a fact about the Lua, and
	 * asserting on it would assert nothing. PHP's insertion order is a genuine
	 * improvement, and is the "pairs() order" divergence recorded in the
	 * migration plan.
	 *
	 * List order is left strictly alone: it is semantic. tableMerge appending
	 * to a list is the behaviour under test, and sorting that away would hide a
	 * real regression.
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
			// Assigning nil to a Lua table key removes it, so the language
			// cannot represent a null-valued member and the fixture never
			// contains one. Dropping them on the PHP side makes "absent" and
			// "null" compare equal, which is the actual relationship between
			// the two representations. It stays a strict comparison: a key the
			// Lua does hold a value for still fails against a PHP null,
			// because dropping the null leaves the key missing.
			if ( $item === null ) {
				continue;
			}
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
}
