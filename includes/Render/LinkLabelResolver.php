<?php

namespace MediaWiki\Extension\MwJson\Render;

/**
 * Resolves the human-readable label a link should carry.
 *
 * Exists so LinkHelper can stay MediaWiki-free while the lookup itself is a
 * store read and a permission check. Implementations must return null rather
 * than guessing: a missing label is a valid outcome, not an error, and renders
 * as a plain link showing the raw title, which is exactly what
 * Module:Viewer/Link does today when its query comes back empty.
 *
 * @see \MediaWiki\Extension\MwJson\Mw\SmwLinkLabelResolver
 */
interface LinkLabelResolver {

	/**
	 * Announce the titles about to be asked for, so the implementation can do
	 * one round of work instead of one per link.
	 *
	 * Optional in the sense that label() must work without it. It exists
	 * because the tree renders a mean of 5 links per page and up to 1848 on the
	 * worst one, and resolving those one at a time is what made that page take
	 * 35 seconds.
	 *
	 * @param string[] $titles Prefixed titles, duplicates allowed.
	 */
	public function prefetch( array $titles ): void;

	/**
	 * Whether this resolver can answer for a target at all.
	 *
	 * Distinct from label() returning null, which means "no label exists" and
	 * legitimately renders as a plain link. A target this returns false for has
	 * not been assessed, so the caller must fall back rather than treat it as
	 * unlabelled.
	 */
	public function handles( string $title ): bool;

	/**
	 * @param string $title Prefixed title, optionally with a `#subobject`.
	 * @return string|null Null when there is no label, or when the reader may
	 *   not see the target.
	 */
	public function label( string $title ): ?string;
}
