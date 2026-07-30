<?php

namespace MediaWiki\Extension\MwJson\Render;

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

	public function __construct( WikitextPreprocessor $wikitext ) {
		$this->wikitext = $wikitext;
	}

	/**
	 * @param mixed $value
	 * @return mixed The value linked, or unchanged if it is not a linkable title.
	 */
	public function wrapLinkIfNamespaced( $value ) {
		if ( !is_string( $value ) ) {
			return $value;
		}
		if ( strpos( $value, '[[' ) !== false ) {
			// Already a link, usually because an eval_template built one.
			return $value;
		}

		// ASCII letters only, matching Lua's %a, so a value like
		// "Größe: 5" is not mistaken for a namespaced title.
		if ( !preg_match( '/^([a-zA-Z]+):(.*)$/', $value, $m ) || $m[2] === '' ) {
			return $value;
		}

		if ( !in_array( $m[1], self::LINKED_NAMESPACES, true ) ) {
			return $value;
		}

		return $this->wikitext->expandTemplate( self::VIEWER_TEMPLATE, [ 'page' => $value ] );
	}
}
