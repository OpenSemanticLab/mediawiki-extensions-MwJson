<?php

namespace MediaWiki\Extension\MwJson\Mw;

/**
 * Records which pages a schema resolution actually read, and at which revision.
 *
 * Resolving a schema touches an unpredictable set of pages: the whole category
 * chain, every `$ref` target, and any patch pages. Caching the result is only
 * safe if the cache entry knows that set, so the collector is threaded through
 * the slot readers and every implementation of SlotTextLoader records what it
 * looked at.
 *
 * Two ids per page, because the read revision and the current one come apart
 * whenever a page is being served at anything other than its latest revision.
 * The read id is what the output was built from and is what gets registered as
 * a parser dependency; the current id is what freshness compares against, since
 * one batched title lookup answers it for the whole set.
 *
 * @see ResolvedSchemaCache
 */
class SlotDependencies {

	/** @var array<string,int> prefixed page title => revision read, 0 if absent */
	private array $read = [];

	/** @var array<string,int> prefixed page title => latest revision id, 0 if absent */
	private array $latest = [];

	/**
	 * A page that does not exist is recorded with revision 0 rather than
	 * skipped. Creating it must invalidate the entry, and only a recorded
	 * absence can detect that.
	 */
	public function record( string $pageTitle, int $readRevisionId, int $latestRevisionId ): void {
		$this->read[$pageTitle] = $readRevisionId;
		$this->latest[$pageTitle] = $latestRevisionId;
	}

	/**
	 * The revisions the resolution read.
	 *
	 * @return array<string,int>
	 */
	public function getAll(): array {
		$read = $this->read;
		ksort( $read, SORT_STRING );
		return $read;
	}

	/**
	 * What was current at the time of the read.
	 *
	 * @return array<string,int>
	 */
	public function getLatest(): array {
		$latest = $this->latest;
		ksort( $latest, SORT_STRING );
		return $latest;
	}

	public function reset(): void {
		$this->read = [];
		$this->latest = [];
	}

	public function isEmpty(): bool {
		return $this->read === [];
	}
}
