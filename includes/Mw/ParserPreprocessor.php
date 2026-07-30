<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Extension\MwJson\Template\WikitextPreprocessor;
use MediaWiki\MediaWikiServices;
use Parser;
use PPFrame;
use Title;

/**
 * The MediaWiki side of WikitextPreprocessor.
 *
 * Deliberately holds the live Parser and frame rather than creating its own.
 * The Lua works on `mw.getCurrentFrame()`, so template links, expensive
 * function counts, `{{USERLANGUAGECODE}}` and every other parser-cache
 * dependency are registered against the page being rendered. Preprocessing on a
 * detached parser would drop all of that and cache pages wrongly.
 *
 * ## Why not Parser::recursivePreprocess()
 *
 * Because it ends with `$this->mStripState->unstripBoth( $text )`, which
 * expands every strip marker back into raw HTML. Anything that returned HTML
 * through a strip marker, `#tree` above all, would then be sitting in the
 * wikitext as literal markup and get escaped by the next parse: the links
 * inside an SMW `#info` tooltip came out as `&lt;a&gt;`.
 *
 * Scribunto's frame:preprocess does not unstrip. It runs preprocessToObj()
 * followed by $frame->expand(), and that is what is reproduced here, so markers
 * survive to the end of the parse and are expanded once, by the parser, at the
 * right time.
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
		return $this->expandIn( $this->frame, $wikitext );
	}

	/** @inheritDoc */
	public function preprocessWithArgs(
		string $wikitext,
		array $args,
		?string $contextTitle = null
	): string {
		// newChild() takes its argument list first, not third, and wants
		// PPNodes rather than a plain array. Passing the array leaves every
		// {{{parameter}}} unexpanded.
		$nodes = $this->parser->getPreprocessor()->newPartNodeArray( $args );

		$title = false;
		if ( $contextTitle !== null ) {
			$title = MediaWikiServices::getInstance()->getTitleFactory()
				->newFromText( $contextTitle ) ?? false;
		}

		return $this->expandIn( $this->frame->newChild( $nodes, $title ), $wikitext );
	}

	/** @inheritDoc */
	public function expandTemplate( string $title, array $args ): string {
		$templateTitle = MediaWikiServices::getInstance()->getTitleFactory()
			->newFromText( $title, NS_TEMPLATE );
		if ( $templateTitle === null ) {
			return '';
		}

		// Through getTemplateDom() rather than by building "{{Title|args}}" and
		// expanding that, so an argument containing a pipe or an equals sign
		// cannot change the shape of the call, and so redirects and the
		// transclusion record behave as they do on the page.
		[ $dom, $finalTitle ] = $this->parser->getTemplateDom( $templateTitle );
		if ( $dom === false ) {
			return '';
		}
		if ( !$this->frame->loopCheck( $finalTitle ) ) {
			return '<span class="error">Template loop detected: ' . htmlspecialchars( $title ) . '</span>';
		}

		$nodes = $this->parser->getPreprocessor()->newPartNodeArray( $args );
		return $this->frame->newChild( $nodes, $finalTitle )->expand( $dom );
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
		// the links inside an #info tooltip come out escaped.
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

	/**
	 * Expand wikitext in a frame without unstripping, matching Scribunto's
	 * doCachedExpansion().
	 */
	private function expandIn( PPFrame $frame, string $wikitext ): string {
		$normalised = str_replace( [ "\r\n", "\r" ], "\n", $wikitext );

		$dom = $this->parser->getPreprocessor()->preprocessToObj(
			$normalised,
			$frame->depth ? Parser::PTD_FOR_INCLUSION : 0
		);

		return $frame->expand( $dom );
	}
}
