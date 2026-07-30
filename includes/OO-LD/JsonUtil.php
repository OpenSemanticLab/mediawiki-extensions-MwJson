<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Faithful PHP ports of the table primitives in Module:MwJson.
 *
 * These exist to reproduce the Lua semantics *exactly*, quirks included, so the
 * migration can be verified by diffing output rather than by reasoning. Where a
 * quirk is surprising it is called out; do not "fix" one without a parity run.
 *
 * Representation: JSON is decoded with json_decode($s, true), so JSON objects
 * are string-keyed arrays and JSON arrays are 0-based integer-keyed lists. Lua's
 * 1-based indices therefore shift by one, but since both sides of a merge come
 * from the same decoder the *relative* order is preserved, which is all the
 * algorithms depend on.
 *
 * Deliberately absent: an equivalent of Lua's p.copy(). PHP arrays have value
 * semantics, so plain assignment already deep-copies. The Lua code needs p.copy()
 * only because Lua tables are references.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class JsonUtil {

	/**
	 * Lua: `t[1] ~= nil`, the module's inline "is this a list?" test.
	 *
	 * NOTE this is *not* array_is_list(): for an empty array Lua's test is
	 * false (there is no element 1) while array_is_list([]) is true. Several
	 * call sites branch on exactly that difference, so use this, and see
	 * isMap() for the other half of the distinction.
	 *
	 * @param mixed $value
	 */
	public static function hasFirstElement( $value ): bool {
		return is_array( $value ) && array_key_exists( 0, $value );
	}

	/**
	 * Lua: `p.tableLength(v) > 0 and v[1] == nil`, non-empty with no element 1,
	 * i.e. a key/value object rather than a list.
	 *
	 * An empty array is neither a map by this test nor a list by
	 * hasFirstElement(); the Lua code routes it down the list branch.
	 *
	 * @param mixed $value
	 */
	public static function isMap( $value ): bool {
		return is_array( $value ) && $value !== [] && !array_key_exists( 0, $value );
	}

	/**
	 * Lua: p.defaultArg( arg, default ). The default only substitutes for nil.
	 *
	 * False, 0 and '' are values, not absences.
	 *
	 * @param mixed $value
	 * @param mixed $default
	 * @return mixed
	 */
	public static function defaultArg( $value, $default = null ) {
		return $value ?? $default;
	}

	/**
	 * Lua: p.defaultArgPath( arg, path, default ). Walks a key path, falling
	 * back to $default as soon as a level is missing.
	 *
	 * Lua tolerates indexing a string (it yields nil via the string metatable),
	 * which is why a non-array encountered mid-path yields the default rather
	 * than an error.
	 *
	 * @param mixed $value
	 * @param array<int,string|int> $path
	 * @param mixed $default
	 * @return mixed
	 */
	public static function defaultArgPath( $value, array $path, $default = null ) {
		foreach ( $path as $key ) {
			if ( !is_array( $value ) || !array_key_exists( $key, $value ) ) {
				return $default;
			}
			$value = $value[$key];
		}
		return $value ?? $default;
	}

	/**
	 * Lua: p.splitString( inputstr, sep ) via `string.gmatch( s, "([^sep]+)" )`.
	 *
	 * $separators is a *set of characters*, not a delimiter string, because the Lua
	 * pattern puts it inside a character class. Two consequences the callers
	 * rely on: runs of separators collapse, and empty fields never appear.
	 * "label**" splits on "*" to [ "label" ]; "a::b" splits on ":" to
	 * [ "a", "b" ].
	 *
	 * @return string[]
	 */
	public static function splitString( string $input, string $separators = ';' ): array {
		if ( $separators === '' ) {
			return $input === '' ? [] : [ $input ];
		}

		$set = array_flip( str_split( $separators ) );
		$parts = [];
		$current = '';
		$length = strlen( $input );

		for ( $i = 0; $i < $length; $i++ ) {
			$char = $input[$i];
			if ( isset( $set[$char] ) ) {
				if ( $current !== '' ) {
					$parts[] = $current;
					$current = '';
				}
			} else {
				$current .= $char;
			}
		}
		if ( $current !== '' ) {
			$parts[] = $current;
		}

		return $parts;
	}

	/**
	 * Lua: p.nilOrEmpty( o ). True for nil, the empty string, or an empty table.
	 *
	 * Note 0 and false are *not* empty, so this is not PHP's empty().
	 *
	 * @param mixed $value
	 */
	public static function nilOrEmpty( $value ): bool {
		return $value === null || $value === '' || $value === [];
	}

	/**
	 * Lua: p.tablefy( o ). Nil becomes [], a scalar becomes a one-element list.
	 *
	 * @param mixed $value
	 */
	public static function tablefy( $value ): array {
		if ( $value === null ) {
			return [];
		}
		return is_array( $value ) ? $value : [ $value ];
	}

	/**
	 * Lua: p.tableContains( tab, val ). Uses ipairs, so only the contiguous list
	 * part is searched, and comparison is strict (Lua never coerces across
	 * types for ==).
	 *
	 * @param mixed $needle
	 */
	public static function tableContains( array $haystack, $needle ): bool {
		foreach ( self::listPart( $haystack ) as $value ) {
			if ( $value === $needle ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Lua: p.tableLength( t ). Counts every pair, list part and map part alike.
	 */
	public static function tableLength( array $table ): int {
		return count( $table );
	}

	/**
	 * The contiguous 0..n-1 run that Lua's ipairs() would walk, stopping at the
	 * first hole exactly as ipairs does.
	 *
	 * @return array<int,mixed>
	 */
	public static function listPart( array $table ): array {
		$list = [];
		for ( $i = 0; array_key_exists( $i, $table ); $i++ ) {
			$list[] = $table[$i];
		}
		return $list;
	}
}
