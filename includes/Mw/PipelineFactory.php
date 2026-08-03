<?php

namespace MediaWiki\Extension\MwJson\Mw;

use CoreParserFunctions;
use MediaWiki\Extension\MwJson\OOLD\ContextBuilder;
use MediaWiki\Extension\MwJson\OOLD\JsonRefExpander;
use MediaWiki\Extension\MwJson\OOLD\LabelHelper;
use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
use MediaWiki\Extension\MwJson\OOLD\MergeStrategy;
use MediaWiki\Extension\MwJson\OOLD\SchemaKeys;
use MediaWiki\Extension\MwJson\OOLD\SchemaResolver;
use MediaWiki\Extension\MwJson\OOLD\SchemaWalker;
use MediaWiki\Extension\MwJson\OOLD\SemanticPropertyMapper;
use MediaWiki\Extension\MwJson\Render\DateFormatter;
use MediaWiki\Extension\MwJson\Render\InfoBoxRenderer;
use MediaWiki\Extension\MwJson\Render\LinkHelper;
use MediaWiki\Extension\MwJson\Render\MultilangValue;
use MediaWiki\Extension\MwJson\Render\PropertyTypeResolver;
use MediaWiki\Extension\MwJson\Render\TreeRenderer;
use MediaWiki\Extension\MwJson\Template\EmbeddedTemplateExpander;
use MediaWiki\Extension\MwJson\Template\LegacyTemplateBypass;
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

		// The collector has to sit under the slot source, so that every read the
		// walk performs is recorded and can be revalidated on a later request.
		$dependencies = new SlotDependencies();
		$slots = $this->newSlotSource( $dependencies );
		$loader = new SlotJsonLoader( $slots, $this->merge );

		$multilang = new MultilangValue( $this->resolveUserLanguage( $parser ) );
		$types = new PropertyTypeResolver();
		$dates = new DateFormatter();
		$links = new LinkHelper( $wikitext, $this->newLinkLabelResolver( $parser ) );

		$title = $parser->getTitle();

		return new EntityProcessor(
			$this->newSchemaResolver( $loader, $slots, $dependencies, $title ),
			new JsonRefExpander( $loader, $this->merge ),
			new EmbeddedTemplateExpander(
				$this->newMustacheRenderer(),
				$wikitext,
				$this->keys,
				null,
				$this->bypassLegacyTemplates() ? new LegacyTemplateBypass() : null,
				$multilang
			),
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

	/**
	 * A renderer whose compiled templates outlive the request.
	 *
	 * Uses $wgCacheDirectory when the wiki has one, since that is the directory
	 * an operator already expects to hold generated code and to clear. Falls
	 * back to the system temp directory, and to no cache at all if neither is
	 * writable, in which case rendering still works and only pays more.
	 */
	private function newMustacheRenderer(): MustacheRenderer {
		$configured = MediaWikiServices::getInstance()->getMainConfig()->get( 'CacheDirectory' );
		$base = is_string( $configured ) && $configured !== '' ? $configured : sys_get_temp_dir();
		$directory = $base . '/mwjson-mustache';

		if ( !is_dir( $directory ) && !@mkdir( $directory, 0777, true ) && !is_dir( $directory ) ) {
			return new MustacheRenderer();
		}
		if ( !is_writable( $directory ) ) {
			return new MustacheRenderer();
		}

		return new MustacheRenderer( MustacheRenderer::ESCAPE_SLASH, $directory );
	}

	/**
	 * The label resolver, or null to keep expanding the wiki template.
	 *
	 * Needs the parser for two things: the reader identity the permission check
	 * is made against, and the ParserOutput, since a label that depends on who
	 * is reading must not be stored in the parser cache.
	 */
	private function newLinkLabelResolver( Parser $parser ): ?SmwLinkLabelResolver {
		$services = MediaWikiServices::getInstance();
		if ( !$services->getMainConfig()->get( 'MwJsonResolveLinkLabels' ) ) {
			return null;
		}
		if ( !class_exists( \SMW\StoreFactory::class ) ) {
			return null;
		}

		return new SmwLinkLabelResolver(
			\SMW\StoreFactory::getStore(),
			$services->getTitleFactory(),
			$services->getPermissionManager(),
			$services->getLinkBatchFactory(),
			$parser->getOptions()->getUserIdentity(),
			$parser->getOutput(),
			$this->resolveUserLanguage( $parser )
		);
	}

	private function bypassLegacyTemplates(): bool {
		return (bool)MediaWikiServices::getInstance()->getMainConfig()
			->get( 'MwJsonBypassLegacyTemplates' );
	}

	private function newSlotSource( ?SlotDependencies $dependencies = null ): WsSlotSource {
		$services = MediaWikiServices::getInstance();
		return new WsSlotSource(
			$services->getTitleFactory(),
			$services->getWikiPageFactory(),
			$dependencies
		);
	}

	/**
	 * The walker, wrapped in the cross-request cache.
	 *
	 * Resolving a chain re-reads every slot and re-merges every ancestor on
	 * every render, and the answer is a pure function of the revisions it read,
	 * so it is worth storing. Falls back to the bare walker when there is no
	 * title to key on, which happens in some maintenance contexts.
	 */
	private function newSchemaResolver(
		SlotJsonLoader $loader,
		WsSlotSource $slots,
		SlotDependencies $dependencies,
		?\MediaWiki\Title\Title $title
	): SchemaResolver {
		$walker = new SchemaWalker( $loader, $slots, $this->merge );

		if ( $title === null ) {
			return $walker;
		}

		$services = MediaWikiServices::getInstance();
		$cache = new ResolvedSchemaCache(
			$services->getMainWANObjectCache(),
			$services->getTitleFactory(),
			$services->getLinkBatchFactory()
		);

		return new CachingSchemaWalker( $walker, $cache, $dependencies, $title->getPrefixedText() );
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
