<?php

namespace MediaWiki\Extension\MwJson\Mw;

use CoreParserFunctions;
use MediaWiki\Extension\MwJson\OOLD\ContextBuilder;
use MediaWiki\Extension\MwJson\OOLD\JsonLoader;
use MediaWiki\Extension\MwJson\OOLD\JsonRefExpander;
use MediaWiki\Extension\MwJson\OOLD\LabelHelper;
use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
use MediaWiki\Extension\MwJson\OOLD\MergeStrategy;
use MediaWiki\Extension\MwJson\OOLD\SchemaKeys;
use MediaWiki\Extension\MwJson\OOLD\SchemaResolver;
use MediaWiki\Extension\MwJson\OOLD\SchemaWalker;
use MediaWiki\Extension\MwJson\OOLD\SemanticPropertyMapper;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\Extension\MwJson\OOLD\SlotTextLoader;
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
use MediaWiki\Title\Title;
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
		$registry = $this->newPatchRegistry( $dependencies );
		$slots = $this->newSlotSource( $dependencies, $registry );
		$loader = $this->wrapWithPatches(
			new SlotJsonLoader( $slots, $this->merge ),
			$registry
		);

		$multilang = new MultilangValue( $this->resolveUserLanguage( $parser ) );
		$types = new PropertyTypeResolver();
		$dates = new DateFormatter();
		$links = new LinkHelper( $wikitext, $this->newLinkLabelResolver( $parser ) );

		$title = $parser->getTitle();

		return new EntityProcessor(
			$this->newSchemaResolver( $loader, $slots, $dependencies, $title, $parser, $registry ),
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
	 * Render one slot of one page, and apply what the render decided to write.
	 *
	 * Both entry points call this rather than repeating it, so the ordering
	 * below and the handling of SMW errors exist once and cannot drift apart.
	 *
	 * @param Parser $parser The parser rendering the page.
	 * @param PPFrame $frame Its current frame.
	 * @param string $mode Slots::MODE_HEADER or Slots::MODE_FOOTER.
	 * @param Title $title The page to render.
	 * @param array|null $jsondata Supplied data, or null to read the page's slot.
	 * @param array $jsonschema An inline schema, when the caller has one.
	 * @param string|null $template An inline template for the page itself.
	 * @return string Wikitext.
	 */
	public function renderSlot(
		Parser $parser,
		PPFrame $frame,
		string $mode,
		Title $title,
		?array $jsondata = null,
		array $jsonschema = [],
		?string $template = null
	): string {
		$subject = $title->getPrefixedText();
		$jsondata ??= $this->newSlotJsonLoader()->load( $subject, Slots::JSONDATA );

		// A Category page is rendered as an instance of the metaclass, since a
		// class is itself an entity. Matches Module:Entity's dispatch.
		$categories = $title->getNamespace() === NS_CATEGORY ? [ 'Category:Category' ] : null;

		$result = $this->newEntityProcessor( $parser, $frame )->process(
			$jsondata,
			$subject,
			$title->getNsText(),
			$mode,
			$categories,
			$jsonschema,
			$template
		);

		// The processor computes without writing; the writes happen here, in the
		// order the Lua performed them. That order matters: the display title
		// goes first, because SMW derives a subject's sort key from it during
		// the #set and would otherwise fall back to the page name, so a category
		// listing would sort by raw OSW id rather than by label.
		$this->setDisplayTitle( $parser, $result->displayTitle );

		$wikitext = $result->wikitext;
		if ( $result->mapping !== null ) {
			foreach ( $this->newSmwWriter( $parser )->write( $result->mapping ) as $error ) {
				$wikitext .= ' ' . $error;
			}
		}

		return $wikitext;
	}

	/**
	 * A loader on its own, for callers that only need to read jsondata.
	 */
	public function newSlotJsonLoader(): SlotJsonLoader {
		return new SlotJsonLoader( $this->newSlotSource(), $this->merge );
	}

	/**
	 * A loader that sees patched content, for callers that want what a reader
	 * would see rather than what is stored.
	 */
	public function newPatchedJsonLoader( ?array $patchsets = null ): JsonLoader {
		$dependencies = new SlotDependencies();
		$registry = $this->newPatchRegistry( $dependencies, $patchsets );
		return $this->wrapWithPatches(
			new SlotJsonLoader( $this->newSlotSource( $dependencies, $registry ), $this->merge ),
			$registry
		);
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

		// Not silenced for convenience: a concurrent request may win the race,
		// so a failed mkdir only matters if the directory still is not there.
		if ( !is_dir( $directory ) ) {
			// phpcs:ignore Generic.PHP.NoSilencedErrors.Discouraged
			@mkdir( $directory, 0777, true );
			if ( !is_dir( $directory ) ) {
				return new MustacheRenderer();
			}
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
			// A User, not the UserIdentity the options hand back, because
			// PermissionManager::userCan() takes one.
			$services->getUserFactory()->newFromUserIdentity(
				$parser->getOptions()->getUserIdentity()
			),
			$parser->getOutput(),
			$this->resolveUserLanguage( $parser )
		);
	}

	private function bypassLegacyTemplates(): bool {
		return (bool)MediaWikiServices::getInstance()->getMainConfig()
			->get( 'MwJsonBypassLegacyTemplates' );
	}

	private function newSlotSource(
		?SlotDependencies $dependencies = null,
		?PatchRegistry $registry = null
	): SlotTextLoader {
		$services = MediaWikiServices::getInstance();
		$source = new WsSlotSource(
			$services->getTitleFactory(),
			$services->getWikiPageFactory(),
			$dependencies
		);

		return $registry === null ? $source : new PatchingSlotSource( $source, $registry );
	}

	/**
	 * The registry, or null when patches are switched off.
	 *
	 * Its own unpatched loader on purpose: a patch that could patch patch pages
	 * would recurse, and the set of patches has to settle before any of them is
	 * applied. The dependency collector is shared, so the patch pages a render
	 * consulted are revalidated along with everything else it read.
	 */
	private function newPatchRegistry(
		SlotDependencies $dependencies,
		?array $patchsets = null
	): ?PatchRegistry {
		$config = MediaWikiServices::getInstance()->getMainConfig();
		if ( !$config->get( 'MwJsonEnablePatches' ) ) {
			return null;
		}
		if ( !class_exists( \SMW\StoreFactory::class ) ) {
			return null;
		}

		$services = MediaWikiServices::getInstance();
		$plain = new WsSlotSource(
			$services->getTitleFactory(),
			$services->getWikiPageFactory(),
			$dependencies
		);

		$loader = new SlotJsonLoader( $plain, $this->merge );

		return new PatchRegistry(
			\SMW\StoreFactory::getStore(),
			$loader,
			$patchsets ?? (array)$config->get( 'MwJsonDefaultPatchsets' ),
			new GuardedCategories( (array)$config->get( 'MwJsonCategoryEditRights' ), $loader ),
			$services->getTitleFactory(),
			(string)$config->get( 'MwJsonPatchCategory' )
		);
	}

	private function wrapWithPatches( JsonLoader $loader, ?PatchRegistry $registry ): JsonLoader {
		return $registry === null ? $loader : new PatchingJsonLoader( $loader, $registry );
	}

	/**
	 * The walker, wrapped in the cross-request cache.
	 *
	 * Resolving a chain re-reads every slot and re-merges every ancestor on
	 * every render, and the answer is a pure function of the revisions it read,
	 * so it is worth storing. Falls back to the bare walker when there is no
	 * title to key on, which happens in some maintenance contexts.
	 */

	/**
	 * Registers what the walk read as parser-cache dependencies, or null when
	 * the wiki has not opted in. See ParserDependencyRegistrar for why that is
	 * a decision rather than a default.
	 */
	private function newDependencyRegistrar( Parser $parser ): ?ParserDependencyRegistrar {
		$services = MediaWikiServices::getInstance();
		if ( !$services->getMainConfig()->get( 'MwJsonRegisterSlotDependencies' ) ) {
			return null;
		}

		return new ParserDependencyRegistrar( $parser->getOutput(), $services->getTitleFactory() );
	}

	private function newSchemaResolver(
		JsonLoader $loader,
		SlotTextLoader $slots,
		SlotDependencies $dependencies,
		?Title $title,
		?Parser $parser = null,
		?PatchRegistry $registry = null
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

		// The patch set in play is part of the subject, not a dependency. A
		// dependency is revalidated against pages the resolution recorded, so
		// it notices a patch being edited and cannot notice one being created,
		// which is exactly the change that makes a page start differing.
		$subject = $title->getPrefixedText();
		if ( $registry !== null ) {
			$subject .= '|patches:' . $registry->fingerprint();
		}

		return new CachingSchemaWalker(
			$walker, $cache, $dependencies, $subject,
			$parser !== null ? $this->newDependencyRegistrar( $parser ) : null
		);
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
