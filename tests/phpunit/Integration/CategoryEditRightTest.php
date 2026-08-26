<?php

namespace MediaWiki\Extension\MwJson\Tests\Integration;

use CommentStoreComment;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;
use MediaWikiIntegrationTestCase;

/**
 * $wgMwJsonCategoryEditRights, enforced against real saves.
 *
 * The interesting case is creation. A title-based permission check cannot see
 * it: the page does not exist, so it has no stored type, and asking the title
 * what class it belongs to gets no answer. Only MultiContentSave sees the
 * content being saved, which is why the gate lives there and why these tests
 * go through PageUpdater rather than through PermissionManager.
 *
 * @covers \MediaWiki\Extension\MwJson\Mw\CategoryEditRightHooks
 * @covers \MediaWiki\Extension\MwJson\Mw\GuardedCategories
 * @group MwJson
 * @group Database
 */
class CategoryEditRightTest extends MediaWikiIntegrationTestCase {

	private const GUARDED = 'Category:MwJsonGuardedFixture';
	private const SUBCLASS = 'Category:MwJsonGuardedSubclassFixture';
	private const RIGHT = 'mwjson-test-guard';

	protected function setUp(): void {
		parent::setUp();
		// This wiki's LocalSettings calls wfGetDB from a hook closure, and the
		// test framework promotes the deprecation to an error. It comes from
		// the installation rather than from anything under test here.
		$this->filterDeprecated( '/wfGetDB/' );

		$this->overrideConfigValue( 'MwJsonCategoryEditRights', [ self::GUARDED => self::RIGHT ] );

		// Mirrors the real configuration, where mwjson-editpatch is granted to
		// sysop. It also makes the fixtures below writable: they are guarded
		// pages themselves, so setting them up needs the right too.
		$this->setGroupPermissions( 'sysop', self::RIGHT, true );

		// A subclass of the guarded category, so the tests can show that
		// instantiating it is covered too. The chain is read from jsonschema
		// allOf refs, the same place SchemaWalker reads it.
		$this->assertStatusGood( $this->writeSlots( self::GUARDED, [ Slots::JSONSCHEMA => '{"title":"Guarded"}' ] ) );
		$this->assertStatusGood( $this->writeSlots( self::SUBCLASS, [
			Slots::JSONSCHEMA => json_encode( [
				'allOf' => [ [ '$ref' => '/wiki/' . self::GUARDED . '?action=raw&slot=jsonschema' ] ],
			] ),
		] ) );
	}

	/**
	 * Save slots the way WSSlots does, straight through PageUpdater, so the
	 * hook under test fires exactly as it does in production.
	 *
	 * @param array<string,string> $slots
	 * @param \MediaWiki\User\User|null $user
	 * @return \StatusValue
	 */
	private function writeSlots( string $title, array $slots, $user = null ) {
		$services = MediaWikiServices::getInstance();
		$page = $services->getWikiPageFactory()->newFromTitle( Title::newFromText( $title ) );
		$updater = $page->newPageUpdater( $user ?? $this->getTestSysop()->getUser() );

		if ( !$page->exists() && !isset( $slots[Slots::MAIN] ) ) {
			$updater->setContent( Slots::MAIN, \ContentHandler::makeContent( '', $page->getTitle() ) );
		}
		foreach ( $slots as $role => $text ) {
			// Each role declares its own model and rejects the others: jsondata
			// and jsonschema take json, the template slots take wikitext. Using
			// the role's default is what WSSlots does for a slot the page does
			// not have yet.
			$model = $services->getSlotRoleRegistry()
				->getRoleHandler( $role )
				->getDefaultModel( $page->getTitle() );
			$updater->setContent(
				$role,
				\ContentHandler::makeContent( $text, $page->getTitle(), $model )
			);
		}

		$updater->saveRevision( CommentStoreComment::newUnsavedComment( 'test' ) );
		return $updater->getStatus();
	}

