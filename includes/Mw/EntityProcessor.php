<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Extension\MwJson\OOLD\JsonRefExpander;
use MediaWiki\Extension\MwJson\OOLD\JsonUtil;
use MediaWiki\Extension\MwJson\OOLD\LabelHelper;
use MediaWiki\Extension\MwJson\OOLD\ProcessResult;
use MediaWiki\Extension\MwJson\OOLD\SchemaKeys;
use MediaWiki\Extension\MwJson\OOLD\SchemaResolver;
use MediaWiki\Extension\MwJson\OOLD\SchemaWalkResult;
use MediaWiki\Extension\MwJson\OOLD\SemanticPropertyMapper;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\Extension\MwJson\Render\InfoBoxRenderer;
use MediaWiki\Extension\MwJson\Render\MultilangValue;
use MediaWiki\Extension\MwJson\Render\TreeRenderer;
use MediaWiki\Extension\MwJson\Template\EmbeddedTemplateExpander;
use MediaWiki\Extension\MwJson\Template\WikitextPreprocessor;

/**
 * Ports p.processJsondata(), the orchestrator, plus Module:Entity's dispatch.
 *
 * Renders one slot of one page: resolve the schema chain, expand the
 * eval_templates twice (once for storage, once for display), map the data onto
 * SMW, then emit the tree or the info boxes and the per-category templates.
 *
 * Returns a ProcessResult rather than writing; see that class for why.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class EntityProcessor {

	/** Marks a header template that already draws its own info box. */
	private const INFOBOX_MARKER = 'class="info_box"';

	/** Opts a template that contains an info box back into the generated one. */
	private const INFOBOX_OVERRIDE = '@renderInfoBox';

	/** The subject's own schema, which is the page itself rather than a category. */
	private const OWN_SCHEMA_KEY = '_';

	private SchemaResolver $walker;
	private JsonRefExpander $expander;
	private EmbeddedTemplateExpander $templates;
	private SemanticPropertyMapper $mapper;
	private TreeRenderer $tree;
	private InfoBoxRenderer $infoBox;
	private MultilangValue $multilang;
	private LabelHelper $labels;
	private WikitextPreprocessor $wikitext;
	private SchemaKeys $keys;

	public function __construct(
		SchemaResolver $walker,
		JsonRefExpander $expander,
		EmbeddedTemplateExpander $templates,
		SemanticPropertyMapper $mapper,
		TreeRenderer $tree,
		InfoBoxRenderer $infoBox,
		MultilangValue $multilang,
		LabelHelper $labels,
		WikitextPreprocessor $wikitext,
		?SchemaKeys $keys = null
	) {
		$this->walker = $walker;
		$this->expander = $expander;
		$this->templates = $templates;
		$this->mapper = $mapper;
		$this->tree = $tree;
		$this->infoBox = $infoBox;
		$this->multilang = $multilang;
		$this->labels = $labels;
		$this->wikitext = $wikitext;
		$this->keys = $keys ?? new SchemaKeys();
	}

	/**
	 * @param array $jsondata The page's data.
	 * @param string $subjectTitle Prefixed title of the page.
	 * @param string $namespaceText Its namespace, which changes category and
	 *   display-title handling.
	 * @param string $mode Slots::MODE_HEADER or Slots::MODE_FOOTER.
	 * @param string[]|null $categories Override the chain root. Category pages
	 *   pass Category:Category, since a class is an instance of the metaclass.
	 * @param array $jsonschema An inline schema, when the caller has one.
	 * @param string|null $template An inline template for the page itself.
	 */
	public function process(
		array $jsondata,
		string $subjectTitle,
		string $namespaceText,
		string $mode = Slots::MODE_HEADER,
		?array $categories = null,
		array $jsonschema = [],
		?string $template = null
	): ProcessResult {
		$categoryKey = $this->keys->legacy( 'category' );

		// Nothing to render without data, and nothing to render it against
		// without a schema, a category argument or a type in the data.
		if (
			JsonUtil::nilOrEmpty( $jsondata )
			|| (
				JsonUtil::nilOrEmpty( $categories )
				&& JsonUtil::nilOrEmpty( $jsonschema )
				&& JsonUtil::nilOrEmpty( $jsondata[$categoryKey] ?? null )
			)
		) {
			return new ProcessResult();
		}

		// The data's own type wins over the caller's argument.
		if ( !JsonUtil::nilOrEmpty( $jsondata[$categoryKey] ?? null ) ) {
			$categories = (array)$jsondata[$categoryKey];
		}

		$walk = $this->walker->walk( $jsonschema, $categories, $mode, true, $template );
		$schema = $this->expander->expand( $walk->schema );

		// Two independent expansions of the same data. The store pass feeds
		// SMW, the render pass feeds the page, and their eval_templates differ.
		$storeData = $this->templates->expand( $jsondata, $schema, 'store' );
		$renderData = $this->templates->expand( $jsondata, $schema, 'render' );

		$wikitext = '';
		$mapping = null;
		$definitions = [];

		if ( $mode === Slots::MODE_HEADER ) {
			$mapping = $this->mapper->map( $storeData, $schema, $subjectTitle );
			$definitions = $this->recordDeclaringCategories( $mapping->definitions, $walk );
			$wikitext .= $this->renderJsonLdHeader( $jsondata, $schema, $mapping->context );
		}

		// Label and description render empty when the page has no text in the
		// reader's language, so substitute the English one for display.
		$labelKey = $this->keys->legacy( 'label' );
		[ $renderData, $labelFallback ] = $this->multilang->applyFallback(
			$renderData, $jsondata[$labelKey] ?? null, $labelKey
		);
		$descriptionKey = $this->keys->legacy( 'description' );
		[ $renderData, $descriptionFallback ] = $this->multilang->applyFallback(
			$renderData,
			$jsondata[$descriptionKey] ?? null,
			$descriptionKey
		);

		// The description's render eval_template has no #switch #default, and
		// generated schemas may drop it altogether, so the rendered value can
		// come out empty or still be the raw multilang list. Resolve it from
		// the original data instead: reader's language, then English, then
		// whatever the fallback found.
		$descriptionDisplay = $this->multilang->render(
			[], $jsondata, $descriptionKey, ''
		);
		if ( $descriptionDisplay === '' ) {
			$descriptionDisplay = $descriptionFallback;
		}

		$wikitext .= $this->renderChain(
			$walk, $schema, $renderData, $definitions, $mapping, $mode,
			$labelFallback, $descriptionDisplay
		);

		$displayTitle = null;
		if ( $mapping !== null ) {
			[ $mapping, $displayTitle ] = $this->finalisePageProperties(
				$mapping, $storeData, $subjectTitle, $namespaceText
			);
		}

		// No newline before them: category links render invisibly, so a
		// preceding newline closes the last paragraph and leaves a stray
		// <p><br/></p> at the end of the header slot.
		$wikitext .= $this->renderCategories( $storeData, $mapping, $namespaceText );

		return new ProcessResult( $wikitext, $mapping, $displayTitle );
	}

	/**
	 * Render each category in the chain: the tree once at the top, or one info
	 * box per category, followed by that category's own header template.
	 *
	 * @param array<string,array> $definitions
	 * @param \MediaWiki\Extension\MwJson\OOLD\SemanticMapping|null $mapping
	 */
	private function renderChain(
		SchemaWalkResult $walk,
		array $schema,
		array $renderData,
		array $definitions,
		$mapping,
		string $mode,
		?string $labelFallback,
		?string $descriptionDisplay = null
	): string {
		$renderMode = ( $renderData['__render_mode__'] ?? null ) === 'table' ? 'table' : 'tree';
		$context = $mapping !== null ? $mapping->context : [];
		$visited = $walk->visited;
		$wikitext = '';

		foreach ( $visited as $index => $category ) {
			if ( $mode === Slots::MODE_FOOTER ) {
				// Footers run outermost first, so the most derived category's
				// footer appears above its ancestors'.
				$category = $visited[count( $visited ) - $index - 1];
			}

			$template = $walk->templates[$category] ?? null;
			$details = null;

			if ( $mode === Slots::MODE_HEADER && $renderMode === 'tree' && $index === 0 ) {
				$details = $this->renderTree( $schema, $renderData, $definitions );
			}

			if ( $mode === Slots::MODE_HEADER && $renderMode !== 'tree' ) {
				$wikitext .= $this->renderInfoBox(
					$walk, $index, $category, $schema, $context, $definitions, $renderData, $template
				);
			}

			if ( $template !== null ) {
				$wikitext .= $this->renderTemplate(
					$template, $renderData, $details, $labelFallback, $descriptionDisplay, $category
				);
			}
		}

		return $wikitext;
	}

	/**
	 * @param array<string,array> $definitions
	 */
	private function renderTree( array $schema, array $renderData, array $definitions ): string {
		$bullets = $this->tree->render( $renderData, $schema, $definitions );
		// Preprocessed before #tree sees it, because the bullets contain
		// templates and parser functions that #tree would otherwise pass
		// through untouched.
		$bullets = $this->wikitext->preprocess( $bullets );
		$tree = $this->wikitext->callParserFunction( '#tree', [ $bullets ] );

		return '<div id="jsondata-tree" class="info-tree" >' . $tree . '</div>';
	}

	/**
	 * @param array<string,array> $definitions
	 */
	private function renderInfoBox(
		SchemaWalkResult $walk,
		int $index,
		string $category,
		array $schema,
		array $context,
		array $definitions,
		array $renderData,
		?string $template
	): string {
		// A template that already draws its own box suppresses the generated
		// one, unless it opts back in with the marker.
		if (
			$template !== null
			&& strpos( $template, self::INFOBOX_MARKER ) !== false
			&& strpos( $template, self::INFOBOX_OVERRIDE ) === false
		) {
			return '';
		}

		// Never repeat the type, and never repeat a property that a more
		// derived category also declares: it belongs in that one's box.
		$ignore = [ $this->keys->legacy( 'category' ) => true ];
		foreach ( $walk->visited as $otherIndex => $other ) {
			if ( $otherIndex <= $index ) {
				continue;
			}
			foreach ( $walk->schemas[$other]['properties'] ?? [] as $name => $unused ) {
				$ignore[$name] = true;
			}
		}

		$box = $this->infoBox->render(
			$walk->schemas[$category] ?? [], $schema, $context, $definitions, $renderData, $ignore
		);

		return $this->wikitext->preprocess( $box );
	}

	/**
	 * A category's header template, expanded with the page data as arguments.
	 */
	private function renderTemplate(
		string $template,
		array $renderData,
		?string $details,
		?string $labelFallback,
		?string $descriptionDisplay = null,
		?string $sourceTitle = null
	): string {
		// Wiki template arguments are strings, so structured values are
		// dropped rather than stringified.
		$args = [];
		foreach ( $renderData as $key => $value ) {
			if ( !is_array( $value ) ) {
				$args[$key] = $value;
			}
		}

		$labelKey = $this->keys->legacy( 'label' );
		$label = $args[$labelKey] ?? null;
		if ( ( $label === null || ( is_string( $label ) && trim( $label ) === '' ) ) && $labelFallback !== null ) {
			$args[$labelKey] = $labelFallback;
		}

		if ( $descriptionDisplay !== null && $descriptionDisplay !== '' ) {
			$args[$this->keys->legacy( 'description' )] = $descriptionDisplay;
		}

		$args['_details'] = $details;

		// A template starting with a heading needs a preceding newline, or the
		// parser reads it as text rather than as a section heading.
		if ( strncmp( $template, '=', 1 ) === 0 ) {
			$template = "\n" . $template;
		}

		// The source category is passed as the frame title so that a heading in
		// its template is attributed to it: MediaWiki then emits an edit link
		// pointing at the category that actually holds the wikitext. The Lua
		// attributes them to Module:Entity instead, which sends the reader to a
		// Lua module, and which has nowhere to point once the module is gone.
		return $this->wikitext->preprocessWithArgs(
			$template,
			array_map( static fn ( $v ) => $v === null ? '' : (string)$v, $args ),
			$sourceTitle === self::OWN_SCHEMA_KEY ? null : $sourceTitle
		);
	}

	/**
	 * Note against each property which categories in the chain declared it, so
	 * the renderers can show "Definition: Category:Entity, Category:Item".
	 *
	 * @param array<string,array> $definitions
	 * @return array<string,array>
	 */
	private function recordDeclaringCategories( array $definitions, SchemaWalkResult $walk ): array {
		foreach ( $walk->visited as $category ) {
			foreach ( $walk->schemas[$category]['properties'] ?? [] as $name => $unused ) {
				$definitions[$name]['defined_in'][] = $category;
			}
		}
		return $definitions;
	}

	/**
	 * The hidden div carrying JSON-LD for search engines.
	 */
	private function renderJsonLdHeader( array $jsondata, array $schema, array $context ): string {
		$jsonld = $jsondata;
		$jsonld['@context'] = $context;
		$jsonld['@type'] = array_merge(
			JsonUtil::tablefy( $schema['schema_type'] ?? null ),
			JsonUtil::tablefy( $jsonld['@type'] ?? null )
		);

		// Google reads schema:name and schema:description but not @value with
		// @language, so the first label and description are copied out flat.
		$labelKey = $this->keys->legacy( 'label' );
		$textKey = $this->keys->legacy( 'text' );

		// Assigned only when there is something to assign. Lua cannot store a
		// nil-valued key, so an entity with no description simply has no
		// schema:description member, where PHP would happily emit a null one.
		$schemaName = JsonUtil::defaultArgPath(
			$jsonld, [ $labelKey, 0, $textKey ], $jsonld['name'] ?? null
		);
		if ( $schemaName !== null ) {
			$jsonld['schema:name'] = $schemaName;
		}
		$schemaDescription = JsonUtil::defaultArgPath(
			$jsonld, [ $this->keys->legacy( 'description' ), 0, $textKey ]
		);
		if ( $schemaDescription !== null ) {
			$jsonld['schema:description'] = $schemaDescription;
		}

		foreach ( $jsonld as $key => $value ) {
			if ( !is_string( $value ) ) {
				continue;
			}
			$parts = JsonUtil::splitString( $value, ':' );
			// Resolve File: values to a real URL, since Google does not follow
			// the Special:Redirect indirection.
			if ( count( $parts ) === 2 && $parts[0] === 'File' ) {
				$jsonld[$key] = $this->wikitext->callParserFunction( 'filepath', [ $parts[1] ] );
			}
		}

		$encoded = json_encode( $jsonld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

		// Single quotes delimit the attribute, so any in the payload become
		// backticks rather than closing it early.
		return "<div class='jsonld-header' style='display:none' data-jsonld='"
			. str_replace( "'", '`', (string)$encoded ) . "'></div>";
	}

	/**
	 * Page-level properties: the display title in its several normalised forms,
	 * and the page's own id.
	 *
	 * @param \MediaWiki\Extension\MwJson\OOLD\SemanticMapping $mapping
	 * @return array{0:\MediaWiki\Extension\MwJson\OOLD\SemanticMapping,1:?string}
	 */
	private function finalisePageProperties(
		$mapping,
		array $storeData,
		string $subjectTitle,
		string $namespaceText
	): array {
		$properties = $mapping->properties;
		$displayLabel = $this->labels->getDisplayLabel( $storeData, $properties );

		// A Property page is named by its machine name, not its label, because
		// that is what queries have to spell.
		if ( $namespaceText === 'Property' ) {
			$displayLabel = $storeData[$this->keys->legacy( 'name' )] ?? $displayLabel;
		}

		unset( $properties[SchemaKeys::CATEGORY_PSEUDO_PROPERTY] );
		$properties['HasOswId'] = $subjectTitle;

		if ( $displayLabel !== null ) {
			$properties['Display title of'] = $displayLabel;
			// Lowercased and stripped variants, so a query can match without
			// knowing the exact punctuation or case.
			$properties['Display title of lowercase'] = strtolower( $displayLabel );
			$properties['Display title of normalized'] = preg_replace(
				'/[^a-z0-9]+/', '', strtolower( $displayLabel )
			);
		}

		$mapping->properties = $this->labels->setNormalizedLabel( $properties );

		return [ $mapping, $displayLabel ];
	}

	/**
	 * The `[[Category:...]]` links that put the page in its categories.
	 *
	 * @param \MediaWiki\Extension\MwJson\OOLD\SemanticMapping|null $mapping
	 */
	private function renderCategories( array $storeData, $mapping, string $namespaceText ): string {
		$categories = JsonUtil::tablefy( $storeData[$this->keys->legacy( 'subcategory' )] ?? null );

		// A Category page's own type is its metaclass, which would file every
		// class under Category:Category; only instances take their type as a
		// category.
		if ( $namespaceText !== 'Category' ) {
			foreach ( JsonUtil::tablefy( $storeData[$this->keys->legacy( 'category' )] ?? null ) as $category ) {
				$categories[] = $category;
			}
		}

		if ( $mapping !== null ) {
			foreach (
				JsonUtil::tablefy( $mapping->properties[SchemaKeys::CATEGORY_PSEUDO_PROPERTY] ?? null )
				as $category
			) {
				$categories[] = $category;
			}
		}

		$wikitext = '';
		foreach ( $categories as $category ) {
			if ( !is_string( $category ) ) {
				continue;
			}
			// No sort key. The Lua computes a display label for one but scopes
			// it to an inner block, so the outer reference is always nil and
			// every category link is unsorted. Reproduced; worth fixing once
			// the Lua is gone.
			$wikitext .= '[[Category:' . str_replace( 'Category:', '', $category ) . ']]';
		}

		return $wikitext;
	}
}
