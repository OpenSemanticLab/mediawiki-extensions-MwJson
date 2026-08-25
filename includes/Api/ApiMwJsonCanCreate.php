<?php

namespace MediaWiki\Extension\MwJson\Api;

use ApiBase;
use MediaWiki\Extension\MwJson\Mw\GuardedCategories;
use MediaWiki\Extension\MwJson\Mw\PipelineFactory;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\Permissions\PermissionManager;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use Wikimedia\ParamValidator\ParamValidator;

/**
 * May the current user create something classed like this?
 *
 * Creating targets a title that does not exist yet, so no permission check on
 * the target can answer it: the answer depends on the class the new page would
 * declare, which only the client knows at the moment it offers the button.
 * Without this the user fills in a dialog, presses Continue, and the save
 * fails.
 *
 * A create button sitting on the category it instantiates does not need this;
 * wgMwJsonCanCreateInstance is already in the page variables for that case.
 * This is for the dialogs that let the user pick a template by autocomplete, so
 * the class is not known until after the pick.
 *
 * **UX, not enforcement.** A hidden button is not a permission check;
 * CategoryEditRightHooks is what actually refuses the save.
 */
class ApiMwJsonCanCreate extends ApiBase {

	private TitleFactory $titleFactory;
	private PermissionManager $permissionManager;

	/**
	 * @param \ApiMain $main
	 * @param string $name
	 */
	public function __construct(
		$main,
		$name,
		TitleFactory $titleFactory,
		PermissionManager $permissionManager
	) {
		parent::__construct( $main, $name );
		$this->titleFactory = $titleFactory;
		$this->permissionManager = $permissionManager;
	}

	public function execute() {
		$parameters = $this->extractRequestParams();
		$guard = new GuardedCategories(
			(array)$this->getConfig()->get( 'MwJsonCategoryEditRights' ),
			( new PipelineFactory() )->newSlotJsonLoader()
		);

		$results = [];
		foreach ( $parameters['titles'] as $text ) {
			$results[] = $this->answerFor( $text, $guard );
		}

		$this->getResult()->addValue( null, $this->getModuleName(), [ 'titles' => $results ] );
		$this->getResult()->addIndexedTagName( [ $this->getModuleName(), 'titles' ], 'title' );
	}

	/**
	 * @return array
	 */
	private function answerFor( string $text, GuardedCategories $guard ): array {
		$title = $this->titleFactory->newFromText( $text );
		if ( $title === null ) {
			return [ 'title' => $text, 'allowed' => false, 'invalid' => true, 'missing' => [] ];
		}

		// A Category is asked about as a class, which answers both readings at
		// once: instantiating it and subclassing it reach the same ancestors.
		// Anything else is asked about as a source to copy, where the classes
		// come from its own stored data.
		$rights = $title->getNamespace() === NS_CATEGORY
			? $guard->rightsForCategory( $title->getPrefixedText() )
			: $guard->rightsForData( $this->storedJsondataOf( $title ) );

		$missing = [];
		foreach ( $rights as $right ) {
			if ( !$this->permissionManager->userHasRight( $this->getUser(), $right ) ) {
				$missing[] = $right;
			}
		}

		return [
			'title' => $title->getPrefixedText(),
			'allowed' => $missing === [],
			'missing' => $missing,
		];
	}

	private function storedJsondataOf( Title $title ): array {
		if ( !$title->exists() ) {
			return [];
		}

		return ( new PipelineFactory() )->newSlotJsonLoader()
			->load( $title->getPrefixedText(), Slots::JSONDATA );
	}

	/** @inheritDoc */
	public function getAllowedParams(): array {
		return [
			'titles' => [
				ParamValidator::PARAM_TYPE => 'string',
				ParamValidator::PARAM_ISMULTI => true,
				ParamValidator::PARAM_REQUIRED => true,
			],
		];
	}

	/** @inheritDoc */
	public function isWriteMode(): bool {
		return false;
	}

	/** @inheritDoc */
	protected function getExamplesMessages(): array {
		return [
			'action=mwjsoncancreate&titles=Category:OSWbd03ae43c1954ca889860ecf170682ef'
				=> 'apihelp-mwjsoncancreate-example',
		];
	}
}
