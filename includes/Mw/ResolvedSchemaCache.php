<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Cache\LinkBatchFactory;
use MediaWiki\Extension\MwJson\OOLD\SchemaWalkResult;
use MediaWiki\Title\TitleFactory;
use WANObjectCache;

/**
 * Caches a resolved schema chain across requests.
 *
 * Resolving a schema is where the pipeline's time goes: every page render walks
 * the full category chain, re-reads every slot and re-expands every `$ref`,
 * even though the answer is a pure function of the revisions it read. The Lua
 * only memoises within a single parse (`p.cache`), so nothing survives the
 * request.
 *
 * ## Why the key is two-level
 *
 * The dependency set is not known until the work has been done, so it cannot go
 * into the lookup key. Instead the entry is keyed on the subject alone and
 * *stores* the dependency set alongside the result; on read, the recorded
 * revisions are compared against current ones and a mismatch recomputes.
 *
 * Verifying N revisions costs one batched title lookup, against N slot reads
 * plus a full merge to recompute, so the check is worth making. It also means
 * an edit to a base Category invalidates every descendant automatically,
 * without anyone maintaining an invalidation list.
 *
 * Absent pages are recorded at revision 0, so creating a page the resolution
 * looked for and did not find also invalidates.
 */
class ResolvedSchemaCache {

	/**
	 * Bump when the stored shape or the resolution semantics change, so old
	 * entries are ignored rather than deserialised into the wrong shape.
	 */
	private const VERSION = 1;

	private const TTL = WANObjectCache::TTL_DAY;

	private WANObjectCache $cache;
	private TitleFactory $titleFactory;
	private LinkBatchFactory $linkBatchFactory;

	/** @var array<string,SchemaWalkResult> in-request memo, keyed as the WAN cache is */
	/** @var array<string,array{result:SchemaWalkResult,dependencies:array<string,int>}> */
	private array $processCache = [];

	public function __construct(
		WANObjectCache $cache,
		TitleFactory $titleFactory,
		LinkBatchFactory $linkBatchFactory
	) {
		$this->cache = $cache;
		$this->titleFactory = $titleFactory;
		$this->linkBatchFactory = $linkBatchFactory;
	}

	/**
	 * Return the cached resolution for $subjectKey, or compute and store one.
	 *
	 * @param string $subjectKey Identifies what is being resolved: normally the
	 *   subject page title plus the render mode, since header and footer walks
	 *   collect different template slots.
	 * @param SlotDependencies $dependencies Collector the slot readers write
	 *   into. Reset before $compute runs and read after, so it describes
	 *   exactly this resolution.
	 * @param callable():SchemaWalkResult $compute
	 */
	public function get(
		string $subjectKey,
		SlotDependencies $dependencies,
		callable $compute,
		?ParserDependencyRegistrar $registrar = null
	): SchemaWalkResult {
		$key = $this->cache->makeKey( 'mwjson-schema', self::VERSION, $subjectKey );

		// Every exit below registers the same dependency set, because a page
		// served from cache depends on those pages just as much as one that
		// read them. Registering only on a miss would make invalidation depend
		// on whether the entry happened to be warm.
		if ( isset( $this->processCache[$key] ) ) {
			$memo = $this->processCache[$key];
			if ( $registrar !== null ) {
				$registrar->register( $memo['dependencies'] );
			}
			return $memo['result'];
		}

		$entry = $this->cache->get( $key );
		if ( is_array( $entry ) && $this->isFresh( $entry ) ) {
			$result = $this->unserialize( $entry['result'] );
			$recorded = $entry['dependencies'];
			if ( $registrar !== null ) {
				$registrar->register( $recorded );
			}
			$this->processCache[$key] = [ 'result' => $result, 'dependencies' => $recorded ];
			return $result;
		}

		$dependencies->reset();
		$result = $compute();
		$recorded = $dependencies->getAll();
		if ( $registrar !== null ) {
			$registrar->register( $recorded );
		}

		// A resolution that read nothing has no way to be invalidated, so it is
		// not stored. That happens for pages with no schema at all, where
		// recomputing is cheap anyway.
		if ( $recorded !== [] ) {
			$this->cache->set( $key, [
				'dependencies' => $recorded,
				'result' => $this->serialize( $result ),
			], self::TTL );
		}

		$this->processCache[$key] = [ 'result' => $result, 'dependencies' => $recorded ];
		return $result;
	}

	/**
	 * Drop the in-request memo. The shared cache is untouched.
	 *
	 * Needed by long-running callers (maintenance scripts, the job queue) that
	 * parse many pages in one process.
	 */
	public function clearProcessCache(): void {
		$this->processCache = [];
	}

	/**
	 * Every recorded page must still be at the revision it was read at.
	 *
	 * @param array $entry
	 */
	private function isFresh( array $entry ): bool {
		$recorded = $entry['dependencies'] ?? null;
		if ( !is_array( $recorded ) || $recorded === [] || !isset( $entry['result'] ) ) {
			return false;
		}

		$titles = [];
		foreach ( array_keys( $recorded ) as $pageTitle ) {
			$title = $this->titleFactory->newFromText( $pageTitle );
			if ( $title === null ) {
				return false;
			}
			$titles[$pageTitle] = $title;
		}

		// One batched lookup rather than a query per dependency; the chain is
		// commonly a dozen pages deep.
		$linkBatch = $this->linkBatchFactory->newLinkBatch( array_values( $titles ) );
		$linkBatch->setCaller( __METHOD__ );
		$linkBatch->execute();

		foreach ( $titles as $pageTitle => $title ) {
			if ( $title->getLatestRevID() !== $recorded[$pageTitle] ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * SchemaWalkResult is plain data, but storing an object would tie cache
	 * entries to the class shape, so it goes in and out as arrays.
	 */
	private function serialize( SchemaWalkResult $result ): array {
		return [
			'schema' => $result->schema,
			'schemas' => $result->schemas,
			'templates' => $result->templates,
			'visited' => $result->visited,
		];
	}

	private function unserialize( array $stored ): SchemaWalkResult {
		return new SchemaWalkResult(
			$stored['schema'] ?? [],
			$stored['schemas'] ?? [],
			$stored['templates'] ?? [],
			$stored['visited'] ?? []
		);
	}
}
