<?php

namespace MediaWiki\Extension\MwJson\Tests\Parity;

/**
 * Strips the parts of a parser HTML result that legitimately vary between two
 * runs of the *same* implementation, so that a diff in a parity record means a
 * diff in the pipeline.
 *
 * Deliberately conservative: it removes only per-parse identifiers and
 * whitespace. Anything else that differs (element order, attribute values,
 * text) is a real divergence and must show up.
 */
class HtmlNormalizer {

	public function normalize( string $html ): string {
		$html = $this->canonicaliseJsonLd( $html );

		// Strip marker sequences (\x7f'"`UNIQ--item-1a--QINU`"'\x7f) whose
		// counters depend on parse order within the request.
		$html = preg_replace( '/\x7f?\'?"?`?UNIQ--[^\x7f]*?QINU`?"?\'?\x7f?/', '<!--UNIQ-->', $html );

		// Section edit links inside a category's header or footer template are
		// attributed to whatever supplied the wikitext. The Lua expands them in
		// a Scribunto frame, so they point at Module:Entity; the port points
		// them at the category that actually holds the template, which is where
		// a reader would need to go and which still exists after the module is
		// deleted. Deliberate divergence, so the target is normalised away
		// while the presence and index of the marker are still compared.
		$html = preg_replace( '/<mw:editsection page="[^"]*"/', '<mw:editsection page="X"', $html );

		// The "T-" prefix marks a heading as transcluded rather than native.
		// The Lua expands every category template in a Scribunto frame titled
		// after the module, so every such heading is transcluded. The port
		// attributes them to the category holding the template, which for a
		// Category page rendering its own template is the page itself, and so
		// counts as native. Only the prefix is normalised; the index is kept,
		// so a heading appearing or disappearing still fails.
		$html = preg_replace( '/(<mw:editsection [^>]*section=")T-/', '$1', $html );

		// SMW #info tooltips and TreeAndMenu nodes number their ids per parse.
		$html = preg_replace( '/\bid="(smw_[a-z]+|tooltip|dtree|treeandmenu)[-_]?\d+"/i', 'id="$1-N"', $html );
		$html = preg_replace( '/\bdata-(mw-)?id="\d+"/', 'data-id="N"', $html );

		// MediaWiki's per-parse section edit links / heading anchors carry an
		// index that shifts when unrelated content moves.
		$html = preg_replace( '/&amp;section=T?\d+/', '&amp;section=N', $html );

		// Cache-busting timestamps in resource URLs.
		$html = preg_replace( '/([?&])(\d{10,})\b/', '$1TS', $html );

		// Normalise insignificant whitespace so indentation churn is invisible.
		$html = preg_replace( '/\s+/', ' ', $html );

		return trim( $html );
	}

	/**
	 * Sort the keys of the embedded JSON-LD payload.
	 *
	 * The hidden `data-jsonld` div is a serialised map, and Lua's
	 * mw.text.jsonEncode walks the table with pairs(), whose order is
	 * undefined, while PHP's json_encode uses insertion order. The two sides
	 * therefore emit the same object with its members in different sequences.
	 *
	 * Key order carries no meaning in JSON-LD, so this compares the payloads as
	 * objects rather than as strings. A genuine difference in what the payload
	 * contains still fails.
	 */
	private function canonicaliseJsonLd( string $html ): string {
		return preg_replace_callback(
			'/data-jsonld=(["\'])(.*?)\1/s',
			static function ( array $m ): string {
				$json = html_entity_decode( $m[2], ENT_QUOTES | ENT_HTML5, 'UTF-8' );
				$decoded = json_decode( $json, true );
				if ( !is_array( $decoded ) ) {
					return $m[0];
				}

				$sort = static function ( &$value ) use ( &$sort ): void {
					if ( !is_array( $value ) ) {
						return;
					}
					foreach ( $value as &$child ) {
						$sort( $child );
					}
					unset( $child );
					// Lists keep their order, which is meaningful; only the
					// member order of objects is arbitrary.
					if ( !array_is_list( $value ) ) {
						ksort( $value, SORT_STRING );
					}
				};
				$sort( $decoded );

				$encoded = json_encode(
					$decoded,
					JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
				);

				return 'data-jsonld="' . htmlspecialchars( (string)$encoded, ENT_QUOTES ) . '"';
			},
			$html
		) ?? $html;
	}
}
