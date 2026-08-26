<?php

namespace MediaWiki\Extension\MwJson\OOLD\Patch;

/**
 * A patch payload that may have been written as text.
 *
 * A merge patch and an overlay update are arbitrary JSON, and json-editor has
 * no control for that as an object: `format` on an object type selects a
 * layout, not a renderer, so an object with no declared properties renders as
 * an empty box. The control it does have is a string with `format: "json"`,
 * which is an ace editor with a JSON worker validating as you type, and which
 * this wiki already configures.
 *
 * So the schema asks for a string and the payload arrives as text. Older
 * patches, written before that, hold a real object. Both are accepted: which
 * one a patch carries says nothing about what it means.
 */
class JsonValue {

	/**
	 * @param mixed $value
	 * @return mixed The decoded payload, or the value unchanged when it is not
	 *   text that parses. A string that is not JSON is returned as itself,
	 *   since an overlay update may legitimately be a bare string.
	 */
	public static function decode( $value ) {
		if ( !is_string( $value ) ) {
			return $value;
		}

		$trimmed = trim( $value );
		if ( $trimmed === '' ) {
			return $value;
		}

		$decoded = json_decode( $trimmed, true );
		return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
	}
}
