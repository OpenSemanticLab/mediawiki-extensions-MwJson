<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Config\Config;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\Output\Hook\MakeGlobalVariablesScriptHook;
use MediaWiki\Permissions\Hook\GetUserPermissionsErrorsHook;
use MediaWiki\Permissions\PermissionManager;
use MediaWiki\Revision\RevisionLookup;
use MediaWiki\Revision\RevisionRecord;
use MediaWiki\Storage\Hook\MultiContentSaveHook;
use MediaWiki\Title\Title;
use TextContent;

/**
 * Enforces $wgMwJsonCategoryEditRights.
 *
 * Two hooks, because neither is sufficient alone.
 *
 * MultiContentSave is the gate that decides. It fires from
 * PageUpdater::saveRevision(), which every write path funnels through: the edit
 * form, action=edit, rollback, undo, import, maintenance scripts, and WSSlots'
 * action=editslots, which is what the JSON editor actually posts to. It is also
 * the only point that sees the content being saved, which is required, because
 * a page being created has no stored type to check yet. A title-based check
 * alone would stop edits to existing guarded pages and do nothing whatsoever
 * about a user creating one.
 *
 * getUserPermissionsErrors is the early gate, for the actions where the current
 * state is the whole story and no content is submitted. It is what makes the
 * edit tab and the editor's save button unavailable rather than failing at save
 * time. `undelete` needs no entry, being sysop-only in core's defaults already.
 *
 * MakeGlobalVariablesScript answers "may I create an instance of this
 * category?" for a create button sitting on a category page. Deliberately not
 * ResourceLoaderGetConfigVars, where the extension's other wgMwJson* variables
 * live: that hook's output is baked into the shared startup module, so a
 * per-user answer would leak from one reader to the next. Core's own
 * documentation on the hook says as much.
 */
