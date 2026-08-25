<?php

namespace MediaWiki\Extension\MwJson\OOLD\Patch;

use MediaWiki\Extension\MwJson\OOLD\JsonUtil;

/**
 * JSON Merge Patch, RFC 7396.
 *
 * Objects merge recursively, null deletes a key, and every other value
 * including an array replaces what was there. That last rule is what makes it
 * the right tool for swapping a whole list: replacing `enum` and
 * `options.enum_titles` in one patch keeps them the same length, and they are
 * matched by position.
 *
 * @see https://www.rfc-editor.org/info/rfc7396
 */
class MergePatch {

	/**
	 * @param mixed $target The document being patched.
	 * @param mixed $patch The merge patch.
	 * @return mixed
	 */
	public function apply( $target, $patch ) {
		if ( !$this->isObject( $patch, $target ) ) {
			// RFC 7396: a non-object patch replaces the target outright.
			return $patch;
		}

		if ( !is_array( $target ) || JsonUtil::hasFirstElement( $target ) ) {
			// The target is a scalar or a list where the patch is an object, so
			// there is nothing to merge into. The RFC starts from an empty
			// object here.
			$target = [];
		}

		foreach ( $patch as $key => $value ) {
			if ( $value === null ) {
				unset( $target[$key] );
				continue;
			}
			$target[$key] = $this->apply( $target[$key] ?? null, $value );
		}

		return $target;
	}

	/**
	 * Is this patch value a JSON object rather than an array or a scalar?
	 *
	 * PHP cannot tell `{}` from `[]` after json_decode( ..., true ): both are
	 * the empty array. The distinction matters, because as an object an empty
	 * patch means "change nothing here" and as an array it means "replace this
	 * with an empty list". Resolved by looking at what is being patched: an
	 * empty patch against an object is read as an object, so
	 * `{"properties": {}}` leaves properties alone instead of wiping them,
	 * which is the mistake that would otherwise be silent and destructive.
	 * Anywhere else an empty array replaces, which is what a list-valued key
	 * needs.
	 *
	 * @param mixed $patch
	 * @param mixed $target
	 */
	private function isObject( $patch, $target ): bool {
		if ( !is_array( $patch ) ) {
			return false;
		}
		if ( $patch === [] ) {
			return JsonUtil::isMap( $target );
		}
		return JsonUtil::isMap( $patch );
	}
}
