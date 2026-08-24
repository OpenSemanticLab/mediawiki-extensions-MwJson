<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Port of Module:MwJson's p.expandJsonRef().
 *
 * Resolves OSL's wiki-hosted `$ref`s and flattens `allOf` into a single merged
 * schema object. Both steps are needed because the downstream consumers (the
 * infobox, the tree renderer, the JSON-LD context builder) want one object to
 * read properties from, not a schema to validate against.
 *
 * Two things this is *not*:
 *
 *  - It is not JSON Schema `$ref` resolution in the standard sense. A standard
 *    resolver replaces the node with the target; this merges the target *under*
 *    the node so sibling keywords win, which is the JSON Schema 2020-12 and
 *    OO-LD behaviour but not draft-04's.
 *  - It is not `allOf` evaluation. Validators treat `allOf` conjunctively and
 *    never merge. Flattening is an OSL/OO-LD operation, so no library does it.
 *
 * Reference URLs are the OSL raw-action form, e.g.
 * `/wiki/JsonSchema:Label?action=raw` or
 * `/wiki/Category:Entity?action=raw&slot=jsonschema`. Fragment-only refs
 * (`#/$defs/...`) are skipped: p.loadJson() inlines the one fragment OSL uses,
 * `#/$defs/generated`, before the expander ever sees the document.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class JsonRefExpander {

	/**
	 * Where a `$ref` that cannot be parsed resolves to.
	 *
	 * Not a design choice: p.loadJson() defaults its title argument to
	 * "JsonSchema:Entity" (marked "--for testing" in the source), and
	 * p.expandJsonRef() passes it a nil title whenever the ref's path has no
	 * "wiki/" segment. So a malformed ref silently pulls the Entity schema into
	 * the document instead of failing. Reproduced for parity, with the `$ref`
	 * dropped either way. Remove this once the Lua is gone.
	 */
	private const UNPARSEABLE_REF_FALLBACK = 'JsonSchema:Entity';

	private JsonLoader $loader;
	private MergeStrategy $merge;

	public function __construct( JsonLoader $loader, MergeStrategy $merge ) {
		$this->loader = $loader;
		$this->merge = $merge;
	}

	/**
	 * Expand every `$ref` in $json, recursively, then flatten `allOf`.
	 */
	public function expand( array $json ): array {
		$json = $this->resolveRefs( $json );

		foreach ( $json as $key => $value ) {
			if ( is_array( $value ) ) {
				$json[$key] = $this->expand( $value );
			}
		}

		return $this->flattenAllOf( $json );
	}

	/**
	 * Replace this node's `$ref` with the referenced document, merged *under*
	 * the node so the node's own keywords win.
	 */
	private function resolveRefs( array $json ): array {
		if ( !isset( $json['$ref'] ) || !is_string( $json['$ref'] ) ) {
			return $json;
		}

		$ref = $json['$ref'];
		if ( str_contains( $ref, '#' ) ) {
			// Relative/fragment reference. p.loadJson() has already inlined
			// "#/$defs/generated"; anything else is left as-is rather than
			// guessed at.
			return $json;
		}

		// The Lua drops the `$ref` before it knows whether the URL parsed, so an
		// unparseable ref is removed rather than left in place.
		unset( $json['$ref'] );

		$target = $this->parseRef( $ref );
		$loaded = $target === null
			? $this->loader->load( self::UNPARSEABLE_REF_FALLBACK, null )
			: $this->loader->load( $target['title'], $target['slot'] );

		return $this->merge->merge( $loaded, $json );
	}

	/**
	 * Split a raw-action reference URL into page title and slot.
	 *
	 * Mirrors the Lua, which does mw.uri.new(v) then splits the path on the
	 * literal "wiki/" and takes what follows, so anything before the article
	 * path is ignored and both relative and absolute URLs work.
	 *
	 * @return array{title:string,slot:?string}|null Null when the URL has no
	 *   "wiki/" segment; see UNPARSEABLE_REF_FALLBACK for what happens then.
	 */
	private function parseRef( string $ref ): ?array {
		$parts = explode( '?', $ref, 2 );
		$path = $parts[0];

		$segments = explode( 'wiki/', $path, 2 );
		if ( count( $segments ) < 2 || $segments[1] === '' ) {
			return null;
		}

		$slot = null;
		if ( isset( $parts[1] ) ) {
			parse_str( $parts[1], $query );
			$slot = isset( $query['slot'] ) && is_string( $query['slot'] ) ? $query['slot'] : null;
		}

		return [
			'title' => urldecode( $segments[1] ),
			'slot' => $slot,
		];
	}

	/**
	 * Fold `allOf` members into the node itself and drop the keyword.
	 *
	 * Each member is merged *under* the accumulated result, so the node's own
	 * keywords beat every member, and an earlier member beats a later one.
	 *
	 * That last part is worth stating plainly because OO-LD specifies the
	 * opposite: its array-valued `@context` resolves most-recently-defined-wins.
	 * Reproduced as-is here; changing it is part of the OO-LD phase and needs
	 * its own parity run.
	 */
	private function flattenAllOf( array $json ): array {
		if ( !array_key_exists( 'allOf', $json ) ) {
			return $json;
		}

		$members = $json['allOf'];
		if ( !is_array( $members ) ) {
			$members = [ $members ];
		} elseif ( !JsonUtil::hasFirstElement( $members ) ) {
			// A bare object rather than a list of them. The Lua wraps it the
			// same way, including the empty-table case, which wraps to a list
			// containing one empty table and merges to a no-op.
			$members = [ $members ];
		}

		$result = $json;
		foreach ( $members as $member ) {
			$result = $this->merge->merge( $member, $result );
		}

		unset( $result['allOf'] );
		return $result;
	}
}
