<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Extension\MwJson\OOLD\Patch\WikitextOps;
use MediaWiki\Extension\MwJson\OOLD\SlotTextLoader;

/**
 * Applies a patch's wikitext operations as a slot is read.
 *
 * Keyed on the page being read, not on the page being rendered, which is what
 * makes a patched category stay patched however it is reached: opened directly,
 * or pulled in as one link of a subcategory's inheritance chain. Both are the
 * same read.
 *
 * Only the template slots are handled here. jsondata and jsonschema are patched
 * after decoding, in PatchingJsonLoader, because a structural patch applied to
 * text would mean decode, patch, re-encode, and would churn key order for
 * nothing.
 */
class PatchingSlotSource implements SlotTextLoader {

	/** The slots a patch may rewrite as text. */
	private const WIKITEXT_SLOTS = [ 'header_template', 'footer_template' ];

	private SlotTextLoader $inner;
	private PatchRegistry $registry;
	private WikitextOps $ops;

	public function __construct(
		SlotTextLoader $inner,
		PatchRegistry $registry,
		?WikitextOps $ops = null
	) {
		$this->inner = $inner;
		$this->registry = $registry;
		$this->ops = $ops ?? new WikitextOps();
	}

	/** @inheritDoc */
	public function getText( string $pageTitle, string $slot ): ?string {
		$text = $this->inner->getText( $pageTitle, $slot );

		if ( !in_array( $slot, self::WIKITEXT_SLOTS, true ) ) {
			return $text;
		}

		$operations = [];
		foreach ( $this->registry->forPage( $pageTitle ) as $patch ) {
			$slotOperations = $patch[$slot] ?? null;
			if ( is_array( $slotOperations ) && $slotOperations !== [] ) {
				$operations[] = $slotOperations;
			}
		}

		if ( $operations === [] ) {
			// Nothing to do, and the distinction between an absent slot and an
			// empty one is preserved: callers read null as "this page has no
			// template", which is not the same as "its template is blank".
			return $text;
		}

		$patched = $text ?? '';
		foreach ( $operations as $slotOperations ) {
			// A patch may create a slot the page never had. That is the common
			// case for footer_template: most categories do not define one, and
			// a patch adding a footer is the whole point.
			$patched = $this->ops->apply( $patched, $slotOperations, "$pageTitle/$slot" );
		}

		return $patched;
	}
}