	private function jsondata( array $data ): array {
		return [ Slots::JSONDATA => json_encode( $data ) ];
	}

	private function userWithoutTheRight() {
		return $this->getTestUser()->getUser();
	}

	private function userWithTheRight() {
		return $this->getTestSysop()->getUser();
	}

	public function testCreatingAGuardedInstanceIsRefused(): void {
		$status = $this->writeSlots(
			'Item:MwJsonGuardedInstance',
			$this->jsondata( [ 'type' => [ self::GUARDED ] ] ),
			$this->userWithoutTheRight()
		);

		$this->assertStatusNotGood( $status );
		$this->assertStatusMessage( 'mwjson-category-edit-right-denied', $status );
		$this->assertFalse( Title::newFromText( 'Item:MwJsonGuardedInstance' )->exists() );
	}

	public function testCreatingAnInstanceOfASubclassIsRefused(): void {
		// The bypass: declare a subclass and instantiate that instead.
		$status = $this->writeSlots(
			'Item:MwJsonSubclassInstance',
			$this->jsondata( [ 'type' => [ self::SUBCLASS ] ] ),
			$this->userWithoutTheRight()
		);

		$this->assertStatusNotGood( $status );
	}

	public function testCreatingASubclassOfAGuardedCategoryIsRefused(): void {
		// The other bypass: a category's own type is Category:Category, so it
		// never reaches the guarded category on the instance path.
		$status = $this->writeSlots(
			'Category:MwJsonNewSubclass',
			$this->jsondata( [
				'type' => [ 'Category:Category' ],
				'subclass_of' => [ self::GUARDED ],
			] ),
			$this->userWithoutTheRight()
		);

		$this->assertStatusNotGood( $status );
	}

	public function testCreatingAnUnrelatedPageIsAllowed(): void {
		$status = $this->writeSlots(
			'Item:MwJsonUnguarded',
			$this->jsondata( [ 'type' => [ 'Category:MwJsonSomethingElse' ] ] ),
			$this->userWithoutTheRight()
		);

		$this->assertStatusGood( $status );
	}

	public function testEditingAnExistingGuardedPageIsRefused(): void {
		$title = 'Item:MwJsonExistingGuarded';
		$this->assertStatusGood( $this->writeSlots( $title, $this->jsondata( [ 'type' => [ self::GUARDED ] ] ) ) );

		$status = $this->writeSlots(
			$title,
			$this->jsondata( [ 'type' => [ self::GUARDED ], 'name' => 'changed' ] ),
			$this->userWithoutTheRight()
		);

		$this->assertStatusNotGood( $status );
	}

	public function testRemovingTheGuardedTypeIsRefused(): void {
		// Otherwise the guard is removable by whoever it is meant to stop:
		// de-class the page, then edit it freely.
		$title = 'Item:MwJsonDeclassed';
		$this->assertStatusGood( $this->writeSlots( $title, $this->jsondata( [ 'type' => [ self::GUARDED ] ] ) ) );

		$status = $this->writeSlots(
			$title,
			$this->jsondata( [ 'type' => [ 'Category:MwJsonSomethingElse' ] ] ),
			$this->userWithoutTheRight()
		);

		$this->assertStatusNotGood( $status );
	}

	public function testEditingAnotherSlotOfAGuardedPageIsRefused(): void {
		// The edit does not touch jsondata at all. The incoming revision
		// inherits it, which is why the check reads the slot with RAW audience
		// off the planned revision rather than only the modified slots.
		$title = 'Item:MwJsonOtherSlot';
		$this->assertStatusGood( $this->writeSlots( $title, $this->jsondata( [ 'type' => [ self::GUARDED ] ] ) ) );

		$status = $this->writeSlots(
			$title,
			[ Slots::MAIN => 'anything' ],
			$this->userWithoutTheRight()
		);

		$this->assertStatusNotGood( $status );
	}

