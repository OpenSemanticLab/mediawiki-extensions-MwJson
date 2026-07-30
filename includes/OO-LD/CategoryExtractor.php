<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Port of Module:MwJson's p.getCategories().
 *
 * Reads a schema's superclass chain out of its `allOf` members. OSL encodes
 * inheritance as raw-action refs, so `"allOf": [{"$ref":
 * "/wiki/Category:Entity?action=raw&slot=jsonschema"}]` means "this category is
 * a subclass of Category:Entity".
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class CategoryExtractor {

	private SchemaKeys $keys;

	public function __construct( ?SchemaKeys $keys = null ) {
		$this->keys = $keys ?? new SchemaKeys();
	}

	/**
	 * @param array $jsonschema
	 * @param bool $includeNamespace Prefix results with "Category:"/"JsonSchema:".
	 * @param bool $includeSchemas Also return JsonSchema: refs, not just categories.
	 * @return string[] In `allOf` order, duplicates included, exactly as the Lua
	 *   returns them; walkJsonSchema() is what de-duplicates, via `visited`.
	 */
	public function extract(
		array $jsonschema,
		bool $includeNamespace = false,
		bool $includeSchemas = false
	): array {
		$allOf = $jsonschema[$this->keys->legacy( 'allOf' )] ?? null;
		if ( !is_array( $allOf ) ) {
			return [];
		}

		// The Lua iterates allOf and then iterates each entry's keys looking
		// for "$ref". If allOf is a bare object rather than a list of them, the
		// inner loop is handed a string and pairs() raises "table expected, got
		// string", so such a schema currently renders as a Lua error. Handling
		// it here is a deliberate, safe divergence: no working page can depend
		// on the crash. The parity harness will flag any page that hits it.
		if ( !JsonUtil::hasFirstElement( $allOf ) ) {
			$allOf = [ $allOf ];
		}

		$found = [];
		foreach ( $allOf as $entry ) {
			if ( !is_array( $entry ) || !isset( $entry['$ref'] ) || !is_string( $entry['$ref'] ) ) {
				continue;
			}
			$ref = $entry['$ref'];

			foreach ( $this->matchNamespace( $ref, 'Category' ) as $category ) {
				$found[] = $includeNamespace ? "Category:$category" : $category;
			}
			if ( $includeSchemas ) {
				foreach ( $this->matchNamespace( $ref, 'JsonSchema' ) as $schema ) {
					$found[] = $includeNamespace ? "JsonSchema:$schema" : $schema;
				}
			}
		}

		return $found;
	}

	/**
	 * The Lua pattern `"<Namespace>:([^?]+)"` applied with gmatch, so every
	 * occurrence in the URL is returned and the match runs to the query string
	 * or to the end.
	 *
	 * @return string[]
	 */
	private function matchNamespace( string $ref, string $namespace ): array {
		$pattern = '/' . preg_quote( $namespace, '/' ) . ':([^?]+)/';
		return preg_match_all( $pattern, $ref, $matches ) ? $matches[1] : [];
	}
}
