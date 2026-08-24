<?php

namespace MediaWiki\Extension\MwJson\Mw;

/**
 * Records which pages a schema resolution actually read, and at which revision.
 *
 * Resolving a schema touches an unpredictable set of pages: the whole category
 * chain, every `$ref` target, and (once the patch feature lands) any patch
 * pages. Caching the result is only safe if the cache entry knows that set, so
 * the collector is threaded through the slot readers and every implementation
 * of SlotTextLoader records what it looked at.
 *
 * @see ResolvedSchemaCache
 */
class SlotDependencies {

	/** @var array<string,int> prefixed page title => latest revision id, 0 if absent */
	private array $revisions = [];

	/**
	 * A page that does not exist is recorded with revision 0 rather than
	 * skipped. Creating it must invalidate the entry, and only a recorded
	 * absence can detect that.
	 */
	public function record( string $pageTitle, int $revisionId ): void {
		$this->revisions[$pageTitle] = $revisionId;
	}

	/** @return array<string,int> */
	public function getAll(): array {
		$revisions = $this->revisions;
		ksort( $revisions, SORT_STRING );
		return $revisions;
	}

	public function reset(): void {
		$this->revisions = [];
	}

	public function isEmpty(): bool {
		return $this->revisions === [];
	}
}
