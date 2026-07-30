<?php

namespace MediaWiki\Extension\MwJson\Render;

/**
 * Port of p.formatDate().
 *
 * Emits wikitext rather than a formatted string, so that the reader's date
 * preferences and time zone apply at parse time rather than the editor's at
 * save time.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class DateFormatter {

	/**
	 * @param mixed $value The raw date value.
	 * @param string $type A PropertyTypeResolver constant.
	 * @param string|null $smwProperty The SMW property the value is stored
	 *   under, when there is one. Only date-times use it, and only they can:
	 *   SMW's #LOCL#TO output converts to the reader's time zone, which
	 *   #dateformat cannot do.
	 * @return mixed Wikitext for date types, the value untouched otherwise.
	 */
	public function format( $value, string $type, ?string $smwProperty = null ) {
		if ( $type === PropertyTypeResolver::DATE ) {
			return '{{#dateformat:' . $value . '|ymd}}';
		}

		if ( $type !== PropertyTypeResolver::DATE_TIME ) {
			return $value;
		}

		if ( $smwProperty !== null ) {
			return '{{#ask: [[{{FULLPAGENAME}}]]|?' . $smwProperty
				. '#LOCL#TO= |format=plain |mainlabel=-}}';
		}

		// Split "2024-01-15T10:30:00" into date, hours and minutes. The pattern
		// is the Lua's, translated: greedy captures that backtrack to the last
		// separator that still lets the rest match.
		if ( !preg_match( '/(\S+)[T ](\S+):(\S+)[:?]/', (string)$value, $m ) ) {
			// No parsable time part, so a date-only or non-ISO value that
			// happens to be typed as a date-time. Format the date and say
			// nothing about time zones.
			return '{{#dateformat:' . $value . '|ymd}}';
		}

		// Without a semantic property there is no way to convert to the
		// reader's time zone, so the value is shown as UTC with a note saying
		// how to enable conversion.
		return '{{#dateformat:' . $m[1] . '|ymd}} ' . $m[2] . ':' . $m[3]
			. ' (UTC){{#info: Specify a semantic property in the schema for time zone conversion |note }}';
	}
}
