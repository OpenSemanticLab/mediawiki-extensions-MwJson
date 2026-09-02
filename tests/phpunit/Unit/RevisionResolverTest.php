<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\Mw\RevisionResolver;
use MediaWiki\Page\WikiPageFactory;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use MediaWikiUnitTestCase;
use WikiPage;

/**
 * Which revision a slot read lands on.
 *
 * @covers \MediaWiki\Extension\MwJson\Mw\RevisionResolver
 */
class RevisionResolverTest extends MediaWikiUnitTestCase {

	private const SUBJECT = 'Item:Subject';
	private const OTHER = 'Category:Other';

	private function newRevision( ?int $id ): RevisionRecord {
		$revision = $this->createMock( RevisionRecord::class );
		$revision->method( 'getId' )->willReturn( $id );
		return $revision;
	}

	private function newTitle( string $text, int $latest, bool $canExist = true ): Title {
		$title = $this->createMock( Title::class );
		$title->method( 'getPrefixedText' )->willReturn( $text );
		$title->method( 'getLatestRevID' )->willReturn( $latest );
		$title->method( 'canExist' )->willReturn( $canExist );
		return $title;
	}

	/**
	 * @param array<string,RevisionRecord|null> $current Prefixed title => the
	 *   page's current revision, null for a page that does not exist.
	 */
	private function newPageFactory( array $current ): WikiPageFactory {
		$factory = $this->createMock( WikiPageFactory::class );
		$factory->method( 'newFromTitle' )->willReturnCallback(
			function ( $title ) use ( $current ) {
				$page = $this->createMock( WikiPage::class );
				$page->method( 'getRevisionRecord' )
					->willReturn( $current[$title->getPrefixedText()] ?? null );
				return $page;
			}
		);
		return $factory;
	}

	public function testTheParsedRevisionWinsForThePageBeingParsed() {
		$parsed = $this->newRevision( 100 );
		$resolver = new RevisionResolver(
			$this->newPageFactory( [ self::SUBJECT => $this->newRevision( 200 ) ] ),
			null,
			$parsed,
			self::SUBJECT
		);

		$this->assertSame( $parsed, $resolver->forTitle( $this->newTitle( self::SUBJECT, 200 ) ) );
	}

	public function testAnotherPageIsNotPinnedToTheParsedRevision() {
		$other = $this->newRevision( 300 );
		$resolver = new RevisionResolver(
			$this->newPageFactory( [ self::OTHER => $other ] ),
			null,
			$this->newRevision( 100 ),
			self::SUBJECT
		);

		$this->assertSame( $other, $resolver->forTitle( $this->newTitle( self::OTHER, 300 ) ) );
	}

	public function testTheGuardDecidesForEveryOtherPage() {
		$approved = $this->newRevision( 42 );
		$resolver = new RevisionResolver(
			$this->newPageFactory( [ self::OTHER => $this->newRevision( 300 ) ] ),
			static fn ( Title $title, ?RevisionRecord $revision ) => $approved
		);

		$this->assertSame( $approved, $resolver->forTitle( $this->newTitle( self::OTHER, 300 ) ) );
	}

	public function testTheGuardIsHandedTheCurrentRevision() {
		$current = $this->newRevision( 300 );
		$seen = null;
		$resolver = new RevisionResolver(
			$this->newPageFactory( [ self::OTHER => $current ] ),
			static function ( Title $title, ?RevisionRecord $revision ) use ( &$seen ) {
				$seen = $revision;
				return null;
			}
		);
		$resolver->forTitle( $this->newTitle( self::OTHER, 300 ) );

		$this->assertSame( $current, $seen );
	}

	public function testAGuardWithNoOpinionLeavesTheCurrentRevision() {
		// Null from the guard means "no opinion", not "no revision". Reading it
		// as the latter would blank every page the moment a hook misbehaves.
		$current = $this->newRevision( 300 );
		$resolver = new RevisionResolver(
			$this->newPageFactory( [ self::OTHER => $current ] ),
			static fn ( Title $title, ?RevisionRecord $revision ) => null
		);

		$this->assertSame( $current, $resolver->forTitle( $this->newTitle( self::OTHER, 300 ) ) );
	}

	public function testWithoutAGuardEveryPageIsAtItsCurrentRevision() {
		$current = $this->newRevision( 300 );
		$resolver = new RevisionResolver( $this->newPageFactory( [ self::OTHER => $current ] ) );

		$this->assertSame( $current, $resolver->forTitle( $this->newTitle( self::OTHER, 300 ) ) );
	}

	public function testAnUnsavedRevisionIsNotPinned() {
		// A preview parses content that was never saved. Reading its slots would
		// put one editor's draft into a cache entry every reader shares.
		$current = $this->newRevision( 200 );
		$resolver = new RevisionResolver(
			$this->newPageFactory( [ self::SUBJECT => $current ] ),
			null,
			$this->newRevision( null ),
			self::SUBJECT
		);

		$title = $this->newTitle( self::SUBJECT, 200 );
		$this->assertSame( $current, $resolver->forTitle( $title ) );
		$this->assertSame( 0, $resolver->pinnedRevisionFor( $title ) );
	}

	public function testAMissingPageResolvesToNothing() {
		$resolver = new RevisionResolver( $this->newPageFactory( [] ) );

		$this->assertNull( $resolver->forTitle( $this->newTitle( 'Item:Absent', 0 ) ) );
	}

	public function testATitleThatCannotExistResolvesToNothing() {
		$resolver = new RevisionResolver( $this->newPageFactory( [] ) );

		$this->assertNull( $resolver->forTitle( $this->newTitle( 'Special:Version', 0, false ) ) );
	}

	public function testAnOldRevisionDiscriminatesTheCacheKey() {
		$resolver = new RevisionResolver(
			$this->newPageFactory( [ self::SUBJECT => $this->newRevision( 200 ) ] ),
			null,
			$this->newRevision( 100 ),
			self::SUBJECT
		);

		$this->assertSame( 100, $resolver->pinnedRevisionFor( $this->newTitle( self::SUBJECT, 200 ) ) );
	}

	public function testTheCurrentRevisionDoesNotDiscriminateTheCacheKey() {
		// The ordinary page view. Suffixing the key here would give every edit a
		// fresh key instead of revalidating the one that is already warm.
		$resolver = new RevisionResolver(
			$this->newPageFactory( [ self::SUBJECT => $this->newRevision( 200 ) ] ),
			null,
			$this->newRevision( 200 ),
			self::SUBJECT
		);

		$this->assertSame( 0, $resolver->pinnedRevisionFor( $this->newTitle( self::SUBJECT, 200 ) ) );
	}

	public function testAnotherPageNeverDiscriminatesTheCacheKey() {
		$resolver = new RevisionResolver(
			$this->newPageFactory( [] ),
			null,
			$this->newRevision( 100 ),
			self::SUBJECT
		);

		$this->assertSame( 0, $resolver->pinnedRevisionFor( $this->newTitle( self::OTHER, 300 ) ) );
	}
}
