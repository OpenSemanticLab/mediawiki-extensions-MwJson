<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Extension\MwJson\OOLD\JsonLoader;
use MediaWiki\Extension\MwJson\OOLD\Patch\JsonValue;
use MediaWiki\Extension\MwJson\OOLD\Patch\MergePatch;
use MediaWiki\Extension\MwJson\OOLD\Patch\OverlayPatch;
use MediaWiki\Extension\MwJson\OOLD\Slots;

/**
 * Applies a patch's structural operations to a decoded slot.
 *
 * Sits above SlotJsonLoader rather than inside it. The seam is the decoded
 * document, because that is what both operations work on: a merge patch and an
 * overlay are defined over JSON values, and applying them to the serialised
 * text would mean decoding and re-encoding around every read.
 *
 * Its own memo, because the one underneath caches the unpatched document and
 * the schema walk reads the same page many times over.
 */
class PatchingJsonLoader implements JsonLoader {

	/** The slots a patch may rewrite structurally. */
	private const JSON_SLOTS = [ Slots::JSONDATA, Slots::JSONSCHEMA ];

	private JsonLoader $inner;
	private PatchRegistry $registry;
	private MergePatch $merge;
	private OverlayPatch $overlay;

	/** @var array<string,array> page title => slot => patched document */
	private array $cache = [];

	public function __construct(
		JsonLoader $inner,
		PatchRegistry $registry,
		?MergePatch $merge = null,
		?OverlayPatch $overlay = null
	) {
		$this->inner = $inner;
		$this->registry = $registry;
		$this->merge = $merge ?? new MergePatch();
		$this->overlay = $overlay ?? new OverlayPatch();
	}

	/** @inheritDoc */
	public function load( string $pageTitle, ?string $slot = null ): array {
		$slot ??= Slots::MAIN;

		if ( !in_array( $slot, self::JSON_SLOTS, true ) ) {
			return $this->inner->load( $pageTitle, $slot );
		}
		if ( isset( $this->cache[$pageTitle][$slot] ) ) {
			return $this->cache[$pageTitle][$slot];
		}

		$document = $this->inner->load( $pageTitle, $slot );

		foreach ( $this->registry->forPage( $pageTitle ) as $patch ) {
			$operations = $patch[$slot] ?? null;
			if ( !is_array( $operations ) ) {
				continue;
			}
			foreach ( $operations as $operation ) {
				if ( is_array( $operation ) ) {
					$document = $this->applyOne( $document, $operation );
				}
			}
		}

		$this->cache[$pageTitle][$slot] = $document;
		return $document;
	}

	/**
	 * @param array $document
	 * @param array $operation
	 */
	private function applyOne( array $document, array $operation ): array {
		// Written as text by the editor, or as an object by an older patch.
		$value = JsonValue::decode( $operation['value'] ?? null );
		if ( !is_array( $value ) ) {
			return $document;
		}

		switch ( $operation['mode'] ?? '' ) {
			case 'json-merge-patch':
				$patched = $this->merge->apply( $document, $value );
				// A merge patch may legally replace the whole document with a
				// scalar. A slot has to stay a document, so such a patch is
				// treated as not having applied rather than handing the walker
				// something it cannot use.
				return is_array( $patched ) ? $patched : $document;

			case 'openapi-overlay':
				return $this->overlay->apply( $document, $value );

			default:
				return $document;
		}
	}
}
