<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Extension\MwJson\OOLD\SlotTextLoader;
use MediaWiki\Title\TitleFactory;
use TextContent;

/**
 * Reads page slots.
 *
 * Replaces mw.slots.slotContent() and, for the main slot, Title:getContent().
 *
 * Which revision each read lands on is RevisionResolver's decision, not this
 * class's: reading the page's current revision regardless of what is being
 * rendered is exactly the bug that made a page under ApprovedRevs show approved
 * wikitext over unapproved data.
 *
 * This class is *the* seam for the slot-patch feature: PatchingSlotSource
 * decorates a SlotTextLoader, so nothing upstream of here (SlotJsonLoader, the
 * $ref expander, the schema walker) needs to know patches exist.
 *
 * @see \MediaWiki\Extension\MwJson\OOLD\SlotTextLoader
 */
class WsSlotSource implements SlotTextLoader {

	private TitleFactory $titleFactory;
	private RevisionResolver $revisions;
	private ?SlotDependencies $dependencies;

	public function __construct(
		TitleFactory $titleFactory,
		RevisionResolver $revisions,
		?SlotDependencies $dependencies = null
	) {
		$this->titleFactory = $titleFactory;
		$this->revisions = $revisions;
		$this->dependencies = $dependencies;
	}

	/** @inheritDoc */
	public function getText( string $pageTitle, string $slot ): ?string {
		// Divergence from p.loadJson(), which resolves a main-slot title with
		// mw.title.makeTitle( split(title,':')[1], split(title,':')[2] ) and so
		// silently truncates anything after a second colon: "Category:A:B"
		// loads "Category:A". Using the normal title parser instead means such
		// a page resolves correctly rather than to the wrong content. No known
		// page has a colon in its title, and the parity harness will flag it if
		// one does.
		$title = $this->titleFactory->newFromText( $pageTitle );
		if ( $title === null || !$title->canExist() ) {
			return null;
		}

		$revision = $this->revisions->forTitle( $title );

		// Recorded before the existence check, so that creating a page which the
		// resolution looked for and did not find invalidates the cache entry.
		//
		// Both ids, because they answer different questions. The one that was
		// read is what the page's output was built from; the one that was
		// current is what a later request can compare against cheaply, since an
		// approval moves the first without moving the second.
		$this->dependencies?->record(
			$pageTitle,
			(int)( $revision?->getId() ?? 0 ),
			$title->getLatestRevID()
		);

		if ( $revision === null || !$revision->hasSlot( $slot ) ) {
			return null;
		}

		$content = $revision->getContent( $slot );
		if ( !$content instanceof TextContent ) {
			return null;
		}

		return $content->getText();
	}
}
