<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Byte-for-byte port of Module:MwJson's p.tableMerge().
 *
 * This function is the semantic core of OSL's schema inheritance: every
 * Category in an allOf chain is merged into the child schema with it, so any
 * deviation here silently changes every page on the wiki. It is ported
 * literally, including behaviour that is arguably wrong, and is only replaced
 * via MergeStrategy once a parity run says what the replacement changes.
 *
 * The original:
 *
 *     function p.tableMerge(t1, t2)
 *         if (t1 == nil) then t1 = {} elseif (type(t1) ~= 'table') then t1 = {t1} end
 *         if (t2 == nil) then t2 = {} elseif (type(t2) ~= 'table') then t2 = {t2} end
 *         for k,v in pairs(t2) do
 *             if type(v) == "table" then
 *                 if type(t1[k] or false) == "table" then
 *                     p.tableMerge(t1[k] or {}, t2[k] or {})
 *                 else
 *                     if type(k) == 'number' then table.insert(t1, v)
 *                     else t1[k] = v end
 *                 end
 *             else
 *                 if type(k) == 'number' then table.insert(t1, v)
 *                 else t1[k] = v end
 *             end
 *         end
 *         return t1
 *     end
 *
 * Three behaviours worth knowing before you read any calling code:
 *
 *  1. **Integer keys append, they do not overwrite.** Merging two lists
 *     concatenates them. This is why merging a schema chain accumulates enum
 *     values and required[] entries instead of the most-derived one winning,
 *     the opposite of what RFC 7396 (and therefore OO-LD) prescribes.
 *  2. **Except when both sides are arrays at the same index**, in which case
 *     they merge element-wise by position instead of appending. So merging
 *     [["a"],["b"]] with [["c"]] yields [["a","c"],["b"]], not
 *     [["a"],["b"],["c"]].
 *  3. **Scalars are promoted to one-element lists**, so merging "x" with "y"
 *     yields ["x", "y"].
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class LegacyLuaMergeStrategy implements MergeStrategy {

	/** @inheritDoc */
	public function merge( $target, $source ): array {
		$target = $this->tablefyForMerge( $target );
		$source = $this->tablefyForMerge( $source );

		foreach ( $source as $key => $value ) {
			$existing = $target[$key] ?? null;

			if ( is_array( $value ) && is_array( $existing ) ) {
				// Both sides are tables: recurse in place, by key, including
				// for integer keys, which is quirk (2) above.
				$target[$key] = $this->merge( $existing, $value );
				continue;
			}

			if ( is_int( $key ) ) {
				// Lua's table.insert(t1, v): append, never assign at $key.
				$target[] = $value;
			} else {
				$target[$key] = $value;
			}
		}

		return $target;
	}

	/**
	 * Lua's `if (t == nil) then t = {} elseif (type(t) ~= 'table') then t = {t} end`.
	 *
	 * @param mixed $value
	 */
	private function tablefyForMerge( $value ): array {
		if ( $value === null ) {
			return [];
		}
		return is_array( $value ) ? $value : [ $value ];
	}
}
