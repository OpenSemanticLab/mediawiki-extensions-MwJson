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
		// Strip marker sequences (\x7f'"`UNIQ--item-1a--QINU`"'\x7f) whose
		// counters depend on parse order within the request.
		$html = preg_replace( '/\x7f?\'?"?`?UNIQ--[^\x7f]*?QINU`?"?\'?\x7f?/', '<!--UNIQ-->', $html );

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
}
