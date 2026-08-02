<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Port of Module:MwJson's p.walkJsonSchema().
 *
 * Walks a page's category inheritance chain depth first, collecting each
 * ancestor's schema and its render template, rescaling propertyOrder onto one
 * global scale, and merging the whole chain into a single object.
 *
 * This is the heart of OSL's data model: it is what makes a Category page a
 * class and `allOf` a superclass link.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class SchemaWalker implements SchemaResolver {

	/**
	 * Key under which the subject page's own schema is filed.
	 *
	 * The Lua appends this dummy "category" so the page's own schema takes part
	 * in the same propertyOrder ranking and merge pass as its ancestors, going
	 * last so it wins.
	 */
	public const OWN_SCHEMA_KEY = '_';

	private JsonLoader $loader;
	private SlotTextLoader $slots;
	private MergeStrategy $merge;
	private CategoryExtractor $categories;
	private PropertyOrderRanker $ranker;

	public function __construct(
		JsonLoader $loader,
		SlotTextLoader $slots,
		MergeStrategy $merge,
		?CategoryExtractor $categories = null,
		?PropertyOrderRanker $ranker = null
	) {
		$this->loader = $loader;
		$this->slots = $slots;
		$this->merge = $merge;
		$this->categories = $categories ?? new CategoryExtractor();
		$this->ranker = $ranker ?? new PropertyOrderRanker();
	}

	/**
	 * @param array $schema The subject page's own schema.
	 * @param string[]|string|null $categories Override the chain root instead of
	 *   deriving it from $schema's allOf. Used for Category pages, which are
	 *   walked as instances of Category:Category.
	 * @param string $mode Slots::MODE_HEADER or Slots::MODE_FOOTER; selects
	 *   which per-category template slot is collected.
	 * @param bool $recursive Follow ancestors' own allOf chains.
	 * @param string|null $template Template for the subject page itself.
	 */
	public function walk(
		array $schema,
		$categories = null,
		string $mode = Slots::MODE_HEADER,
		bool $recursive = true,
		?string $template = null
	): SchemaWalkResult {
		$state = [
			'schemas' => [],
			'templates' => [],
			'visited' => [],
			'debug' => [],
		];

		$this->collect( $schema, $categories, $mode, $recursive, $state );

		// Only non-empty schemas get a slot in the chain, so a page with no
		// jsondata schema contributes nothing rather than an empty "_" entry.
		if ( $schema !== [] ) {
			$state['visited'][] = self::OWN_SCHEMA_KEY;
			$state['schemas'][self::OWN_SCHEMA_KEY] = $schema;
			// Assigning nil in Lua removes the key, so a page with no template
			// has no entry rather than a null one. Callers only ever read the
			// value, but keeping the shapes identical means the fixture
			// comparison stays exact.
			if ( $template !== null ) {
				$state['templates'][self::OWN_SCHEMA_KEY] = $template;
			}
		}

		$state['schemas'] = $this->ranker->rank( $state['visited'], $state['schemas'] );

		$merged = $schema;
		foreach ( $state['visited'] as $category ) {
			// Note the subject's own schema is folded in twice: once as the
			// starting value here and again as "_" at the end of the chain.
			// Under the legacy merge that duplicates its list-valued members
			// (a "required": ["uuid"] becomes ["uuid", "uuid"]). Faithful to
			// the Lua, and harmless for the string-keyed members the renderers
			// actually read, but it is why a flattened schema is not a valid
			// JSON Schema and must not be handed to a validator as-is.
			$merged = $this->merge->merge( $merged, $state['schemas'][$category] );
		}

		return new SchemaWalkResult(
			$merged,
			$state['schemas'],
			$state['templates'],
			$state['visited'],
			$state['debug']
		);
	}

	/**
	 * Depth-first walk. Ancestors are recorded before the categories that
	 * reference them, so `visited` runs most basal first.
	 *
	 * @param string[]|string|null $categories
	 * @param array{schemas:array,templates:array,visited:array,debug:array} &$state
	 */
	private function collect(
		array $schema,
		$categories,
		string $mode,
		bool $recursive,
		array &$state
	): void {
		if ( $categories === null ) {
			$categories = $this->categories->extract( $schema, true, true );
		} elseif ( !is_array( $categories ) ) {
			$categories = [ $categories ];
		}

		$templateSlot = Slots::templateSlotForMode( $mode );

		foreach ( $categories as $category ) {
			if ( !is_string( $category ) || in_array( $category, $state['visited'], true ) ) {
				continue;
			}

			$superSchema = $this->loadCategorySchema( $category );

			if ( $recursive ) {
				$this->collect( $superSchema, null, $mode, true, $state );
			}

			$state['visited'][] = $category;
			$state['schemas'][$category] = $superSchema;

			$templateText = $templateSlot === null
				? null
				: $this->slots->getText( $category, $templateSlot );
			if ( $templateText !== null ) {
				$state['templates'][$category] = $templateText;
			}
		}
	}

	/**
	 * JsonSchema: pages hold their schema in the main slot; every other page
	 * holds it in the jsonschema slot.
	 */
	private function loadCategorySchema( string $category ): array {
		$namespace = JsonUtil::splitString( $category, ':' )[0] ?? '';

		return $namespace === 'JsonSchema'
			? $this->loader->load( $category, Slots::MAIN )
			: $this->loader->load( $category, Slots::JSONSCHEMA );
	}
}
