<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Cache\LinkBatchFactory;
use MediaWiki\Extension\MwJson\Render\LinkLabelResolver;
use MediaWiki\Permissions\PermissionManager;
use MediaWiki\Title\TitleFactory;
use MediaWiki\User\UserIdentity;
use ParserOutput;
use SMW\DIProperty;
use SMW\DIWikiPage;
use SMW\RequestOptions;
use SMW\Store;
use SMWDIContainer;

/**
 * Resolves link labels by reading the store in bulk, replacing one SMW query
 * per link.
 *
 * ## Why not the query, and why not plain store reads either
 *
 * Module:Viewer/Link runs `mw.smw.ask` per link purely to find the target's
 * label. The tree renders a mean of 5 links per page and 1848 on the worst one,
 * which is why that page takes 35 seconds to render.
 *
 * Measured per link, cold, over 300 distinct subjects:
 *
 *     Viewer/Link (one query each)       ~19 ms
 *     Store::getSemanticData             16.02 ms
 *     Store::getPropertyValues, targeted  9.37 ms
 *     PrefetchCache, batched              0.61 ms
 *
 * So the win is not in avoiding the query engine, which is worth about a
 * factor of two. It is in asking for every subject at once: SMW's PrefetchCache
 * loads one property for a whole list of subjects in a single pass, and the
 * per-subject reads afterwards are cache hits. That is what makes this worth
 * doing rather than a lateral move.
 *
 * Dropping the query layer also drops its limits. `$smwgQMaxSize` prunes a
 * query's condition tree in SMW_Query::applyRestrictions(), so a batched
 * disjunction would have to be chunked to a size the wiki configures and this
 * extension does not control: 50 on this stack, 12 on a stock install, with
 * silent truncation past it. Prefetching has no such cap.
 *
 * ## How access is preserved
 *
 * SemanticACL filters query results at SMW::Store::AfterQueryResultLookupComplete
 * with `hasPermission( $title, 'read', $user, false )`, and its
 * getUserPermissionsErrors hook calls that same predicate. So checking
 * PermissionManager::userCan( 'read', ... ) reaches the identical decision by
 * the standard route, and honours any other extension restricting read as well.
 * A target the reader may not see yields no label, which renders as the plain
 * link, exactly as the module does when its query comes back empty.
 *
 * Two parts of that filter are not covered by `userCan` and are handled here
 * explicitly rather than inherited:
 *
 *  - It has a second branch for NS_FILE calling a private
 *    `fileHasRequiredCategory()`. File targets are therefore left to the wiki
 *    template rather than resolved here.
 *  - Its third branch does not deny anything; it disables parser caching when a
 *    page carries a non-public `___VISIBLE`/`___EDITABLE`. Output here varies
 *    per reader under the same conditions, so the same must happen or one
 *    reader's labels get cached and served to everyone.
 */
class SmwLinkLabelResolver implements LinkLabelResolver {

	/** SemanticACL's markers. A non-public value means the rendering depends
	 * on who is reading it. */
	private const ACL_PROPERTIES = [ '___VISIBLE', '___EDITABLE' ];

	private const LABEL = 'HasLabel';
	private const DISPLAY_TITLE = '_DTITLE';
	private const NAME = 'HasName';

	/** Monolingual record members, stored on an `_ML<hash>` subobject. */
	private const TEXT = '_TEXT';
	private const LANGUAGE_CODE = '_LCODE';

	private Store $store;
	private TitleFactory $titleFactory;
	private PermissionManager $permissions;
	private LinkBatchFactory $linkBatchFactory;
	private UserIdentity $user;
	private ParserOutput $parserOutput;
	private string $language;

	/** SMW's batched property loader, or null when this store has none. */
	private $prefetch;

	private RequestOptions $requestOptions;

	/** @var array<string,string|null> Title => label, including nulls. */
	private array $cache = [];

	/**
	 * Subjects the batch actually loaded.
	 *
	 * PrefetchCache::isCached() answers per property, not per subject, so a
	 * subject that missed the batch would read as having no values at all
	 * rather than falling through to the store. Tracking who was in the batch
	 * is what keeps a miss a miss.
	 *
	 * @var array<string,true>
	 */
	private array $prefetched = [];

