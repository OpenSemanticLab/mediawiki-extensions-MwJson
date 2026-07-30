<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * How two JSON documents are combined when a schema is flattened against its
 * allOf ancestors.
 *
 * This is deliberately an interface with more than one implementation, because
 * the migration and the OO-LD adoption want different answers:
 *
 *  - LegacyLuaMergeStrategy reproduces Module:MwJson's p.tableMerge() exactly,
 *    quirks included. It is what strict parity is measured against.
 *  - MergePatchStrategy (added with OO-LD support) implements JSON Merge Patch
 *    (RFC 7396) with OO-LD's narrow-only constraint rule, which differs
 *    materially; most visibly, it overwrites list members where the legacy
 *    strategy concatenates them.
 *
 * Swapping the strategy is therefore a reviewed, harness-diffed change rather
 * than a rewrite of the schema walker.
 */
interface MergeStrategy {

	/**
	 * Merge $source into $target and return the result.
	 *
	 * Implementations must not mutate their arguments; PHP array value
	 * semantics make that free, and the Lua original's in-place mutation is a
	 * frequent source of aliasing bugs that there is no reason to inherit.
	 *
	 * @param mixed $target Merged into. Scalars and null are accepted.
	 * @param mixed $source Merged from. Scalars and null are accepted.
	 */
	public function merge( $target, $source ): array;
}
