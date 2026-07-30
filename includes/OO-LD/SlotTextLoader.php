<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Reads a wiki page slot as raw text.
 *
 * The wikitext counterpart to JsonLoader, used for the per-category
 * header_template / footer_template slots. Kept separate because those slots
 * are never decoded, and because patches treat wikitext slots (whole-slot
 * replacement) differently from JSON slots (selective Overlay actions).
 *
 * @see \MediaWiki\Extension\MwJson\Mw\WsSlotSource
 */
interface SlotTextLoader {

	/**
	 * @param string $pageTitle Prefixed page title, e.g. "Category:Entity".
	 * @param string $slot Slot name.
	 * @return string|null Null when the page or the slot does not exist, which
	 *   the pipeline treats as "no template", exactly as mw.slots.slotContent
	 *   returning nil does.
	 */
	public function getText( string $pageTitle, string $slot ): ?string;
}