	public function __construct(
		Store $store,
		TitleFactory $titleFactory,
		PermissionManager $permissions,
		LinkBatchFactory $linkBatchFactory,
		UserIdentity $user,
		ParserOutput $parserOutput,
		string $language
	) {
		$this->store = $store;
		$this->titleFactory = $titleFactory;
		$this->permissions = $permissions;
		$this->linkBatchFactory = $linkBatchFactory;
		$this->user = $user;
		$this->parserOutput = $parserOutput;
		$this->language = $language;
		$this->requestOptions = new RequestOptions();

		try {
			$this->prefetch = $store->service( 'PrefetchCache' );
		} catch ( \Throwable $e ) {
			// Not every store offers one. Without it each read stands alone,
			// which is correct but an order of magnitude slower.
			$this->prefetch = null;
		}
	}

	/**
	 * @inheritDoc
	 */
	public function prefetch( array $titles ): void {
		$subjects = [];
		foreach ( $titles as $text ) {
			$title = $this->titleOf( $text );
			if ( $title !== null ) {
				$subjects[$title->getPrefixedText()] = $title;
			}
		}
		if ( $subjects === [] ) {
			return;
		}

		// One round of title lookups rather than one per link, so the
		// existence and permission checks below do not each hit the database.
		$batch = $this->linkBatchFactory->newLinkBatch();
		foreach ( $subjects as $title ) {
			$batch->addObj( $title );
		}
		$batch->execute();

		if ( $this->prefetch === null ) {
			return;
		}

		$pages = [];
		foreach ( $subjects as $title ) {
			if ( $title->exists() && $title->getNamespace() !== NS_FILE ) {
				$pages[] = DIWikiPage::newFromTitle( $title );
			}
		}
		if ( $pages === [] ) {
			return;
		}

		foreach ( $pages as $page ) {
			$this->prefetched[$page->getHash()] = true;
		}

		foreach ( [ self::LABEL, self::DISPLAY_TITLE, self::NAME ] as $property ) {
			$this->prefetch->prefetch( $pages, new DIProperty( $property ), $this->requestOptions );
		}
		foreach ( self::ACL_PROPERTIES as $property ) {
			$this->prefetch->prefetch( $pages, new DIProperty( $property ), $this->requestOptions );
		}

		// A monolingual label is not stored inline: the subject holds a pointer
		// to an `_ML<hash>` subobject and the text lives there. So the pointers
		// have to be collected before their contents can be prefetched too,
		// which is the second pass.
		$records = [];
		foreach ( $pages as $page ) {
			foreach ( $this->valuesOf( $page, self::LABEL ) as $value ) {
				if ( $value instanceof DIWikiPage ) {
					$records[] = $value;
				}
			}
		}
		if ( $records === [] ) {
			return;
		}

		foreach ( $records as $record ) {
			$this->prefetched[$record->getHash()] = true;
		}

		foreach ( [ self::TEXT, self::LANGUAGE_CODE ] as $property ) {
			$this->prefetch->prefetch( $records, new DIProperty( $property ), $this->requestOptions );
		}
	}

	/**
	 * @inheritDoc
	 */
	public function handles( string $title ): bool {
		$resolved = $this->titleOf( $title );

		// See the class comment: SemanticACL applies a private category check to
		// files that userCan() does not cover, so those are left to the wiki
		// template rather than answered here with a label this cannot vouch for.
		return $resolved !== null && $resolved->getNamespace() !== NS_FILE;
	}

	/**
	 * @inheritDoc
	 */
	public function label( string $title ): ?string {
		if ( array_key_exists( $title, $this->cache ) ) {
			return $this->cache[$title];
		}
		return $this->cache[$title] = $this->resolve( $title );
	}

