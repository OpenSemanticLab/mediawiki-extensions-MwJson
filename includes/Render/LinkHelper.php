<?php

namespace MediaWiki\Extension\MwJson\Render;

use MediaWiki\Extension\MwJson\Render\LinkLabelResolver;
use MediaWiki\Extension\MwJson\Template\WikitextPreprocessor;

/**
 * Port of p.wrapLinkIfNs().
 *
 * Turns a bare namespaced title into a link, via the on-wiki Viewer/Link
 * template, which resolves the display label and handles subobject anchors.
 * Only the namespaces OSL links are wrapped; anything else, including plain
 * text that happens to contain a colon, is left alone.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class LinkHelper {

	/** Namespaces worth linking. Anything else is text that has a colon in it. */
	private const LINKED_NAMESPACES = [ 'Category', 'Item', 'File', 'Property' ];

	private const VIEWER_TEMPLATE = 'Viewer/Link';

	private WikitextPreprocessor $wikitext;
	private ?LinkLabelResolver $labels;

	/**
	 * @param LinkLabelResolver|null $labels Resolves labels without the wiki
	 *   template. Null keeps expanding Viewer/Link, which is one SMW query per
	 *   link and, on a SPARQLStore, one HTTP round trip each.
	 */
	public function __construct( WikitextPreprocessor $wikitext, ?LinkLabelResolver $labels = null ) {
		$this->wikitext = $wikitext;
		$this->labels = $labels;
	}

	/**
	 * Whether this value is a title worth linking, as opposed to text that
	 * happens to contain a colon.
	 *
	 * @param mixed $value
	 */
	public function isLinkable( $value ): bool {
		if ( !is_string( $value ) ) {
			return false;
		}
		if ( strpos( $value, '[[' ) !== false ) {
			// Already a link, usually because an eval_template built one.
			return false;
		}

		// ASCII letters only, matching Lua's %a, so a value like
		// "Größe: 5" is not mistaken for a namespaced title.
		if ( !preg_match( '/^([a-zA-Z]+):(.*)$/', $value, $m ) || $m[2] === '' ) {
			return false;
		}

		return in_array( $m[1], self::LINKED_NAMESPACES, true );
	}

	/**
	 * Announce values about to be rendered so the resolver can prepare in one
	 * pass, rather than paying a title lookup per link. Harmless when there is
	 * no resolver; non-linkable values are dropped rather than passed on.
	 *
	 * @param array<int,mixed> $values
	 */
	public function prefetch( array $values ): void {
		if ( $this->labels === null ) {
			return;
		}

		$titles = [];
		foreach ( $values as $value ) {
			if ( $this->isLinkable( $value ) ) {
				$titles[] = $value;
			}
		}

		if ( $titles !== [] ) {
			$this->labels->prefetch( $titles );
		}
	}

	/**
	 * @param mixed $value
	 * @return mixed The value linked, or unchanged if it is not a linkable title.
	 */
	public function wrapLinkIfNamespaced( $value ) {
		if ( !$this->isLinkable( $value ) ) {
			return $value;
		}

		// A resolver that cannot vouch for this target is not the same as one
		// reporting no label: the first has to fall back to the template, the
		// second renders a plain link, which is correct.
		if ( $this->labels === null || !$this->labels->handles( $value ) ) {
			return $this->wikitext->expandTemplate( self::VIEWER_TEMPLATE, [ 'page' => $value ] );
		}

		return $this->buildLink( $value );
	}

	/**
	 * What Module:Viewer/Link's page branch produces, without the round trip.
	 *
	 * The two rewrites are not interchangeable and their order is the module's:
	 * `Category:` gains a leading colon so the link points at the category page
	 * rather than filing the current page into it, and `File:` becomes `Media:`
	 * so the link goes to the file itself. The label is looked up under the
	 * original title, since that is the page carrying the data.
	 *
	 * A missing label yields a plain link showing the raw title, which is what
	 * the module emits when its query returns nothing, including when the
	 * reader is not permitted to see the target.
	 */
	private function buildLink( string $value ): string {
		$label = $this->labels->label( $value );

		$target = str_replace( 'Category:', ':Category:', $value );
		$target = str_replace( 'File:', 'Media:', $target );

		return $label === null || $label === ''
			? '[[' . $target . ']]'
			: '[[' . $target . '|' . $label . ']]';
	}
}
