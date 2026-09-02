<?php

namespace MediaWiki\Extension\MwJson\Tests\Integration;

use CommentStoreComment;
use MediaWiki\Extension\MwJson\Mw\PipelineFactory;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\MediaWikiServices;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Title\Title;
use MediaWikiIntegrationTestCase;

/**
 * Slot reads follow whatever answers SemanticMediaWiki's RevisionGuard.
 *
 * Driven through the hook rather than through ApprovedRevs, so the behaviour is
 * pinned without the tests depending on which approval extension a wiki has
 * installed. That is also the real contract: MwJson does not ask ApprovedRevs
 * anything, it asks the same guard SMW asks when deciding what to store, so the
 * two cannot end up holding different revisions of the same page.
 *
 * @covers \MediaWiki\Extension\MwJson\Mw\RevisionResolver
 * @covers \MediaWiki\Extension\MwJson\Mw\WsSlotSource
 * @group MwJson
 * @group Database
 */
class ApprovedRevisionTest extends MediaWikiIntegrationTestCase {

	private const PAGE = 'Item:MwJsonRevisionFixture';

	private int $firstRevision;

	protected function setUp(): void {
		parent::setUp();
		// This wiki's LocalSettings calls wfGetDB from a hook closure, and the
		// test framework promotes the deprecation to an error. It comes from
		// the installation rather than from anything under test here.
		$this->filterDeprecated( '/wfGetDB/' );

		$this->overrideConfigValue( 'MwJsonEnablePatches', false );

		// SMW's HookDispatcher memoises the hook container the first time it
		// dispatches, and the test framework hands every test a fresh one. A
		// guard built before that point would keep dispatching into the old
		// container and never see the handler registered below.
		\SMW\Services\ServicesFactory::clear();

		$this->firstRevision = $this->write( '{"label":"first"}' );
		$this->write( '{"label":"second"}' );
	}

	/**
	 * @return int The revision id written.
	 */
	private function write( string $jsondata ): int {
		$services = MediaWikiServices::getInstance();
		$title = Title::newFromText( self::PAGE );
		$page = $services->getWikiPageFactory()->newFromTitle( $title );
		$updater = $page->newPageUpdater( $this->getTestSysop()->getUser() );

		if ( !$page->exists() ) {
			$updater->setContent( Slots::MAIN, \ContentHandler::makeContent( '', $title ) );
		}

		$model = $services->getSlotRoleRegistry()
			->getRoleHandler( Slots::JSONDATA )
			->getDefaultModel( $title );
		$updater->setContent(
			Slots::JSONDATA,
			\ContentHandler::makeContent( $jsondata, $title, $model )
		);
		$updater->saveRevision( CommentStoreComment::newUnsavedComment( 'test' ) );
		$this->assertStatusGood( $updater->getStatus() );

		return $updater->getNewRevision()->getId();
	}

	/**
	 * Answer every request for the fixture with its first revision, which is
	 * what an approval of an older revision amounts to.
	 */
	private function pinTheGuardToTheFirstRevision(): void {
		$first = MediaWikiServices::getInstance()->getRevisionLookup()
			->getRevisionById( $this->firstRevision );

		$this->setTemporaryHook(
			'SMW::RevisionGuard::ChangeRevision',
			static function ( Title $title, ?RevisionRecord &$revision ) use ( $first ) {
				if ( $title->getPrefixedText() === self::PAGE ) {
					$revision = $first;
				}
			}
		);
	}

	public function testARenderReadFollowsTheGuard() {
		$this->pinTheGuardToTheFirstRevision();

		// With patches off this is the plain resolving loader, which is what a
		// render reads the category chain and every $ref target through.
		$loader = ( new PipelineFactory() )->newPatchedJsonLoader( [] );

		$this->assertSame( [ 'label' => 'first' ], $loader->load( self::PAGE, Slots::JSONDATA ) );
	}

	public function testTheGateStillSeesWhatIsStored() {
		$this->pinTheGuardToTheFirstRevision();

		// The permission gate must not follow the guard. A category whose
		// current revision adds a guarded ancestor would otherwise be
		// instantiable by exactly the users the right exists to stop, for as
		// long as an older revision remained the approved one.
		$loader = ( new PipelineFactory() )->newStoredSlotJsonLoader();

		$this->assertSame( [ 'label' => 'second' ], $loader->load( self::PAGE, Slots::JSONDATA ) );
	}

	public function testWithoutAGuardBothLoadersReadTheCurrentRevision() {
		$factory = new PipelineFactory();

		$this->assertSame(
			[ 'label' => 'second' ],
			$factory->newPatchedJsonLoader( [] )->load( self::PAGE, Slots::JSONDATA )
		);
		$this->assertSame(
			[ 'label' => 'second' ],
			$factory->newStoredSlotJsonLoader()->load( self::PAGE, Slots::JSONDATA )
		);
	}
}
