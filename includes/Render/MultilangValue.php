<?php

namespace MediaWiki\Extension\MwJson\Render;

/**
 * Ports p.renderMultilangValue() and p.applyMultilangFallback().
 *
 * OSL writes annotations in two shapes: a schema uses `title` plus a `title*`
 * language map, and instance data uses a list of `{ text, lang }` objects. Both
 * resolve the same way, preferring the reader's language, then English, then
 * whatever default the caller supplies.
 *
 * The language code is injected rather than read here, so this class stays
 * MediaWiki-free. The caller has to obtain it through the same
 * {{USERLANGUAGECODE}} path the Lua uses, or the parser cache will not split by
 * language the way it does today.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class MultilangValue {

	private string $language;

	public function __construct( string $language = 'en' ) {
		$this->language = $language;
	}

	/**
	 * Resolve an annotation for the reader's language.
	 *
	 * Note both sources are consulted and the schema is read first, so instance
	 * data overrides a schema annotation of the same key rather than the other
	 * way round.
	 *
	 * @param array $jsonschema Schema node, read for `<key>` and `<key>*`.
	 * @param array $jsondata Instance node, read for a `{ text, lang }` list.
	 * @param string $key Annotation name, "title" by default.
	 * @param string $default Used when neither the language nor English matches.
	 */
	public function render(
		array $jsonschema = [],
		array $jsondata = [],
		string $key = 'title',
		string $default = ''
	): string {
		$localized = null;
		$english = null;

		// A plain string annotation carries no language, and is treated as the
		// English fallback rather than as a match for the reader's language.
		if ( isset( $jsonschema[$key] ) && is_string( $jsonschema[$key] ) ) {
			$english = $jsonschema[$key];
		}

		if ( isset( $jsonschema[$key . '*'] ) && is_array( $jsonschema[$key . '*'] ) ) {
			foreach ( $jsonschema[$key . '*'] as $language => $text ) {
				if ( $language === $this->language ) {
					$localized = $text;
				}
				if ( $language === 'en' ) {
					$english = $text;
				}
			}
		}

		if ( isset( $jsondata[$key] ) && is_array( $jsondata[$key] ) ) {
			foreach ( $jsondata[$key] as $entry ) {
				if ( !is_array( $entry ) || !isset( $entry['lang'], $entry['text'] ) ) {
					continue;
				}
				if ( $entry['lang'] === $this->language ) {
					$localized = $entry['text'];
				}
				if ( $entry['lang'] === 'en' ) {
					$english = $entry['text'];
				}
			}
		}

		return (string)( $localized ?? $english ?? $default );
	}

	/**
	 * Fill in a value that rendered empty for the reader's language.
	 *
	 * The `eval_template` for label and description expands to a
	 * `{{#switch:{{USERLANGUAGECODE}}}}` that yields nothing when the page has
	 * no text in that language. This substitutes the English text, or the first
	 * available one, so the tree, infobox, subtitle and page title still show
	 * something.
	 *
	 * @param array $jsondata The rendered data, patched in place.
	 * @param mixed $source The original multilang list, before rendering.
	 * @return array{0:array,1:?string} The patched data and the chosen
	 *   fallback, which the caller reuses for the scalar template arguments.
	 */
	public function applyFallback( array $jsondata, $source, string $key ): array {
		$fallback = null;

		if ( is_array( $source ) ) {
			foreach ( $source as $entry ) {
				if ( !is_array( $entry ) || !isset( $entry['text'] ) ) {
					continue;
				}
				if ( ( $entry['lang'] ?? null ) === 'en' ) {
					$fallback = $entry['text'];
					break;
				}
				$fallback ??= $entry['text'];
			}
		}

		$rendered = $jsondata[$key] ?? null;
		$isEmpty = $rendered === null
			|| ( is_string( $rendered ) && trim( $rendered ) === '' );

		if ( $isEmpty && $fallback !== null ) {
			$jsondata[$key] = $fallback;
		}

		return [ $jsondata, $fallback ];
	}
}
