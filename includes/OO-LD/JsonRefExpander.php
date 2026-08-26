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
 * `/wiki/Category:Entity?action=raw&slot=jsonschema`.
 *
 * A `$ref` may also carry a JSON Pointer fragment, either on its own
 * (`#/$defs/operation`, into the document being expanded) or after a URL
 * (`/wiki/JsonSchema:X?action=raw#/$defs/y`, into the document that loads).
 * Both are resolved here. The Lua skipped them and inlined the single fragment
 * OSL used, `#/$defs/generated`, in p.loadJson() before the expander ever ran;
 * SlotJsonLoader still does that, so that one keeps its old meaning.
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

	/** Depth limit for pointer chains, so a cycle cannot spin. */
	private const MAX_POINTER_DEPTH = 32;

	private JsonLoader $loader;
	private MergeStrategy $merge;

	/**
	 * The documents a fragment could be resolving against, innermost last.
	 *
	 * A JSON Pointer is relative to the document it appears in, so content
	 * loaded from a `$ref` gets its own base while it is expanded. Without that,
	 * `#/$defs/x` written inside JsonSchema:Foo would be looked up in whatever
	 * document happened to pull Foo in.
	 *
	 * Each entry is the document as it was on entry, not the partially expanded
	 * copy: pointing into a half-rewritten document would make the result depend
	 * on traversal order.
	 *
	 * @var array[]
	 */
	private array $bases = [];

	/** @var string[] Pointers currently being resolved, innermost last. */
	private array $resolving = [];

	/**
	 * Expanded pointer targets, keyed by the reference that named them.
	 *
	 * Not just a saving. The legacy merge appends list-valued members rather
	 * than replacing them, so flattening a chain multiplies the `allOf` entries
	 * that carry a `$ref`, and one schema in the corpus ends up with hundreds of
	 * copies of the same same-document reference. Expanding each copy
	 * separately grows the document, which produces more copies, which is a
	 * feedback loop that exhausts memory rather than terminating.
	 *
	 * @var array<string,array>
	 */
	private array $pointerCache = [];

	public function __construct( JsonLoader $loader, MergeStrategy $merge ) {
		$this->loader = $loader;
		$this->merge = $merge;
	}

	/**
	 * Expand every `$ref` in $json, recursively, then flatten `allOf`.
	 */
	public function expand( array $json ): array {
		$outermost = $this->bases === [];

		try {
			return $this->expandIn( $json, $json );
		} finally {
			if ( $outermost ) {
				$this->resolving = [];
				$this->pointerCache = [];
			}
		}
	}

	/**
	 * Expand $json with $base as the document its fragment refs point into.
	 */
	private function expandIn( array $json, array $base ): array {
		$this->bases[] = $base;
		try {
			return $this->expandNode( $json );
		} finally {
			array_pop( $this->bases );
		}
	}

	private function expandNode( array $json ): array {
		$json = $this->resolveRefs( $json );

		foreach ( $json as $key => $value ) {
			if ( is_array( $value ) ) {
				$json[$key] = $this->expandNode( $value );
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

		[ $url, $pointer ] = $this->splitFragment( $ref );

		if ( $url === '' ) {
			if ( $this->isWholeDocument( $pointer ) ) {
				// "#" means this whole document, which is how a schema declares
				// itself recursive: JsonSchema:Statement's substatements are
				// statements. There is nothing to inline, only an infinite
				// regress, so the reference stays as written.
				return $json;
			}

			$resolved = $this->followPointer( $this->currentBase(), $pointer, $ref );
			if ( $resolved === null ) {
				// Unresolvable, so left exactly as it was. A dangling pointer is
				// an authoring mistake worth seeing in the output rather than
				// silently replacing with nothing.
				return $json;
			}
			unset( $json['$ref'] );
			return $this->merge->merge( $resolved, $json );
		}

		// The Lua drops the `$ref` before it knows whether the URL parsed, so an
		// unparseable ref is removed rather than left in place.
		unset( $json['$ref'] );

		$target = $this->parseRef( $url );
		$loaded = $target === null
			? $this->loader->load( self::UNPARSEABLE_REF_FALLBACK, null )
			: $this->loader->load( $target['title'], $target['slot'] );

		if ( $this->isWholeDocument( $pointer ) ) {
			// Expanded under its own base, so any fragment written inside it
			// points at itself rather than at whatever pulled it in.
			$loaded = $this->expandIn( $loaded, $loaded );
		} else {
			$this->bases[] = $loaded;
			try {
				$loaded = $this->followPointer( $loaded, $pointer, $ref ) ?? [];
			} finally {
				array_pop( $this->bases );
			}
		}

		return $this->merge->merge( $loaded, $json );
	}

	/**
	 * Split a `$ref` into the part that names a document and the pointer into it.
	 *
	 * `%24` is decoded because that is how an encoded `$defs` reaches us; the
	 * client rewrites the same thing on its side (MwJson_schema.js).
	 *
	 * @return array{0:string,1:string} URL (empty for a same-document ref) and
	 *   JSON Pointer (empty when the ref names no fragment).
	 */
	private function splitFragment( string $ref ): array {
		$hash = strpos( $ref, '#' );
		if ( $hash === false ) {
			return [ $ref, '' ];
		}

		return [
			substr( $ref, 0, $hash ),
			str_replace( '%24', '$', substr( $ref, $hash + 1 ) ),
		];
	}

	/**
	 * Does this pointer name the document itself rather than a place in it?
	 */
	private function isWholeDocument( string $pointer ): bool {
		return trim( $pointer, '/' ) === '';
	}

	/**
	 * The document that same-document fragments currently resolve against.
	 */
	private function currentBase(): array {
		return $this->bases === [] ? [] : $this->bases[count( $this->bases ) - 1];
	}

	/**
	 * Walk a JSON Pointer (RFC 6901) into a document.
	 *
	 * @param array $document
	 * @param string $pointer Without the leading `#`, and never empty: a
	 *   whole-document reference is handled before it gets here.
	 * @param string $ref The original reference, for the cycle guard.
	 * @return array|null Null when the pointer does not resolve to an object.
	 */
	private function followPointer( array $document, string $pointer, string $ref ): ?array {
		if ( in_array( $ref, $this->resolving, true )
			|| count( $this->resolving ) >= self::MAX_POINTER_DEPTH
		) {
			// A pointer chain that comes back to itself. Stopping here leaves
			// the node as it stands rather than recursing until PHP gives up.
			return null;
		}

		$node = $document;
		foreach ( explode( '/', ltrim( $pointer, '/' ) ) as $token ) {
			// RFC 6901 escaping: ~1 is "/" and ~0 is "~", decoded in that order.
			$token = str_replace( [ '~1', '~0' ], [ '/', '~' ], rawurldecode( $token ) );
			if ( !is_array( $node ) || !array_key_exists( $token, $node ) ) {
				return null;
			}
			$node = $node[$token];
		}

		if ( !is_array( $node ) ) {
			return null;
		}

		// Keyed by depth as well as by reference: the same "#/$defs/x" means a
		// different thing in a different document.
		$cacheKey = count( $this->bases ) . '|' . $ref;
		if ( array_key_exists( $cacheKey, $this->pointerCache ) ) {
			return $this->pointerCache[$cacheKey];
		}

		// Expanded on the way out, so a target that is itself a ref, or holds
		// refs, arrives resolved rather than passing the problem to the caller.
		$this->resolving[] = $ref;
		try {
			$expanded = $this->expandNode( $node );
		} finally {
			array_pop( $this->resolving );
		}

		$this->pointerCache[$cacheKey] = $expanded;
		return $expanded;
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