	private function resolve( string $text ): ?string {
		$title = $this->titleOf( $text );
		if ( $title === null || !$title->exists() ) {
			return null;
		}

		if ( !$this->permissions->userCan( 'read', $this->user, $title ) ) {
			// Output now depends on who is asking, so it must not be cached.
			$this->parserOutput->updateCacheExpiry( 0 );
			return null;
		}

		$subject = DIWikiPage::newFromTitle( $title );
		$fragment = $this->subobjectOf( $text );
		if ( $fragment !== null ) {
			$subject = new DIWikiPage(
				$subject->getDBkey(), $subject->getNamespace(), $subject->getInterwiki(), $fragment
			);
		}

		$this->noteAclDependency( $subject );

		$localized = null;
		$english = null;
		$any = null;

		foreach ( $this->valuesOf( $subject, self::LABEL ) as $value ) {
			[ $label, $language ] = $this->unpackMonolingual( $value );
			if ( $label === null ) {
				continue;
			}
			$any ??= $label;
			if ( $language === $this->language ) {
				$localized ??= $label;
			}
			if ( $language === 'en' ) {
				$english ??= $label;
			}
		}

		// The order Module:Viewer/Link uses: the reader's language, then
		// English, then any label at all, then the display title, then the name.
		return $localized
			?? $english
			?? $any
			?? $this->firstText( $subject, self::DISPLAY_TITLE )
			?? $this->firstText( $subject, self::NAME );
	}

	/**
	 * SemanticACL disables caching for a page carrying a non-public visibility
	 * marker, because whether its data shows depends on the reader. This
	 * resolver reads that same data, so it owes the same.
	 */
	private function noteAclDependency( DIWikiPage $subject ): void {
		foreach ( self::ACL_PROPERTIES as $property ) {
			foreach ( $this->valuesOf( $subject, $property ) as $value ) {
				if ( $value->getSerialization() !== 'public' ) {
					$this->parserOutput->updateCacheExpiry( 0 );
					return;
				}
			}
		}
	}

	/**
	 * Values of one property, from the batch when there is one.
	 *
	 * @return array<int,mixed>
	 */
	private function valuesOf( DIWikiPage $subject, string $property ): array {
		$diProperty = new DIProperty( $property );

		if (
			$this->prefetch !== null
			&& isset( $this->prefetched[$subject->getHash()] )
			&& $this->prefetch->isCached( $diProperty )
		) {
			return $this->prefetch->getPropertyValues( $subject, $diProperty, $this->requestOptions );
		}

		return $this->store->getPropertyValues( $subject, $diProperty );
	}

	private function firstText( DIWikiPage $subject, string $property ): ?string {
		foreach ( $this->valuesOf( $subject, $property ) as $value ) {
			$text = $value->getSerialization();
			if ( is_string( $text ) && $text !== '' ) {
				return $text;
			}
		}
		return null;
	}

	/**
	 * Unpack a `_mlt_rec` value into its text and language code.
	 *
	 * The value normally arrives as a DIWikiPage pointing at the subobject
	 * holding the record, and is dereferenced. It can also arrive already
	 * materialised as a container, which is why both are handled.
	 *
	 * @param mixed $value
	 * @return array{0:?string,1:?string}
	 */
	private function unpackMonolingual( $value ): array {
		if ( $value instanceof SMWDIContainer ) {
			$data = $value->getSemanticData();
			$text = $this->firstOf( $data->getPropertyValues( new DIProperty( self::TEXT ) ) );
			$language = $this->firstOf( $data->getPropertyValues( new DIProperty( self::LANGUAGE_CODE ) ) );
		} elseif ( $value instanceof DIWikiPage ) {
			$text = $this->firstOf( $this->valuesOf( $value, self::TEXT ) );
			$language = $this->firstOf( $this->valuesOf( $value, self::LANGUAGE_CODE ) );
		} else {
			return [ null, null ];
		}

		return [ $text !== '' ? $text : null, $language ];
	}

	/**
	 * @param array<int,mixed> $values
	 */
	private function firstOf( array $values ): ?string {
		foreach ( $values as $value ) {
			$text = $value->getSerialization();
			if ( is_string( $text ) ) {
				return $text;
			}
		}
		return null;
	}

	/** The title behind a `Page#subobject` reference, or null. */
	private function titleOf( string $text ): ?\MediaWiki\Title\Title {
		$page = trim( explode( '#', $text, 2 )[0] );
		return $page === '' ? null : $this->titleFactory->newFromText( $page );
	}

	/** The subobject part, or null when there is none. */
	private function subobjectOf( string $text ): ?string {
		$parts = explode( '#', $text, 2 );
		return isset( $parts[1] ) && $parts[1] !== '' ? $parts[1] : null;
	}
}
