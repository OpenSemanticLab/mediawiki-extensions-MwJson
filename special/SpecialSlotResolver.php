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
use MediaWiki\Extension\MwJson\Mw\PipelineFactory;
use MediaWiki\Extension\MwJson\OOLD\Slots;
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
			$this->showError(
				'No slot addressed. Expected <namespace>/<page>.slot_<slot>.<extension>',
				400,
				$this->extensionOf( (string)$par )
			);
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

		$content = $this->readSlot( $title, $slot, $this->requestedPatchsets() );
		if ( $content === null ) {
			// Undistinguished from the permission case above only in wording:
			// by this point the reader is known to be allowed to see the page,
			// so saying the slot is empty reveals nothing.
			//
			// A missing page and an empty slot are the same answer to a caller
			// fetching a package file: there is nothing at this address.
			$this->showError( 'No content in slot "' . $slot . '".', 404, $extension );
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

	/**
	 * @param string[] $patchsets Empty for the stored content.
	 */
	private function readSlot( Title $title, string $slot, array $patchsets ): ?string {
		if ( $patchsets !== [] && in_array( $slot, [ Slots::JSONDATA, Slots::JSONSCHEMA ], true ) ) {
			$patched = ( new PipelineFactory() )->newPatchedJsonLoader( $patchsets )
				->load( $title->getPrefixedText(), $slot );

			return $patched === []
				? null
				: json_encode( $patched, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		}

		$page = MediaWikiServices::getInstance()->getWikiPageFactory()->newFromTitle( $title );
		$content = WSSlots::getSlotContent( $page, $slot );

		return $content instanceof TextContent ? $content->getText() : null;
	}

	/**
	 * Patch sets the caller is asking for.
	 *
	 * Absent means the stored content, which is what keeps package export and
	 * every other raw consumer reading what is actually on the page. The form
	 * editor asks for "ui" so that a patch can change the form without changing
	 * the render, or the other way round.
	 *
	 * @return string[]
	 */
	private function requestedPatchsets(): array {
		$requested = $this->getRequest()->getText( 'patchset' );
		if ( $requested === '' ) {
			return [];
		}

		$patchsets = [];
		foreach ( explode( '|', $requested ) as $name ) {
			$name = trim( $name );
			if ( $name !== '' ) {
				$patchsets[] = $name;
			}
		}

		return $patchsets;
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

	/**
	 * The extension a caller asked for, for paths too malformed to parse.
	 *
	 * Only a listed type counts, so the failure is reported in a shape the
	 * caller can read without the path being able to choose the content type.
	 */
	private function extensionOf( string $par ): string {
		$extension = strtolower( (string)substr( strrchr( $par, '.' ) ?: '', 1 ) );

		return isset( self::CONTENT_TYPES[$extension] ) ? $extension : 'txt';
	}

	/**
	 * Report a failure in the shape the caller asked for.
	 *
	 * This address is fetched by build tools rather than read in a browser, so
	 * a rendered wiki page carrying HTTP 200 is the one answer that cannot be
	 * acted on: the status says success and the body does not parse. The status
	 * carries the outcome and the body matches the requested type.
	 */
	private function showError( string $message, int $status, string $extension ): void {
		$response = $this->getRequest()->response();
		$response->statusHeader( $status );
		$response->header( 'Content-Type: ' . ( self::CONTENT_TYPES[$extension] ?? self::DEFAULT_CONTENT_TYPE ) );
		$response->header( 'X-Content-Type-Options: nosniff' );

		$this->getOutput()->disable();
		echo $extension === 'json'
			? json_encode( [ 'error' => $message ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
			: $message;
	}

	/** @inheritDoc */
	protected function getGroupName() {
		return 'pages';
	}
}
