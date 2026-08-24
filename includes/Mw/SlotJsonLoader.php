<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Extension\MwJson\OOLD\JsonLoader;
use MediaWiki\Extension\MwJson\OOLD\JsonUtil;
use MediaWiki\Extension\MwJson\OOLD\MergeStrategy;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\Extension\MwJson\OOLD\SlotTextLoader;

/**
 * Port of Module:MwJson's p.loadJson().
 *
 * Decodes a page slot as JSON, inlines the `#/$defs/generated` subschema that
 * OSL's schema generator emits, and memoises the result per request. A single
 * schema walk reads the same Category page several times over, so the process
 * cache is not an optimisation but a correctness aid: it makes the walk see one
 * consistent snapshot.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class SlotJsonLoader implements JsonLoader {

	/**
	 * The one intra-document reference OSL uses. Schemas generated from
	 * external sources carry their body under `$defs.generated` and point at it
	 * from the root or from `allOf`, so it has to be folded in before the
	 * generic `$ref` expander runs, which skips fragment references.
	 */
	private const GENERATED_REF = '#/$defs/generated';

	private SlotTextLoader $slots;
	private MergeStrategy $merge;

	/** @var array<string,array<string,array>> page title => slot => decoded */
	private array $cache = [];

	public function __construct( SlotTextLoader $slots, MergeStrategy $merge ) {
		$this->slots = $slots;
		$this->merge = $merge;
	}

	/** @inheritDoc */
	public function load( string $pageTitle, ?string $slot = null ): array {
		$slot ??= Slots::MAIN;

		if ( isset( $this->cache[$pageTitle][$slot] ) ) {
			return $this->cache[$pageTitle][$slot];
		}

		$json = $this->inlineGeneratedDefs( $this->decode( $pageTitle, $slot ) );

		$this->cache[$pageTitle][$slot] = $json;
		return $json;
	}

	/**
	 * Drop everything memoised so far.
	 *
	 * The Lua cache lives for one Scribunto environment, which is one parse.
	 * A PHP request can parse several pages, so a long-running caller (a
	 * maintenance script, the job queue) has to say when a parse ends.
	 */
	public function clearCache(): void {
		$this->cache = [];
	}

	private function decode( string $pageTitle, string $slot ): array {
		$text = $this->slots->getText( $pageTitle, $slot );
		if ( $text === null || trim( $text ) === '' ) {
			return [];
		}

		$decoded = json_decode( $text, true );

		// Divergence: mw.text.jsonDecode() raises on malformed JSON, so a
		// broken slot currently takes the whole page render down with a Lua
		// error. Treating it as empty keeps the rest of the page rendering.
		// The parity harness reports any page where this changes the output,
		// which is the point at which the broken slot gets noticed.
		return is_array( $decoded ) ? $decoded : [];
	}

	/**
	 * Fold `$defs.generated` into the document if the root or an `allOf` member
	 * references it, then remove it.
	 *
	 * Deliberately reproduces two details of the original: the generated body
	 * is merged *under* the document, so hand-written keywords beat generated
	 * ones; and if both the root and an `allOf` member reference it, it is
	 * merged twice, because the two branches are independent `if`s rather than
	 * a chain.
	 */
	private function inlineGeneratedDefs( array $json ): array {
		$generated = $json['$defs']['generated'] ?? null;
		if ( !is_array( $generated ) ) {
			return $json;
		}

		if ( ( $json['$ref'] ?? null ) === self::GENERATED_REF ) {
			$json = $this->merge->merge( $generated, $json );
			unset( $json['$ref'] );
		}

		// Re-read: the merge above may have brought in an allOf of its own.
		if ( isset( $json['allOf'] ) && is_array( $json['allOf'] ) ) {
			$index = $this->findGeneratedRef( $json['allOf'] );
			if ( $index !== null ) {
				// The Lua removes only the first matching member, then merges.
				array_splice( $json['allOf'], $index, 1 );
				$json = $this->merge->merge( $generated, $json );
			}
		}

		unset( $json['$defs']['generated'] );
		return $json;
	}

	/**
	 * @param array $members
	 * @return int|null Index of the first member referencing $defs.generated.
	 */
	private function findGeneratedRef( array $members ): ?int {
		// ipairs() only walks the contiguous run, so a members list with a hole
		// stops there rather than scanning the whole table.
		foreach ( JsonUtil::listPart( $members ) as $index => $member ) {
			if ( is_array( $member ) && ( $member['$ref'] ?? null ) === self::GENERATED_REF ) {
				return $index;
			}
		}
		return null;
	}
}
