<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Resolves a wiki page slot to decoded JSON.
 *
 * The seam between the pure schema logic and MediaWiki. Everything under
 * includes/OO-LD depends on this interface rather than on WSSlots or Title, so
 * the schema walker and the $ref expander are testable with a plain array of
 * fixture pages and no wiki.
 *
 * It is also the point where slot patches enter: PatchingSlotSource decorates
 * the implementation rather than any of its callers.
 *
 * @see \MediaWiki\Extension\MwJson\Mw\SlotJsonLoader
 */
interface JsonLoader {

	/**
	 * Load and decode one slot of one page.
	 *
	 * Missing pages, missing slots and undecodable content all yield an empty
	 * array, matching p.loadJson(), which initialises `json = {}` and only
	 * overwrites it when the slot has content. Callers therefore cannot tell a
	 * missing page from an empty one; nothing in the pipeline needs to.
	 *
	 * @param string $pageTitle Prefixed page title, e.g. "Category:Entity".
	 * @param string|null $slot Slot name, or null for the main slot.
	 */
	public function load( string $pageTitle, ?string $slot = null ): array;
}