class CategoryEditRightHooks implements
	MultiContentSaveHook,
	GetUserPermissionsErrorsHook,
	MakeGlobalVariablesScriptHook
{

	/**
	 * The actions a guarded page's stored class can decide on its own.
	 *
	 * Checked before anything else, because this hook also runs for `read` on
	 * every title, and SmwLinkLabelResolver calls userCan( 'read' ) once per
	 * link. Reading a slot there would put a page load's worth of work into a
	 * loop that was optimised to remove exactly that.
	 */
	private const GUARDED_ACTIONS = [ 'edit', 'delete', 'move' ];

	private Config $config;
	private RevisionLookup $revisionLookup;
	private PermissionManager $permissionManager;

	private ?GuardedCategories $guard = null;

	public function __construct(
		Config $config,
		RevisionLookup $revisionLookup,
		PermissionManager $permissionManager
	) {
		$this->config = $config;
		$this->revisionLookup = $revisionLookup;
		$this->permissionManager = $permissionManager;
	}

	/**
	 * @param \MediaWiki\Revision\RenderedRevision $renderedRevision
	 * @param \MediaWiki\User\UserIdentity $user
	 * @param \CommentStoreComment $summary
	 * @param int $flags
	 * @param \StatusValue $status
	 * @return bool
	 */
	public function onMultiContentSave( $renderedRevision, $user, $summary, $flags, $status ) {
		$guard = $this->guard();
		if ( $guard->isEmpty() ) {
			return true;
		}

		$revision = $renderedRevision->getRevision();

		// Both sides, because both directions matter: turning a page into a
		// guarded class, and editing or de-classing one that already is. The
		// incoming revision carries inherited slots too, so an edit that
		// touches only header_template still sees the jsondata that classes it.
		$rights = array_unique( array_merge(
			$guard->rightsForData( $this->jsondataOf( $revision ) ),
			$guard->rightsForData( $this->currentJsondataOf( $revision ) )
		) );

		$missing = $this->missingRights( $rights, $user );
		if ( $missing === [] ) {
			return true;
		}

		$status->fatal(
			'mwjson-category-edit-right-denied',
			Title::newFromPageIdentity( $revision->getPage() )->getPrefixedText(),
			implode( ', ', $missing ),
			count( $missing )
		);
		return false;
	}

	/**
	 * @param Title $title
	 * @param \MediaWiki\User\User $user
	 * @param string $action
	 * @param array|string|\MessageSpecifier &$result
	 * @return bool
	 */
	public function onGetUserPermissionsErrors( $title, $user, $action, &$result ) {
		if ( !in_array( $action, self::GUARDED_ACTIONS, true ) ) {
			return true;
		}

		$guard = $this->guard();
		if ( $guard->isEmpty() ) {
			return true;
		}

		$rights = $guard->rightsForData( $this->storedJsondataOf( $title ) );
		$missing = $this->missingRights( $rights, $user );
		if ( $missing === [] ) {
			return true;
		}

		$result = [
			'mwjson-category-edit-right-denied',
			$title->getPrefixedText(),
			implode( ', ', $missing ),
			count( $missing ),
		];
		return false;
	}

	/**
	 * @param array &$vars
	 * @param \MediaWiki\Output\OutputPage $out
	 */
	public function onMakeGlobalVariablesScript( &$vars, $out ): void {
		$title = $out->getTitle();
		if ( $title === null || $title->getNamespace() !== NS_CATEGORY ) {
			return;
		}

		$guard = $this->guard();
		if ( $guard->isEmpty() ) {
			$vars['wgMwJsonCanCreateInstance'] = true;
			return;
		}

		$missing = $this->missingRights(
			$guard->rightsForCategory( $title->getPrefixedText() ),
			$out->getUser()
		);
		$vars['wgMwJsonCanCreateInstance'] = $missing === [];
	}

	/**
	 * The right names the user does not hold, in configuration order.
	 *
	 * @param string[] $rights
	 * @param \MediaWiki\User\UserIdentity $user
	 * @return string[]
	 */
	private function missingRights( array $rights, $user ): array {
		$missing = [];
		foreach ( $rights as $right ) {
			if ( !$this->permissionManager->userHasRight( $user, $right ) ) {
				$missing[] = $right;
			}
		}
		return $missing;
	}

	/**
	 * The jsondata a revision would store, inherited slots included.
	 *
	 * RAW audience on purpose: this is an authorisation decision about content
	 * the author just submitted, not a display of it, so a suppressed revision
	 * must still be classified rather than silently treated as unguarded.
	 */
	private function jsondataOf( RevisionRecord $revision ): array {
		if ( !$revision->hasSlot( Slots::JSONDATA ) ) {
			return [];
		}

		$content = $revision->getSlot( Slots::JSONDATA, RevisionRecord::RAW )->getContent();
		if ( !$content instanceof TextContent ) {
			return [];
		}

		$decoded = json_decode( $content->getText(), true );
		return is_array( $decoded ) ? $decoded : [];
	}

	/**
	 * What the page says today, before this edit.
	 *
	 * Read from the revision store rather than from the slot loader, because
	 * the loader memoises and the same request has usually just read the page.
	 */
	private function currentJsondataOf( RevisionRecord $revision ): array {
		$page = $revision->getPage();
		if ( !$page->exists() ) {
			return [];
		}

		$current = $this->revisionLookup->getRevisionByPageId( $page->getId() );
		return $current === null ? [] : $this->jsondataOf( $current );
	}

	/**
	 * @return array
	 */
	private function storedJsondataOf( Title $title ): array {
		if ( !$title->exists() ) {
			return [];
		}

		return ( new PipelineFactory() )->newSlotJsonLoader()
			->load( $title->getPrefixedText(), Slots::JSONDATA );
	}

	private function guard(): GuardedCategories {
		if ( $this->guard === null ) {
			$this->guard = new GuardedCategories(
				(array)$this->config->get( 'MwJsonCategoryEditRights' ),
				( new PipelineFactory() )->newSlotJsonLoader()
			);
		}
		return $this->guard;
	}
}
