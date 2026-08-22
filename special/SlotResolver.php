<?php
/**
 * Special page serving one slot of one page as raw content.
 *
 * Addresses a slot the way a package file is addressed, so that
 * `Special:SlotResolver/Category/AnnotationProperty.slot_jsonschema.json`
 * returns exactly what a build tool would fetch from a package repository.
 *
 * @file
 * @ingroup Extensions
 */

use MediaWiki\Content\TextContent;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;
use WSSlots\WSSlots;

class SpecialSlotResolver extends SpecialPage {

	/**
	 * Content types this page will emit, by file extension.
	 *
	 * A closed list on purpose. The extension comes from the URL, so deriving a
	 * type from it would let a caller pick one, and `text/html` in particular
	 * turns any slot holding markup into stored XSS on the wiki's own origin.
	 * Anything not listed is served as plain text.
	 */
	private const CONTENT_TYPES = [
		'json' => 'application/json; charset=UTF-8',
		'txt' => 'text/plain; charset=UTF-8',
		'wikitext' => 'text/plain; charset=UTF-8',
	];

	private const DEFAULT_CONTENT_TYPE = 'text/plain; charset=UTF-8';

	public function __construct() {
		parent::__construct( 'SlotResolver', '' );
	}

	/**
	 * @param string|null $par `<ns>/<page>.slot_<slot>.<extension>`
	 */
	public function execute( $par ) {
		$this->setHeaders();

		$target = $this->parseTarget( (string)$par );
		if ( $target === null ) {
			$this->showError( 'No slot addressed. Expected <namespace>/<page>.slot_<slot>.<extension>' );
			return;
		}
		[ $title, $slot, $extension ] = $target;

		// A slot is page content, so it is readable exactly when its page is.
		// WSSlots::getSlotContent() performs no check of its own, and both
		// SemanticACL and Lockdown express their restrictions through the
		// permission hooks this consults, so without it a page the reader is
		// refused through every other route is served here in full.
		//
		// Deliberately the same answer as a normal page view: a reader who
		// cannot read the page cannot read its slots either, and is told the
		// same thing rather than being told the page exists.
		if ( !$this->getAuthority()->definitelyCan( 'read', $title ) ) {
			throw new PermissionsError( 'read' );
		}

		$content = $this->readSlot( $title, $slot );
		if ( $content === null ) {
			// Undistinguished from the permission case above only in wording:
			// by this point the reader is known to be allowed to see the page,
			// so saying the slot is empty reveals nothing.
			$this->showError( 'No content in slot "' . $slot . '".' );
			return;
		}

		$this->emit( $content, $extension );
	}

	/**
	 * Split `<ns>/<page>.slot_<slot>.<extension>` into its parts.
	 *
	 * @return array{0:Title,1:string,2:string}|null Null when the path does not
	 *   address a slot, or names a page that cannot exist.
	 */
	private function parseTarget( string $par ): ?array {
		$parts = explode( '/', $par );
		$file = array_pop( $parts );
		$namespace = array_pop( $parts );
		if ( $namespace === null || $file === null || $file === '' ) {
			return null;
		}

		$fileParts = explode( '.', $file );
		if ( count( $fileParts ) < 3 ) {
			// Needs at least <page>.slot_<slot>.<extension>.
			return null;
		}

		$extension = (string)array_pop( $fileParts );
		$slot = str_replace( 'slot_', '', (string)array_pop( $fileParts ) );
		if ( $slot === '' ) {
			return null;
		}

		// Titles are validated rather than assumed: the whole path is caller
		// supplied, and Title::newFromText returns null for anything malformed.
		$title = Title::newFromText( $namespace . ':' . implode( '.', $fileParts ) );
		if ( $title === null || !$title->canExist() ) {
			return null;
		}

		return [ $title, $slot, $extension ];
	}

	/**
	 * The slot's text, or null when there is none to serve.
	 *
	 * Only textual content has text. A slot holding anything else has no raw
	 * form this page can return, so it is reported as absent rather than
	 * stringified into something misleading.
	 */
	private function readSlot( Title $title, string $slot ): ?string {
		$page = MediaWikiServices::getInstance()->getWikiPageFactory()->newFromTitle( $title );
		$content = WSSlots::getSlotContent( $page, $slot );

		return $content instanceof TextContent ? $content->getText() : null;
	}

	private function emit( string $content, string $extension ): void {
		$response = $this->getRequest()->response();
		$response->header( 'Content-Type: ' . ( self::CONTENT_TYPES[$extension] ?? self::DEFAULT_CONTENT_TYPE ) );
		// Belt and braces alongside the closed type list above: even if a type
		// were ever added that a browser might render, it will not be sniffed
		// into something else, and it is never treated as a page in its own right.
		$response->header( 'X-Content-Type-Options: nosniff' );
		$response->header( 'Content-Disposition: inline' );

		$this->getOutput()->disable();
		echo $content;
	}

	private function showError( string $message ): void {
		$out = $this->getOutput();
		$out->setPageTitle( $this->msg( 'slotresolver' )->isDisabled()
			? 'Slot Resolver'
			: $this->msg( 'slotresolver' )->text() );
		$out->addWikiTextAsInterface( $message );
	}

	/** @inheritDoc */
	protected function getGroupName() {
		return 'pages';
	}
}
