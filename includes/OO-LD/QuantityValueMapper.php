<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Port of p.processQuantityValue().
 *
 * OSL stores a quantity as an object, `{ value: 1.5, unit: "Item:Metre" }`,
 * which SMW cannot query numerically. Where the schema names an SMW quantity
 * property, this emits the flat "1.5 m" form SMW's Quantity datatype
 * understands, alongside the structured value.
 *
 * The unit symbol comes from the schema rather than the data: `unit` holds an
 * item IRI, and the schema's `enum` / `options.enum_titles` pair maps that IRI
 * to the symbol to print. So a quantity is only emitted when the schema carries
 * the full set, which is what the long guard below checks.
 *
 * ## It rewrites the value object
 *
 * The Lua takes the quantity object straight out of jsondata and writes its
 * working back into it: `property`, `unit_index` and `unit_symbol` are added,
 * and `value` and `unit` are filled in from the schema defaults. Since Lua
 * tables are references, that pollution lands in the page's own data and in the
 * definitions the renderers receive.
 *
 * Reproduced here, because it is observable in the returned structures even
 * though nothing downstream currently reads the added keys. It is bad design
 * rather than intent, and should be dropped once the Lua is gone.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class QuantityValueMapper {

	private SchemaKeys $keys;

	public function __construct( ?SchemaKeys $keys = null ) {
		$this->keys = $keys ?? new SchemaKeys();
	}

	/**
	 * @param array<string,mixed> $properties Accumulated SMW properties.
	 * @param mixed $valueObject The quantity object from jsondata.
	 * @param mixed $schema The property's subschema.
	 * @return array{0:array<string,mixed>,1:mixed} $properties with the flat
	 *   value appended if one applied, and the value object with the Lua's
	 *   working written back into it.
	 */
	public function apply( array $properties, $valueObject, $schema ): array {
		if ( !is_array( $valueObject ) || !is_array( $schema ) ) {
			return [ $properties, $valueObject ];
		}

		$quantityProperty = $schema[$this->keys->legacy( 'smwQuantityProperty' )] ?? null;
		$unitSchema = $schema['properties']['unit'] ?? null;

		// Every part has to be present: the value, the property to store under,
		// and the enum-to-symbol mapping that turns the unit IRI into a symbol.
		if (
			!isset( $valueObject['value'] )
			|| !is_string( $quantityProperty )
			|| !is_array( $unitSchema )
			|| !isset( $schema['properties']['value'] )
			|| !is_array( $unitSchema['enum'] ?? null )
			|| !is_array( $unitSchema['options']['enum_titles'] ?? null )
		) {
			return [ $properties, $valueObject ];
		}

		// Unanchored, matching the Lua's global gsub, so a prefixed property
		// such as "Property:schema:url" loses the namespace wherever it occurs.
		$valueObject['property'] = str_replace(
			SchemaKeys::PROPERTY_NS_PREFIX . ':', '', $quantityProperty
		);
		$valueObject['value'] ??= $schema['properties']['value']['default'] ?? null;
		$valueObject['unit'] ??= $unitSchema['default'] ?? null;

		// Last match, not first: the Lua loops the whole enum without breaking,
		// so a duplicated entry resolves to the later symbol.
		foreach ( $unitSchema['enum'] as $index => $candidate ) {
			if ( $candidate === $valueObject['unit'] ) {
				$valueObject['unit_index'] = $index;
			}
		}

		// Only wiki-local properties are stored; an external IRI has no SMW
		// property behind it. Note the writes above happen either way, which is
		// why this check sits here rather than at the top.
		if (
			!isset( $valueObject['unit_index'] )
			|| ( JsonUtil::splitString( $quantityProperty, ':' )[0] ?? null ) !== SchemaKeys::PROPERTY_NS_PREFIX
		) {
			return [ $properties, $valueObject ];
		}

		$symbol = $unitSchema['options']['enum_titles'][$valueObject['unit_index']] ?? null;
		$valueObject['unit_symbol'] = $symbol;

		$name = $valueObject['property'];
		$properties[$name] ??= [];
		$properties[$name][] = $valueObject['value'] . ' ' . $symbol;

		return [ $properties, $valueObject ];
	}
}
