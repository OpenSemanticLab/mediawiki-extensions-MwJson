<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Port of Module:MwJson's p.buildContext().
 *
 * Flattens a schema's JSON-LD `@context` declarations into one term map, which
 * SemanticPropertyMapper then uses to decide which SMW property each jsondata
 * key maps to.
 *
 * ## Why this is not `ml/json-ld`
 *
 * `ml/json-ld` is vendored and does real context processing, but it implements
 * **JSON-LD 1.0 only**: its keyword table has no `@version`, `@protected`,
 * `@propagate` or `@nest`, and therefore no property-scoped or type-scoped
 * contexts. Those are exactly what OSL uses here and what OO-LD requires, and
 * there is no maintained 1.1 processor for PHP. So the scoped-context assembly
 * stays hand-rolled, as it already is in the Lua.
 *
 * Two behaviours to know about, both inherited deliberately:
 *
 *  - **Remote context imports are dropped.** A context member that is a bare
 *    string in a list position, which in JSON-LD means "import this context by
 *    IRI", is skipped rather than fetched. The Lua has the line commented out.
 *  - **Nested contexts are pulled up, not scoped.** A context value that is an
 *    object without `@id` or `@reverse` is treated as a nested context and
 *    merged into the *top level* of the result, so its terms apply everywhere
 *    rather than only within that property. Under JSON-LD 1.1 that would be a
 *    property-scoped context and would not leak.
 *
 * @see docs/library-choices.md
 * @see docs/legacy-lua/MwJson.lua
 */
class ContextBuilder {

	private SchemaKeys $keys;
	private MergeStrategy $merge;

	public function __construct( ?SchemaKeys $keys = null, ?MergeStrategy $merge = null ) {
		$this->keys = $keys ?? new SchemaKeys();
		$this->merge = $merge ?? new LegacyLuaMergeStrategy();
	}

	/**
	 * Build the term map for a schema.
	 */
	public function build( array $schema ): array {
		$result = $this->collectTerms( $schema[$this->keys->legacy( 'context' )] ?? null, [] );
		return $this->attachPropertyContexts( $schema, $result );
	}

	/**
	 * Build a term map from a context value directly, without a surrounding
	 * schema. Used for the nested-context case and by callers that already hold
	 * a context.
	 *
	 * @param mixed $context
	 */
	public function fromContext( $context ): array {
		return $this->collectTerms( $context, [] );
	}

	/**
	 * @param mixed $context
	 */
	private function collectTerms( $context, array $result ): array {
		if ( !is_array( $context ) ) {
			return $result;
		}

		foreach ( $context as $term => $definition ) {
			if ( is_int( $term ) && is_string( $definition ) ) {
				// A remote context IRI. Skipped, see the class comment.
				continue;
			}

			if ( is_array( $definition ) && JsonUtil::hasFirstElement( $definition ) ) {
				// A term mapped to several properties at once, which OSL writes
				// with a trailing asterisk: "type*": ["Property:HasType", ...].
				$result[$term] = $definition;
				continue;
			}

			if (
				is_array( $definition )
				&& !array_key_exists( '@id', $definition )
				&& !array_key_exists( '@reverse', $definition )
			) {
				// A nested context, merged at the top level rather than scoped.
				$result = $this->merge->merge( $result, $this->collectTerms( $definition, [] ) );
				continue;
			}

			$result[$term] = $definition;
		}

		return $result;
	}

	/**
	 * Give each object-valued property its own nested `@context`, built from
	 * that property's subschema.
	 *
	 * This is the part that does behave like a scoped context: the sub-terms
	 * are filed under the property rather than pulled up. SemanticPropertyMapper
	 * pulls them up on demand when it descends into the property's value.
	 */
	private function attachPropertyContexts( array $schema, array $result ): array {
		$contextKey = $this->keys->legacy( 'context' );

		foreach ( $schema['properties'] ?? [] as $name => $definition ) {
			if ( !is_array( $definition ) ) {
				continue;
			}

			$subcontext = null;
			if ( ( $definition['type'] ?? null ) === 'object' ) {
				$subcontext = $this->build( $definition );
			} elseif ( ( $definition['items']['type'] ?? null ) === 'object' ) {
				$subcontext = $this->build( $definition['items'] );
			}

			if ( $subcontext === null || $subcontext === [] ) {
				continue;
			}

			$existing = $result[$name] ?? null;
			if ( $existing === null ) {
				$existing = [];
			} elseif ( is_string( $existing ) ) {
				// A term already mapped to a plain IRI becomes the expanded
				// form so the nested context has somewhere to live.
				$existing = [ '@id' => $existing ];
			} elseif ( !is_array( $existing ) ) {
				$existing = [];
			}

			$existing[$contextKey] = $this->merge->merge( $existing[$contextKey] ?? [], $subcontext );
			$result[$name] = $existing;
		}

		return $result;
	}
}
