<?php

namespace MediaWiki\Extension\MwJson\Mw;

use HTMLCacheUpdateJob;
use JobQueueGroup;
use MediaWiki\Config\Config;
use MediaWiki\Page\WikiPageFactory;
use MediaWiki\Title\Title;
use WANObjectCache;

/**
 * Invalidates what an approval changed.
 *
 * ApprovedRevs purges the page being approved and nothing else, which is right
 * for a wiki where a page stands alone. Here a page's output is built from the
 * slots of every category above it, so approving a revision of one category
 * changes the rendering of everything beneath it, and none of those pages are
 * touched.
 *
 * Two invalidations, because two caches hold the result and neither can see an
 * approval on its own. An approval leaves `page_latest` where it was, so
 * ResolvedSchemaCache, which revalidates by comparing revision ids, would keep
 * serving its entry until the day-long TTL ran out.
 */
class ApprovedRevsHooks {

	private Config $config;
	private WANObjectCache $cache;
	private JobQueueGroup $jobQueueGroup;
	private WikiPageFactory $wikiPageFactory;

	public function __construct(
		Config $config,
		WANObjectCache $cache,
		JobQueueGroup $jobQueueGroup,
		WikiPageFactory $wikiPageFactory
	) {
		$this->config = $config;
		$this->cache = $cache;
		$this->jobQueueGroup = $jobQueueGroup;
		$this->wikiPageFactory = $wikiPageFactory;
	}

	/**
	 * @param mixed $output Unused; the hook passes it for parser functions.
	 * @param Title $title
	 * @param int $revisionId
	 * @param mixed $content
	 */
	public function onApprovedRevsRevisionApproved( $output, $title, $revisionId, $content ): void {
		$this->invalidate( $title );
	}

	/**
	 * Unapproving matters as much as approving: it moves the page back to its
	 * latest revision, which is just as much a change to what everything below
	 * it renders from.
	 *
	 * @param mixed $output
	 * @param Title $title
	 * @param mixed $content
	 */
	public function onApprovedRevsRevisionUnapproved( $output, $title, $content ): void {
		$this->invalidate( $title );
	}

	/**
	 * @param mixed $title A Title in practice; the hook does not type it, and a
	 *   caller passing something else must not take the check key down with it.
	 */
	private function invalidate( $title ): void {
		$this->cache->touchCheckKey(
			$this->cache->makeGlobalKey( ResolvedSchemaCache::APPROVAL_CHECK_KEY )
		);

		if ( !$title instanceof Title ) {
			return;
		}

		// The page itself first, and by purging rather than by queueing a
		// links update. SemanticMediaWiki skips an update whose revision it has
		// already stored, and an approval moves no revision, so a refresh is
		// discarded as redundant; only the purge path sets the forced-update
		// flag that gets past that check.
		//
		// ApprovedRevs purges from its approve action but not from its API
		// module, so an approval made through action=approve leaves the stored
		// data describing whichever revision was approved before.
		$this->wikiPageFactory->newFromTitle( $title )->doPurge();

		// Then the pages built from this one, which are known only where the
		// wiki has opted into registering slot reads as parser dependencies,
		// since that is what puts them in templatelinks. Without it there is no
		// backlink set to walk and the job would purge nothing.
		if ( !$this->config->get( 'MwJsonRegisterSlotDependencies' ) ) {
			return;
		}

		$this->jobQueueGroup->lazyPush(
			HTMLCacheUpdateJob::newForBacklinks( $title, 'templatelinks' )
		);
	}
}
