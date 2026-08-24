<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Slot and render-mode names, from p.slots and p.mode in Module:MwJson.
 *
 * The slots themselves are declared in the wiki's $wgWSSlotsDefinedSlots; these
 * constants only name the ones this pipeline reads.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
final class Slots {

	public const MAIN = 'main';
	public const JSONDATA = 'jsondata';
	public const JSONSCHEMA = 'jsonschema';
	public const HEADER_TEMPLATE = 'header_template';
	public const FOOTER_TEMPLATE = 'footer_template';
	public const DATA_TEMPLATE = 'data_template';

	public const MODE_HEADER = 'header';
	public const MODE_FOOTER = 'footer';
	public const MODE_QUERY = 'query';

	/**
	 * The per-category wikitext template slot a render mode draws from.
	 *
	 * Null for modes that have none, matching the Lua, where
	 * category_template_slot stays nil outside header/footer and
	 * mw.slots.slotContent is then called with a nil slot name.
	 */
	public static function templateSlotForMode( string $mode ): ?string {
		switch ( $mode ) {
			case self::MODE_HEADER:
				return self::HEADER_TEMPLATE;
			case self::MODE_FOOTER:
				return self::FOOTER_TEMPLATE;
			default:
				return null;
		}
	}
}
