<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Extension\MwJson\OOLD\JsonLoader;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\Title\TitleFactory;
use SMW\DIProperty;
use SMW\RequestOptions;
use SMW\Store;
use Throwable;

/**
 * Which patches apply to a page, for the patch sets this reader asked for.
 *
 * ## One query, not one per page
 *
 * The obvious implementation asks the store "what targets this page?" for each
 * page a render touches, which is a query per page in the category chain. That
 * is the per-page query cost SmwLinkLabelResolver was written to remove, and it
 * would be paid on every render whether or not any patch exists.
 *
 * Instead: one query for every page that has HasPatchTarget at all, once per
 * request. Patches are few, so the answer is small, and their targets come out
 * of the jsondata slot that has to be read anyway in order to apply them. This
 * scales with the number of patches rather than the size of the wiki, which is
 * the right way round for a feature meant to hold a handful of exceptions.
 *
 * ## Reading a patch is never itself patched
 *
 * The loader here is a plain one, deliberately not the patched loader the
 * pipeline uses. A patch that could patch patch pages would recurse, and the
 * set of patches has to be a fixed point before any of them is applied.
 *
 * ## The query is a hint, the type is the authority
 *
 * Anyone who can edit any page can put a page in the result: `{{#set:
 * HasPatchTarget=... }}` in plain wikitext is enough, and so is a category
 * whose `@context` maps the property. Both were demonstrated by an unprivileged
 * account. So the query says only "look at these", never "apply these".
 *
 * What decides is the jsondata `type` of the page itself, which is the one
 * signal that cannot be produced without writing the slot the edit guard
 * checks. It must name $wgMwJsonPatchCategory directly. Subclasses are not
 * followed, deliberately: the candidate list is attacker controlled, and
 * walking a class chain per candidate reads slots per candidate, which turns a
 * cheap flood of {{#set}} calls into a slow wiki. A direct comparison is O(1)
 * and the candidate list is capped besides.
 */
class PatchRegistry {

	/** The only property registered for patches. Discovery is all an index is for. */
	public const PROPERTY = 'HasPatchTarget';

	/**
	 * How many candidates are looked at before giving up.
	 *
	 * The list is attacker controlled, so it needs a ceiling. Far above any
	 * plausible number of real patches, and far below what would hurt.
	 */
	private const MAX_CANDIDATES = 500;

	private Store $store;
	private JsonLoader $loader;
	private GuardedCategories $guard;
	private TitleFactory $titleFactory;

	/** Prefixed title of the category a patch must declare as its type. */
	private string $patchCategory;

	/** @var string[] Patch sets this reader is asking for. */
	private array $requested;

	/** @var array<string,array[]>|null target page => patches, built on first use. */
	private ?array $byTarget = null;

	/** @var array<string,int> patch page => revision, for cache keying. */
	private array $seen = [];

	/**
	 * @param string[] $requestedPatchsets Empty means no patch applies, which
	 *   is what keeps package export and every other raw consumer unaffected.
	 */
	public function __construct(
		Store $store,
		JsonLoader $loader,
		array $requestedPatchsets,
		GuardedCategories $guard,
		TitleFactory $titleFactory,
		string $patchCategory
	) {
		$this->patchCategory = self::normaliseTitle( $patchCategory );
		$this->store = $store;
		$this->loader = $loader;
		$this->requested = $requestedPatchsets;
		$this->guard = $guard;
		$this->titleFactory = $titleFactory;
	}

	/**
	 * Patches that modify this page, in the order they must be applied.
	 *
	 * @return array[] Each a decoded patch jsondata slot.
	 */
	public function forPage( string $pageTitle ): array {
		if ( $this->requested === [] ) {
			return [];
		}
		$this->build();
		return $this->byTarget[$this->normalise( $pageTitle )] ?? [];
	}

	/**
	 * Identifies the set of patches in play, for a cache key.
	 *
	 * A cache entry computed under one set of patches must not be served under
	 * another, and the usual dependency mechanism cannot express that: it
	 * revalidates pages it recorded, so it notices a patch being edited but not
	 * a patch being created, which is precisely the change that makes a page
	 * start differing. Folding the whole set into the key covers all three of
	 * created, edited and deleted.
	 */
	public function fingerprint(): string {
		if ( $this->requested === [] ) {
			return 'none';
		}
		$this->build();

		$parts = $this->requested;
		sort( $parts, SORT_STRING );
		foreach ( $this->seen as $page => $revision ) {
			$parts[] = "$page:$revision";
		}

		return substr( sha1( implode( '|', $parts ) ), 0, 16 );
	}

