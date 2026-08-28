<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Page\WikiPageFactory;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;

/**
 * Which revision of a page a slot read should see.
 *
 * Slot reads are addressed by title, so without this they always land on the
 * page's current revision, whatever revision is actually being rendered or
 * stored. Under ApprovedRevs that means approved wikitext rendered over
 * unapproved data, and SemanticMediaWiki handed values from a revision it did
 * not store.
 *
 * Three sources, in order:
 *
 * 1. **The revision being parsed**, for the page being parsed. ApprovedRevs
 *    swaps the whole revision at both ends, an `Article` pinned to the approved
 *    id for a view and a render of the approved RevisionRecord for the link
 *    updates, so the parse already *is* of the approved revision and reading its
 *    slots is all that is needed. This also fixes `?oldid=` views, which show
 *    current-revision data today.
 * 2. **The guard**, for every other page: the category chain, `$ref` targets and
 *    patch pages. Those have no parse to draw on, so something has to answer for
 *    the title alone. PipelineFactory supplies SemanticMediaWiki's RevisionGuard
 *    here, which is what decides the revision SMW itself stores, so the two
 *    cannot disagree about what was written.
 * 3. **The page's current revision**, which is what the guard returns when
 *    nothing implements its hooks, and what a resolver built without one uses.
 *
 * A revision with no id is never pinned. A preview renders content that was
 * never saved, and caching a resolution taken from it would serve one editor's
 * draft to every reader.
 */
class RevisionResolver {

	private WikiPageFactory $wikiPageFactory;

	/** @var callable(Title,?RevisionRecord):?RevisionRecord|null */
	private $guard;

	private ?RevisionRecord $parsedRevision;
	private ?string $parsedTitle;

	/**
	 * @param WikiPageFactory $wikiPageFactory
	 * @param callable|null $guard fn( Title, ?RevisionRecord ): ?RevisionRecord.
	 *   Null leaves every page at its current revision, which is the answer for
	 *   a wiki with no approval mechanism and the one a caller wants when it
	 *   must judge what is stored rather than what a reader sees.
	 * @param RevisionRecord|null $parsedRevision The revision being parsed.
	 * @param string|null $parsedTitle Prefixed title of the page being parsed.
	 */
	public function __construct(
		WikiPageFactory $wikiPageFactory,
		?callable $guard = null,
		?RevisionRecord $parsedRevision = null,
		?string $parsedTitle = null
	) {
		$this->wikiPageFactory = $wikiPageFactory;
		$this->guard = $guard;
		$this->parsedRevision = $parsedRevision;
		$this->parsedTitle = $parsedTitle;
	}

	/**
	 * @return RevisionRecord|null Null when the page does not exist.
	 */
	public function forTitle( Title $title ): ?RevisionRecord {
		if ( !$title->canExist() ) {
			return null;
		}

		if ( $this->isPinned( $title ) ) {
			return $this->parsedRevision;
		}

		$current = $this->wikiPageFactory->newFromTitle( $title )->getRevisionRecord();
		if ( $this->guard === null || $current === null ) {
			return $current;
		}

		// A guard that declines to answer returns null, which means "no opinion"
		// rather than "no revision": falling back to the current one keeps a
		// misbehaving hook from blanking every page on the wiki.
		return ( $this->guard )( $title, $current ) ?? $current;
	}

	/**
	 * The revision this page is pinned to, when that is not its current one.
	 *
	 * Callers that cache a result keyed on the page have to include this, or a
	 * request for an old revision stores its answer under the key the current
	 * revision reads from. Zero for the ordinary case, so the key is unchanged
	 * for every page that is being rendered at its current revision.
	 */
	public function pinnedRevisionFor( Title $title ): int {
		if ( !$this->isPinned( $title ) ) {
			return 0;
		}

		$id = $this->parsedRevision->getId();
		return $id === $title->getLatestRevID() ? 0 : $id;
	}

	/**
	 * @phan-assert-true-condition $this->parsedRevision
	 */
	private function isPinned( Title $title ): bool {
		return $this->parsedRevision !== null
			&& (int)$this->parsedRevision->getId() > 0
			&& $this->parsedTitle === $title->getPrefixedText();
	}
}
