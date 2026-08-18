<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * The schema/JSON-LD vocabulary the pipeline reads, as a resolvable map rather
 * than a table of constants.
 *
 * Module:MwJson hard-codes these in `p.keys` (MwJson.lua:7-24). They become a
 * class because OSL's schemas are migrating to OO-LD, which renames most of
 * them (propertyOrder -> x-oold-ui-property-order, and so on). The schemas live
 * on the wiki and cannot all be rewritten at once, so both generations must be
 * readable simultaneously: lookups try the OO-LD name first and fall back to
 * the legacy one, most-specific-wins.
 *
 * The OO-LD column is populated with the migration; today every entry resolves
 * to its legacy name, which is what strict parity requires.
 *
 * @see https://oo-ld.org/latest/spec/index.html
 * @see docs/legacy-lua/MwJson.lua
 */
class SchemaKeys {

	/**
	 * Concept => [ OO-LD keyword or null, legacy keyword ].
	 *
	 * Lookup order within a schema node is OO-LD first, then legacy.
	 */
	private const VOCABULARY = [
		// --- structural / JSON-LD -------------------------------------------
		'context'                 => [ null, '@context' ],
		'allOf'                   => [ null, 'allOf' ],

		// --- entity identity ------------------------------------------------
		'category'                => [ null, 'type' ],
		'subcategory'             => [ null, 'subclass_of' ],
		'schemaType'              => [ 'x-oold-instance-rdf-type', 'schema_type' ],
		'schema'                  => [ null, 'osl_schema' ],

		// --- labels ---------------------------------------------------------
		'label'                   => [ null, 'label' ],
		'name'                    => [ null, 'name' ],
		'description'             => [ null, 'description' ],
		'text'                    => [ null, 'text' ],

		// --- OSL-specific, unchanged by OO-LD -------------------------------
		'template'                => [ null, 'eval_template' ],
		'mode'                    => [ null, 'mode' ],
		'smwQuantityProperty'     => [ null, 'x-smw-quantity-property' ],
		'debug'                   => [ null, '_debug' ],
	];

	/**
	 * Keys that are not schema members but wiki/SMW identifiers.
	 *
	 * Kept separate from VOCABULARY because they are never looked up *in* a
	 * schema node: they name a namespace or a pseudo-property.
	 */
	public const PROPERTY_NS_PREFIX = 'Property';
	public const CATEGORY_PSEUDO_PROPERTY = 'Category';

	/**
	 * The JSON-LD property a slot must map to in order to count as a
	 * characteristic, which is what makes it addressable by its schema key.
	 *
	 * Keys mapped to anything else (statements, label, meta) are not addressed
	 * individually, so that a property is not minted for every object-valued
	 * key on every schema.
	 */
	public const CHARACTERISTIC_PROPERTY = 'Property:HasCharacteristic';

	/**
	 * Prefix for the property linking a parent to one characteristic slot's
	 * subobject, so `l1` becomes `HasCharacteristic_l1`.
	 *
	 * The prefix keeps these in a namespace only written here, so they always
	 * hold page values, namely the subobject reference. A bare schema key would
	 * be a global property that another schema may use for a string, and SMW
	 * would then report a type error. Neither form needs a property page.
	 */
	public const SLOT_PROPERTY_PREFIX = 'HasCharacteristic_';

	/**
	 * UI annotations. OO-LD gives these a portable vocabulary; the legacy
	 * schemas keep them under `options` or at the property root.
	 *
	 * The legacy entry is a *path* because e.g. `hidden` lives at
	 * options.hidden rather than at the node root.
	 *
	 * @var array<string,array{0:?string,1:array<int,string>}>
	 */
	private const UI_VOCABULARY = [
		'propertyOrder' => [ 'x-oold-ui-property-order', [ 'propertyOrder' ] ],
		'formHidden'    => [ 'x-oold-ui-form-hidden', [ 'options', 'hidden' ] ],
		'renderHidden'  => [ 'x-oold-ui-render-hidden', [ 'options', 'hidden' ] ],
		'enumTitles'    => [ 'x-oold-ui-enum-titles', [ 'options', 'enum_titles' ] ],
	];

	/**
	 * The legacy keyword for a concept: the name Module:MwJson uses.
	 *
	 * @throws \InvalidArgumentException on an unknown concept, so a typo fails
	 *   loudly instead of silently reading a key that is never present.
	 */
	public function legacy( string $concept ): string {
		if ( !isset( self::VOCABULARY[$concept] ) ) {
			throw new \InvalidArgumentException( "Unknown schema concept '$concept'" );
		}
		return self::VOCABULARY[$concept][1];
	}

	/**
	 * The OO-LD keyword for a concept, or null where OO-LD keeps the legacy name.
	 */
	public function ooLd( string $concept ): ?string {
		if ( !isset( self::VOCABULARY[$concept] ) ) {
			throw new \InvalidArgumentException( "Unknown schema concept '$concept'" );
		}
		return self::VOCABULARY[$concept][0];
	}

	/**
	 * Read a concept out of a schema node, preferring the OO-LD keyword.
	 *
	 * @param array $node
	 * @param mixed $default
	 * @return mixed
	 */
	public function read( array $node, string $concept, $default = null ) {
		$ooLd = $this->ooLd( $concept );
		if ( $ooLd !== null && array_key_exists( $ooLd, $node ) ) {
			return $node[$ooLd];
		}
		$legacy = $this->legacy( $concept );
		return array_key_exists( $legacy, $node ) ? $node[$legacy] : $default;
	}

	/**
	 * Read a UI annotation, preferring the OO-LD keyword over the legacy path.
	 *
	 * @param array $node
	 * @param mixed $default
	 * @return mixed
	 */
	public function readUi( array $node, string $concept, $default = null ) {
		if ( !isset( self::UI_VOCABULARY[$concept] ) ) {
			throw new \InvalidArgumentException( "Unknown UI concept '$concept'" );
		}
		[ $ooLd, $legacyPath ] = self::UI_VOCABULARY[$concept];

		if ( $ooLd !== null && array_key_exists( $ooLd, $node ) ) {
			return $node[$ooLd];
		}
		return JsonUtil::defaultArgPath( $node, $legacyPath, $default );
	}

	/**
	 * Multilingual annotation lookup: OO-LD's x-oold-multilang-<key> language
	 * map, or the legacy `<key>*` suffix shorthand.
	 *
	 * Both forms are `{ "de": "...", "en": "..." }`.
	 *
	 * @param array $node
	 * @return array<string,string>|null
	 */
	public function readMultilang( array $node, string $key ): ?array {
		$ooLd = 'x-oold-multilang-' . $key;
		if ( isset( $node[$ooLd] ) && is_array( $node[$ooLd] ) ) {
			return $node[$ooLd];
		}
		$legacy = $key . '*';
		if ( isset( $node[$legacy] ) && is_array( $node[$legacy] ) ) {
			return $node[$legacy];
		}
		return null;
	}
}