	/**
	 * @return array<string,int> Patch page => revision, so the caller can record
	 *   them as dependencies of whatever it is building.
	 */
	public function getPatchPages(): array {
		if ( $this->requested !== [] ) {
			$this->build();
		}
		return $this->seen;
	}

	private function build(): void {
		if ( $this->byTarget !== null ) {
			return;
		}
		$this->byTarget = [];

		foreach ( $this->patchPages() as $page ) {
			$patch = $this->loader->load( $page, Slots::JSONDATA );
			// Recorded even when the patch turns out not to apply. Its revision
			// is part of what decided that, so a later edit has to be visible.
			$this->seen[$page] = $this->revisionOf( $page );

			if ( !$this->mayPatch( $patch ) || !$this->applies( $patch ) ) {
				continue;
			}

			foreach ( $this->targetsOf( $patch ) as $target ) {
				$this->byTarget[$target][] = [ 'page' => $page, 'patch' => $patch ];
			}
		}

		foreach ( $this->byTarget as $target => $entries ) {
			// Lower priority first, ties broken on the patch page title so the
			// result does not depend on the order the store happened to return.
			usort( $entries, static function ( array $a, array $b ) {
				return [ (int)( $a['patch']['priority'] ?? 100 ), $a['page'] ]
					<=> [ (int)( $b['patch']['priority'] ?? 100 ), $b['page'] ];
			} );
			$this->byTarget[$target] = array_column( $entries, 'patch' );
		}
	}

	/**
	 * Every page carrying the property, in one query.
	 *
	 * @return string[]
	 */
	private function patchPages(): array {
		try {
			$options = new RequestOptions();
			$options->limit = self::MAX_CANDIDATES;
			$subjects = $this->store->getAllPropertySubjects( new DIProperty( self::PROPERTY ), $options );
		} catch ( Throwable $error ) {
			// An unknown property on a wiki that has never had a patch, or a
			// store mid-rebuild. Neither is a reason to fail a page render.
			return [];
		}

		$pages = [];
		foreach ( $subjects as $subject ) {
			$title = $subject->getTitle();
			if ( $title !== null ) {
				$pages[] = $title->getPrefixedText();
			}
		}

		sort( $pages, SORT_STRING );
		return $pages;
	}

	/**
	 * Is this page one whose creation was restricted?
	 *
	 * Carrying the property is not enough: it is granted by a schema, and
	 * writing a schema that grants it is not restricted.
	 */
	private function mayPatch( array $patch ): bool {
		if ( $this->patchCategory === '' ) {
			return false;
		}

		$types = $patch['type'] ?? null;
		if ( is_string( $types ) ) {
			$types = [ $types ];
		}
		if ( !is_array( $types ) ) {
			return false;
		}

		foreach ( $types as $type ) {
			if ( is_string( $type ) && self::normaliseTitle( $type ) === $this->patchCategory ) {
				// And writing one has to have taken a right, or the class is a
				// patch class in name only and anyone can populate it.
				return $this->guard->rightsForData( $patch ) !== [];
			}
		}

		return false;
	}

	private function applies( array $patch ): bool {
		$declared = $patch['patchset'] ?? null;
		if ( !is_array( $declared ) ) {
			return false;
		}
		return array_intersect( $declared, $this->requested ) !== [];
	}

	/**
	 * @return string[]
	 */
	private function targetsOf( array $patch ): array {
		$targets = $patch['target'] ?? null;
		if ( is_string( $targets ) ) {
			$targets = [ $targets ];
		}
		if ( !is_array( $targets ) ) {
			return [];
		}

		$normalised = [];
		foreach ( $targets as $target ) {
			if ( is_string( $target ) && $target !== '' ) {
				$normalised[] = $this->normalise( $target );
			}
		}
		return $normalised;
	}

	private function revisionOf( string $page ): int {
		$title = $this->titleFactory->newFromText( $page );
		return $title === null ? 0 : $title->getLatestRevID();
	}

	private static function normaliseTitle( string $title ): string {
		return trim( str_replace( '_', ' ', $title ) );
	}

	private function normalise( string $title ): string {
		return trim( str_replace( '_', ' ', $title ) );
	}
}
