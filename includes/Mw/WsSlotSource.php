<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Extension\MwJson\OOLD\SlotTextLoader;
use MediaWiki\Page\WikiPageFactory;
use MediaWiki\Title\TitleFactory;
use TextContent;
use WSSlots\WSSlots;

/**
 * Reads page slots through WSSlots.
 *
 * Replaces mw.slots.slotContent() and, for the main slot, Title:getContent().
 *
 * This class is *the* seam for the slot-patch feature: PatchingSlotSource will
 * decorate a SlotTextLoader, so nothing upstream of here (SlotJsonLoader, the
 * $ref expander, the schema walker) needs to know patches exist.
 *
 * @see \MediaWiki\Extension\MwJson\OOLD\SlotTextLoader
 */
class WsSlotSource implements SlotTextLoader {

	private TitleFactory $titleFactory;
	private WikiPageFactory $wikiPageFactory;
	private ?SlotDependencies $dependencies;

	public function __construct(
		TitleFactory $titleFactory,
		WikiPageFactory $wikiPageFactory,
		?SlotDependencies $dependencies = null
	) {
		$this->titleFactory = $titleFactory;
		$this->wikiPageFactory = $wikiPageFactory;
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

		// Record before the existence check, so that creating a page which the
		// resolution looked for and did not find invalidates the cache entry.
		$this->dependencies?->record( $pageTitle, $title->getLatestRevID() );

		if ( !$title->exists() ) {
			return null;
		}

		$content = WSSlots::getSlotContent( $this->wikiPageFactory->newFromTitle( $title ), $slot );
		if ( !$content instanceof TextContent ) {
			return null;
		}

		return $content->getText();
	}
}
