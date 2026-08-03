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
use SMW\Store;
use SMWDIContainer;

/**
 * Resolves link labels by reading the store, replacing one SMW query per link.
 *
 * ## Why this is not a query
 *
 * Module:Viewer/Link runs `mw.smw.ask` per link purely to find the target's
 * label. On this stack the query engine is a SPARQLStore, so each of those is
 * an HTTP round trip to the triple store: measured at ~99 ms in isolation and
 * ~19 ms marginal inside a warm page render, against **0.86 ms** for the
 * equivalent `getSemanticData` read, which the SPARQLStore delegates to its SQL
 * base store. The tree renders a mean of 5 links per page and 1848 on the worst
 * one, which is why that page takes 35 seconds.
 *
 * Dropping the query layer also drops its limits. `$smwgQMaxSize` prunes a
 * query's condition tree in SMW_Query::applyRestrictions(), so a batched
 * disjunction would have to be chunked to a size the wiki configures and this
 * extension does not control: 50 on this stack, 12 on a stock install, with
 * silent truncation past it. A store read has no such cap.
 *
 * ## How access is preserved
 *
 * SemanticACL filters query results at SMW::Store::AfterQueryResultLookupComplete
 * with `hasPermission( $title, 'read', $user, false )`, and its
 * getUserPermissionsErrors hook calls that same predicate. So checking
 * PermissionManager::userCan( 'read', ... ) reaches the identical decision by
 * the standard route, and honours any other extension restricting read as well.
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

	/** SemanticACL's markers. Presence with a non-public value means the
	 * rendering depends on who is reading it. */
	private const ACL_PROPERTIES = [ '___VISIBLE', '___EDITABLE' ];

	/** Monolingual text record members, as stored for a `_mlt_rec` property. */
	private const TEXT = '_TEXT';
	private const LANGUAGE_CODE = '_LCODE';

	private Store $store;
	private TitleFactory $titleFactory;
	private PermissionManager $permissions;
	private LinkBatchFactory $linkBatchFactory;
	private UserIdentity $user;
	private ParserOutput $parserOutput;
	private string $language;

	/** @var array<string,string|null> Prefixed title => resolved label. */
	private array $cache = [];

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
	}

	/**
	 * @inheritDoc
	 */
	public function prefetch( array $titles ): void {
		$batch = $this->linkBatchFactory->newLinkBatch();
		$seen = [];

		foreach ( $titles as $text ) {
			$page = $this->pageOf( $text );
			if ( $page === null || isset( $seen[$page] ) ) {
				continue;
			}
			$seen[$page] = true;
			$title = $this->titleFactory->newFromText( $page );
			if ( $title !== null ) {
				$batch->addObj( $title );
			}
		}

		// Fills the title cache, so the existence and permission checks below
		// do not each hit the database.
		$batch->execute();
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
		$page = $this->pageOf( $text );
		if ( $page === null ) {
			return null;
		}

		$title = $this->titleFactory->newFromText( $page );
		if ( $title === null || !$title->exists() ) {
			return null;
		}

		// See the class comment: the ACL filter does more than a read check for
		// files, and reproducing a private method is worse than not claiming to.
		if ( $title->getNamespace() === NS_FILE ) {
			return null;
		}

		if ( !$this->permissions->userCan( 'read', $this->user, $title ) ) {
			// The reader may not see the target, so no label, which renders as
			// the plain link. Output now depends on who is asking.
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

		$data = $this->store->getSemanticData( $subject );
		$this->noteAclDependency( $data );

		$localized = null;
		$english = null;
		$any = null;

		foreach ( $data->getPropertyValues( new DIProperty( 'HasLabel' ) ) as $value ) {
			[ $text2, $language ] = $this->unpackMonolingual( $value );
			if ( $text2 === null ) {
				continue;
			}
			$any ??= $text2;
			if ( $language === $this->language ) {
				$localized ??= $text2;
			}
			if ( $language === 'en' ) {
				$english ??= $text2;
			}
		}

		// The order Module:Viewer/Link uses: the reader's language, then
		// English, then any label at all, then the display title, then the name.
		return $localized
			?? $english
			?? $any
			?? $this->firstText( $data, '_DTITLE' )
			?? $this->firstText( $data, 'HasName' );
	}

	/**
	 * SemanticACL disables caching for a page carrying a non-public visibility
	 * marker, because whether its data shows depends on the reader. This
	 * resolver reads that same data, so it owes the same.
	 *
	 * @param \SMW\SemanticData $data
	 */
	private function noteAclDependency( $data ): void {
		foreach ( $data->getProperties() as $property ) {
			if ( !in_array( $property->getKey(), self::ACL_PROPERTIES, true ) ) {
				continue;
			}
			foreach ( $data->getPropertyValues( $property ) as $value ) {
				if ( $value->getSerialization() !== 'public' ) {
					$this->parserOutput->updateCacheExpiry( 0 );
					return;
				}
			}
		}
	}

	/**
	 * @param \SMW\SemanticData $data
	 */
	private function firstText( $data, string $property ): ?string {
		foreach ( $data->getPropertyValues( new DIProperty( $property ) ) as $value ) {
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
	 * A monolingual record is not stored inline. The parent holds a pointer to
	 * a subobject named `_ML<hash>`, and the text and language live there, so a
	 * value arrives as a DIWikiPage that has to be dereferenced. It can also
	 * arrive already materialised as a container, which is why both are handled.
	 *
	 * @param mixed $value
	 * @return array{0:?string,1:?string}
	 */
	private function unpackMonolingual( $value ): array {
		if ( $value instanceof SMWDIContainer ) {
			$data = $value->getSemanticData();
		} elseif ( $value instanceof DIWikiPage ) {
			$data = $this->store->getSemanticData( $value );
		} else {
			return [ null, null ];
		}

		$text = null;
		$language = null;

		foreach ( $data->getPropertyValues( new DIProperty( self::TEXT ) ) as $value ) {
			$text ??= $value->getSerialization();
		}
		foreach ( $data->getPropertyValues( new DIProperty( self::LANGUAGE_CODE ) ) as $value ) {
			$language ??= $value->getSerialization();
		}

		return [ is_string( $text ) && $text !== '' ? $text : null, $language ];
	}

	/** The page part of a `Page#subobject` reference. */
	private function pageOf( string $text ): ?string {
		$page = trim( explode( '#', $text, 2 )[0] );
		return $page === '' ? null : $page;
	}

	/** The subobject part, or null when there is none. */
	private function subobjectOf( string $text ): ?string {
		$parts = explode( '#', $text, 2 );
		return isset( $parts[1] ) && $parts[1] !== '' ? $parts[1] : null;
	}
}
