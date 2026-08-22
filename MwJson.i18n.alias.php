<?php

/**
 * Special page aliases for MwJson.
 *
 * MediaWiki resolves a special page's canonical name through this list. Without
 * it SpecialPageFactory cannot map "SlotResolver" back to a local name, which
 * it reports as "Did not find alias for special page" the moment anything asks
 * for the page's own title.
 *
 * @file
 */

$specialPageAliases = [];

/** English (English) */
$specialPageAliases['en'] = [
	'SlotResolver' => [ 'SlotResolver', 'Slot resolver' ],
];

/** Deutsch (German) */
$specialPageAliases['de'] = [
	'SlotResolver' => [ 'Slot-Aufloeser', 'SlotResolver' ],
];
