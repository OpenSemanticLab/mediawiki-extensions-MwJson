<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\MediaWikiServices;
use MediaWiki\User\UserIdentity;

/**
 * "May this user create something in this class?", for callers outside the
 * extension.
 *
 * The question a skin needs to answer before offering a create button cannot
 * be asked of a title: the page does not exist yet, so it has no class, and
 * asking permission on a placeholder title says only whether the namespace is
 * writable at all.
 *
 * The class is what decides whether the save will be allowed, so the class is
 * what gets asked about.
 */
class CategoryEditRight {

	/**
	 * @param UserIdentity $user
	 * @param string $category Prefixed title of the category to instantiate or
	 *   subclass. Both reach the same ancestors, so both have the same answer.
	 */
	public static function userCanUse( UserIdentity $user, string $category ): bool {
		return self::missingRights( $user, $category ) === [];
	}

	/**
	 * The rights the user is short of, for a message that says what is needed.
	 *
	 * @return string[]
	 */
	public static function missingRights( UserIdentity $user, string $category ): array {
		$services = MediaWikiServices::getInstance();
		$guard = new GuardedCategories(
			(array)$services->getMainConfig()->get( 'MwJsonCategoryEditRights' ),
			( new PipelineFactory() )->newStoredSlotJsonLoader()
		);

		if ( $guard->isEmpty() ) {
			return [];
		}

		$permissionManager = $services->getPermissionManager();
		$missing = [];
		foreach ( $guard->rightsForCategory( $category ) as $right ) {
			if ( !$permissionManager->userHasRight( $user, $right ) ) {
				$missing[] = $right;
			}
		}

		return $missing;
	}
}
