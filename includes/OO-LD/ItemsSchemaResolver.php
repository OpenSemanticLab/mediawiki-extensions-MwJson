<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Port of Module:MwJson's p.resolveItemsSchema().
 *
 * Works out which schema actually governs one element of an array. Normally
 * that is the `items` schema, but where `items` declares a `oneOf`/`anyOf` the
 * element's own declared category selects the branch.
 *
 * This matters for quantities: the array schema itself carries no unit enum, so
 * mapping an element's value without resolving the branch first would look up
 * the unit against the wrong schema and store nothing.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class ItemsSchemaResolver {

	private SchemaKeys $keys;

	public function __construct( ?SchemaKeys $keys = null ) {
		$this->keys = $keys ?? new SchemaKeys();
	}

	/**
	 * @param mixed $schema The array property's schema.
	 * @param mixed $element One element of its value.
	 * @return array The governing schema: the matching branch, else `items`,
	 *   else the schema unchanged when it declares no `items` at all.
	 */
	public function resolve( $schema, $element ): array {
		if ( !is_array( $schema ) ) {
			return [];
		}

		$items = $schema['items'] ?? null;
		if ( !is_array( $items ) ) {
			return $schema;
		}

		$branches = $items['oneOf'] ?? $items['anyOf'] ?? null;
		if ( !is_array( $branches ) ) {
			return $items;
		}

		$categoryKey = $this->keys->legacy( 'category' );
		$elementTypes = JsonUtil::tablefy(
			is_array( $element ) ? ( $element[$categoryKey] ?? null ) : null
		);

		foreach ( $branches as $branch ) {
			if ( !is_array( $branch ) ) {
				continue;
			}

			// The branch states which category it is for, and schemas express
			// that as any of the three JSON Schema ways of pinning a value.
			$declared = JsonUtil::defaultArgPath( $branch, [ 'properties', $categoryKey, 'default' ] )
				?? JsonUtil::defaultArgPath( $branch, [ 'properties', $categoryKey, 'const' ] )
				?? JsonUtil::defaultArgPath( $branch, [ 'properties', $categoryKey, 'enum' ] );

			foreach ( JsonUtil::tablefy( $declared ) as $declaredType ) {
				foreach ( $elementTypes as $elementType ) {
					if ( $declaredType !== $elementType ) {
						continue;
					}

					// A branch that does not name its own quantity property
					// inherits the one on `items`, so the common case of a
					// single unit enum shared by every branch keeps working.
					$quantityKey = $this->keys->legacy( 'smwQuantityProperty' );
					if ( !isset( $branch[$quantityKey] ) && isset( $items[$quantityKey] ) ) {
						$branch[$quantityKey] = $items[$quantityKey];
					}
					return $branch;
				}
			}
		}

		return $items;
	}
}
