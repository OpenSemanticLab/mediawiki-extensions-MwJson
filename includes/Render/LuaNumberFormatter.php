<?php

namespace MediaWiki\Extension\MwJson\Render;

/**
 * Formats numbers the way Lua's tostring() does.
 *
 * Both renderers put numbers straight into wikitext, and Lua gets there via
 * tostring(), which is `%.14g` from C. PHP's `%g` is its own implementation and
 * differs in two ways, so a quantity of 1e-06 would render as "1.0e-6" instead
 * of "1e-06" and show up as a diff on every page carrying one:
 *
 *   value      PHP %.14g    C / Lua %.14g
 *   1e-6       1.0e-6       1e-06
 *   1e15       1.0e+15      1e+15
 *   -3.5e-9    -3.5e-9      -3.5e-09
 *
 * That is: PHP keeps a redundant ".0" on the mantissa, and does not pad the
 * exponent to two digits.
 */
class LuaNumberFormatter {

	/**
	 * @param mixed $value
	 */
	public static function format( $value ): string {
		if ( is_int( $value ) ) {
			return (string)$value;
		}
		if ( !is_float( $value ) ) {
			return is_scalar( $value ) ? (string)$value : '';
		}

		$formatted = sprintf( '%.14g', $value );

		if ( !preg_match( '/^(-?\d+)(?:\.(\d+))?e([+-])(\d+)$/i', $formatted, $m ) ) {
			// No exponent, so PHP and C agree.
			return $formatted;
		}

		$mantissa = $m[1];
		// Keep real decimals, drop a mantissa that is only ".0".
		if ( isset( $m[2] ) && $m[2] !== '' && rtrim( $m[2], '0' ) !== '' ) {
			$mantissa .= '.' . $m[2];
		}

		return $mantissa . 'e' . $m[3] . str_pad( $m[4], 2, '0', STR_PAD_LEFT );
	}
}
