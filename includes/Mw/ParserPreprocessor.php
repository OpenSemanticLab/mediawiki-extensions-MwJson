<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Extension\MwJson\Template\WikitextPreprocessor;
use Parser;
use PPFrame;

/**
 * The MediaWiki side of WikitextPreprocessor.
 *
 * Deliberately holds the live Parser and frame rather than creating its own.
 * The Lua works on `mw.getCurrentFrame()`, so template links, expensive
 * function counts, `{{USERLANGUAGECODE}}` and every other parser-cache
 * dependency are registered against the page being rendered. Preprocessing on a
 * detached parser would drop all of that and cache pages wrongly.
 */
class ParserPreprocessor implements WikitextPreprocessor {

	private Parser $parser;
	private PPFrame $frame;

	public function __construct( Parser $parser, PPFrame $frame ) {
		$this->parser = $parser;
		$this->frame = $frame;
	}

	/** @inheritDoc */
	public function preprocess( string $wikitext ): string {
		return $this->parser->recursivePreprocess( $wikitext, $this->frame );
	}

	/** @inheritDoc */
	public function preprocessWithArgs( string $wikitext, array $args ): string {
		// newChild() wants PPNodes rather than a plain array, and its first
		// parameter is the argument list, not its third. Scribunto converts
		// with newPartNodeArray() before calling newChild(), which is what
		// frame:newChild{ args = ... } does under the hood, so the same route
		// is taken here: passing the raw array leaves every {{{parameter}}}
		// unexpanded.
		$nodes = $this->parser->getPreprocessor()->newPartNodeArray( $args );
		$child = $this->frame->newChild( $nodes, false );

		return $this->parser->recursivePreprocess( $wikitext, $child );
	}

	/** @inheritDoc */
	public function expandTemplate( string $title, array $args ): string {
		$parts = [];
		foreach ( $args as $name => $value ) {
			$parts[] = is_int( $name ) ? (string)$value : $name . '=' . $value;
		}

		// Built as wikitext rather than through the preprocessor's template
		// machinery, so that redirects, template-style argument defaulting and
		// the transclusion record all behave exactly as on the page.
		$call = '{{' . $title . ( $parts === [] ? '' : '|' . implode( '|', $parts ) ) . '}}';
		return $this->parser->recursivePreprocess( $call, $this->frame );
	}

	/** @inheritDoc */
	public function callParserFunction( string $name, array $args ): string {
		$result = $this->parser->callParserFunction( $this->frame, $name, $args );

		if ( !is_array( $result ) ) {
			return (string)$result;
		}

		$result += [
			'text' => '',
			'nowiki' => false,
			'isChildObj' => false,
			'isLocalObj' => false,
			'isHTML' => false,
			'title' => false,
		];

		$text = $result['text'];

		if ( $result['isChildObj'] ) {
			$nodes = $this->parser->getPreprocessor()->newPartNodeArray( $args );
			$child = $this->frame->newChild( $nodes, $result['title'] );
			$text = $result['nowiki']
				? $child->expand( $text, PPFrame::RECOVER_ORIG )
				: $child->expand( $text );
		}

		if ( $result['isLocalObj'] && $result['nowiki'] ) {
			$text = $this->frame->expand( $text, PPFrame::RECOVER_ORIG );
			$result['isLocalObj'] = false;
		}

		// The flags are the whole point of going through this rather than
		// taking $result[0]. `#tree` returns [ html, isHTML => true ], and
		// without the strip marker that HTML is parsed again further down, so
		// the links inside an #info tooltip come out escaped instead of
		// rendered. Same handling as Scribunto's callParserFunction.
		if ( $result['isHTML'] ) {
			$text = $this->parser->insertStripItem( $text );
		} elseif ( $result['nowiki'] ) {
			$text = wfEscapeWikiText( $text );
		}

		if ( $result['isLocalObj'] ) {
			$text = $this->frame->expand( $text );
		}

		return (string)$text;
	}
}
