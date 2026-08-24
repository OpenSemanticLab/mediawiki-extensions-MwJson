<?php

namespace MediaWiki\Extension\MwJson\Render;

use MediaWiki\Extension\MwJson\OOLD\JsonUtil;

/**
 * Port of p.getPropertyType().
 *
 * Works out how a value should be formatted: as a link (`@id`), as a date, or
 * as plain text. The JSON-LD context is asked first, because a term's `@type`
 * is the most specific statement available, and the JSON Schema `type` and
 * `format` are the fallback for properties the context does not describe.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class PropertyTypeResolver {

	public const ID = '@id';
	public const DATE = 'xsd:date';
	public const DATE_TIME = 'xsd:dateTime';
	public const VALUE = '@value';

	/**
	 * @param array|null $context JSON-LD term map, or null to skip that step.
	 * @param string|null $key The jsondata key, or null to skip that step.
	 * @param mixed $schema The property's subschema.
	 */
	public function resolve( ?array $context, ?string $key, $schema ): string {
		if ( $context !== null && $key !== null ) {
			$type = JsonUtil::defaultArgPath( $context, [ $key, '@type' ] );
			if ( $type !== null ) {
				return (string)$type;
			}
		}

		if ( !is_array( $schema ) ) {
			return self::VALUE;
		}

		// For an array the date type lives on the items schema, since the array
		// node itself only carries the structural type. Reading items first and
		// falling back to the node covers scalars and a format set on the array
		// node by mistake.
		$node = $schema;
		if ( ( $schema['type'] ?? null ) === 'array' && is_array( $schema['items'] ?? null ) ) {
			$node = $schema['items'];
		}

		$format = $node['format'] ?? $schema['format'] ?? null;
		$type = $node['type'] ?? $schema['type'] ?? null;

		if ( $format === 'date' || $type === 'date' ) {
			return self::DATE;
		}
		if ( $format === 'date-time' || $type === 'date-time' ) {
			return self::DATE_TIME;
		}

		return self::VALUE;
	}
}
