<?php

namespace MediaWiki\Extension\MwJson\Mw;

use CoreParserFunctions;
use MediaWiki\Extension\MwJson\OOLD\ContextBuilder;
use MediaWiki\Extension\MwJson\OOLD\JsonRefExpander;
use MediaWiki\Extension\MwJson\OOLD\LabelHelper;
use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
use MediaWiki\Extension\MwJson\OOLD\MergeStrategy;
use MediaWiki\Extension\MwJson\OOLD\SchemaKeys;
use MediaWiki\Extension\MwJson\OOLD\SchemaWalker;
use MediaWiki\Extension\MwJson\OOLD\SemanticPropertyMapper;
use MediaWiki\Extension\MwJson\Render\DateFormatter;
use MediaWiki\Extension\MwJson\Render\InfoBoxRenderer;
use MediaWiki\Extension\MwJson\Render\LinkHelper;
use MediaWiki\Extension\MwJson\Render\MultilangValue;
use MediaWiki\Extension\MwJson\Render\PropertyTypeResolver;
use MediaWiki\Extension\MwJson\Render\TreeRenderer;
use MediaWiki\Extension\MwJson\Template\EmbeddedTemplateExpander;
use MediaWiki\Extension\MwJson\Template\MustacheRenderer;
use MediaWiki\MediaWikiServices;
use Parser;
use PPFrame;

/**
 * Assembles the pipeline for one parse.
 *
 * Most of it could be a service, but three pieces are bound to the parse rather
 * than the request: the preprocessor holds the live Parser and frame, the slot
 * loader memoises per page render, and the reader's language decides how
 * multilingual values resolve. So the whole graph is built per parse and the
 * cross-request caching lives in ResolvedSchemaCache instead.
 */
class PipelineFactory {

	private MergeStrategy $merge;
	private SchemaKeys $keys;

	public function __construct( ?MergeStrategy $merge = null, ?SchemaKeys $keys = null ) {
		$this->merge = $merge ?? new LegacyLuaMergeStrategy();
		$this->keys = $keys ?? new SchemaKeys();
	}

	/**
	 * @param Parser $parser The parser rendering the page.
	 * @param PPFrame $frame Its current frame.
	 */
	public function newEntityProcessor( Parser $parser, PPFrame $frame ): EntityProcessor {
		$wikitext = new ParserPreprocessor( $parser, $frame );
		$slots = $this->newSlotSource();
		$loader = new SlotJsonLoader( $slots, $this->merge );

		$multilang = new MultilangValue( $this->resolveUserLanguage( $parser ) );
		$types = new PropertyTypeResolver();
		$dates = new DateFormatter();
		$links = new LinkHelper( $wikitext );

		return new EntityProcessor(
			new SchemaWalker( $loader, $slots, $this->merge ),
			new JsonRefExpander( $loader, $this->merge ),
			new EmbeddedTemplateExpander( new MustacheRenderer(), $wikitext, $this->keys ),
			new SemanticPropertyMapper(
				$this->keys,
				$this->merge,
				new ContextBuilder( $this->keys, $this->merge )
			),
			new TreeRenderer( $multilang, $types, $dates, $links ),
			new InfoBoxRenderer( $multilang, $types, $dates ),
			$multilang,
			new LabelHelper( $this->keys ),
			$wikitext,
			$this->keys
		);
	}

	/**
	 * A loader on its own, for callers that only need to read jsondata.
	 */
	public function newSlotJsonLoader(): SlotJsonLoader {
		return new SlotJsonLoader( $this->newSlotSource(), $this->merge );
	}

	public function newSmwWriter( Parser $parser ): SmwWriter {
		return new SmwWriter( $parser );
	}

	/**
	 * Apply the display title, which is the one page-level side effect the
	 * processor cannot express as data.
	 *
	 * Goes through the same CoreParserFunctions::displaytitle() call that
	 * DisplayTitle's Lua library uses, so the validation and the
	 * $wgRestrictDisplayTitle handling stay identical.
	 */
	public function setDisplayTitle( Parser $parser, ?string $displayTitle ): void {
		if ( $displayTitle === null || $displayTitle === '' ) {
			return;
		}
		CoreParserFunctions::displaytitle( $parser, $displayTitle );
	}

	private function newSlotSource(): WsSlotSource {
		$services = MediaWikiServices::getInstance();
		return new WsSlotSource( $services->getTitleFactory(), $services->getWikiPageFactory() );
	}

	/**
	 * The reader's language.
	 *
	 * Read from the parser options rather than by expanding
	 * {{USERLANGUAGECODE}}, but through getUserLangObj() so that the parser
	 * still records the dependency and splits the parser cache by language.
	 * Without that the first reader's language would be served to everyone.
	 */
	private function resolveUserLanguage( Parser $parser ): string {
		return $parser->getOptions()->getUserLangObj()->getCode();
	}
}