	public function testAUserWithTheRightMayDoAllOfIt(): void {
		$user = $this->userWithTheRight();

		$this->assertStatusGood( $this->writeSlots(
			'Item:MwJsonPermittedCreate',
			$this->jsondata( [ 'type' => [ self::GUARDED ] ] ),
			$user
		) );
		$this->assertStatusGood( $this->writeSlots(
			'Item:MwJsonPermittedCreate',
			$this->jsondata( [ 'type' => [ self::GUARDED ], 'name' => 'changed' ] ),
			$user
		) );
		$this->assertStatusGood( $this->writeSlots(
			'Item:MwJsonPermittedSubclassInstance',
			$this->jsondata( [ 'type' => [ self::SUBCLASS ] ] ),
			$user
		) );
	}

	public function testTheGuardedCategoryPageItselfIsRefused(): void {
		// Editing Category:Device is editing the definition every Device
		// inherits, so it takes the same right. Its own jsondata cannot say so:
		// a category's type is Category:Category and its subclass_of points at
		// its parent, so neither reaches the rule naming it.
		$status = $this->writeSlots(
			self::GUARDED,
			[ Slots::JSONSCHEMA => '{"title":"Rewritten"}' ],
			$this->userWithoutTheRight()
		);
		$this->assertStatusNotGood( $status );

		$permissionManager = MediaWikiServices::getInstance()->getPermissionManager();
		$this->assertFalse( $permissionManager->userCan(
			'edit', $this->userWithoutTheRight(), Title::newFromText( self::GUARDED )
		) );
	}

	public function testASubcategoryOfAGuardedCategoryIsRefused(): void {
		$status = $this->writeSlots(
			self::SUBCLASS,
			[ Slots::JSONSCHEMA => '{"title":"Rewritten subclass"}' ],
			$this->userWithoutTheRight()
		);

		$this->assertStatusNotGood( $status );
	}

	public function testAGuardCannotBeStaleWithinOneRequest(): void {
		// A save can create the very chain the guard is about to walk. Caching
		// the answer from before it existed would let the first instance of a
		// brand new subclass through.
		$fresh = 'Category:MwJsonFreshSubclass';
		$this->assertStatusGood( $this->writeSlots( $fresh, [
			Slots::JSONSCHEMA => json_encode( [
				'allOf' => [ [ '$ref' => '/wiki/' . self::GUARDED . '?action=raw&slot=jsonschema' ] ],
			] ),
		] ) );

		$status = $this->writeSlots(
			'Item:MwJsonFreshSubclassInstance',
			$this->jsondata( [ 'type' => [ $fresh ] ] ),
			$this->userWithoutTheRight()
		);

		$this->assertStatusNotGood( $status );
	}

	public function testAnEmptyMapGuardsNothing(): void {
		$this->overrideConfigValue( 'MwJsonCategoryEditRights', [] );

		$this->assertStatusGood( $this->writeSlots(
			'Item:MwJsonUnconfigured',
			$this->jsondata( [ 'type' => [ self::GUARDED ] ] ),
			$this->userWithoutTheRight()
		) );
	}

	public function testTheEditTabIsRefusedOnAGuardedPage(): void {
		$title = Title::newFromText( 'Item:MwJsonGuardedForPermissionCheck' );
		$this->assertStatusGood( $this->writeSlots(
			$title->getPrefixedText(),
			$this->jsondata( [ 'type' => [ self::GUARDED ] ] )
		) );

		$permissionManager = MediaWikiServices::getInstance()->getPermissionManager();
		foreach ( [ 'edit', 'delete', 'move' ] as $action ) {
			$this->assertFalse(
				$permissionManager->userCan( $action, $this->userWithoutTheRight(), $title ),
				"$action should be refused on a guarded page"
			);
		}

		// read is deliberately untouched: the guard is about who may change a
		// class, not about who may see it.
		$this->assertTrue(
			$permissionManager->userCan( 'read', $this->userWithoutTheRight(), $title )
		);
	}
}
