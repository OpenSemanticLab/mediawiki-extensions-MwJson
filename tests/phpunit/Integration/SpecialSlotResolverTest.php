<?php

namespace MediaWiki\Extension\MwJson\Tests\Integration;

use PermissionsError;
use SpecialPageTestBase;
use SpecialSlotResolver;

/**
 * Special:SlotResolver serves page content, so it has to refuse a reader the
 * page itself would refuse.
 *
 * It did not. `WSSlots::getSlotContent()` performs no permission check and the
 * special page performed none either, so a page restricted by SemanticACL or
 * Lockdown was readable in full through this one route while every other route
 * denied it.
 *
 * ## Why this cannot test SemanticACL directly
 *
 * SemanticACL returns early for command-line requests:
 *
 *     if ( defined( 'MW_ENTRY_POINT' ) && MW_ENTRY_POINT == 'cli' ) return true;
 *
 * so under PHPUnit it permits everything and a test written against it would
 * pass whether or not the check exists. These tests therefore use MediaWiki's
 * own read permission, which is the same gate: SemanticACL, Lockdown and core
 * all decide it through the permission hooks that `Authority::definitelyCan()`
 * consults. What is pinned here is that the page asks at all.
 *
 * The SemanticACL path itself was verified over HTTP against a restricted page
 * with two real accounts, which is the only way to exercise it.
 *
 * @covers \SpecialSlotResolver
 * @group MwJson
 * @group Database
 */
class SpecialSlotResolverTest extends SpecialPageTestBase {

	private const CONTENT = 'CANARY-SLOT-CONTENT';

	protected function setUp(): void {
		parent::setUp();
		// This wiki's LocalSettings calls wfGetDB from a hook closure, and the
		// test framework promotes the deprecation to an error. It comes from
		// the installation rather than from anything under test here.
		$this->filterDeprecated( '/wfGetDB/' );
	}

	protected function newSpecialPage(): SpecialSlotResolver {
		return new SpecialSlotResolver();
	}

	/**
	 * @return string The prefixed title of a page holding CONTENT in its main slot.
	 */
	private function newPage(): string {
		// Namespaced on purpose: the address this page parses is
		// <namespace>/<page>, so a main-namespace fixture has no prefix to
		// build one from.
		$page = $this->getExistingTestPage( 'Category:MwJsonSlotResolverFixture' );
		$this->editPage( $page, self::CONTENT );
		return $page->getTitle()->getPrefixedText();
	}

	private function target( string $prefixedText, string $extension = 'txt' ): string {
		[ $namespace, $name ] = explode( ':', $prefixedText, 2 );
		return $namespace . '/' . $name . '.slot_main.' . $extension;
	}

	public function testServesTheSlotToAPermittedReader(): void {
		$page = $this->newPage();

		[ $html, ] = $this->executeSpecialPage( $this->target( $page ), null, null, $this->getTestUser()->getUser() );

		// The page disables OutputPage and echoes, so the content arrives as
		// captured output rather than as the returned HTML.
		$this->assertStringContainsString( self::CONTENT, $html . $this->getActualOutputForAssertion() );
	}

	/**
	 * The point of the fix. A reader who may not read the page may not read its
	 * slots, and is refused rather than served.
	 */
	public function testRefusesAReaderWhoMayNotReadThePage(): void {
		$page = $this->newPage();

		// A user in a group with no read right, created for this test rather
		// than assumed to exist on the wiki.
		$this->setGroupPermissions( [ 'mwjson-no-read' => [ 'read' => false ] ] );
		$this->setGroupPermissions( [ '*' => [ 'read' => false ], 'user' => [ 'read' => false ] ] );
		$lesser = $this->getTestUser( [ 'mwjson-no-read' ] )->getUser();

		$this->expectException( PermissionsError::class );
		$this->executeSpecialPage( $this->target( $page ), null, null, $lesser );
	}

	/**
	 * The extension in the URL is caller-controlled, so it must not be able to
	 * select a type a browser will render. Anything unrecognised is plain text.
	 *
	 * @dataProvider provideExtensions
	 */
	public function testContentTypeIsNeverHtml( string $extension, string $expected ): void {
		$page = $this->newPage();

		[ , $response ] = $this->executeSpecialPage(
			$this->target( $page, $extension ), null, null, $this->getTestUser()->getUser()
		);

		$this->assertSame( $expected, $response->getHeader( 'Content-Type' ) );
		$this->assertSame( 'nosniff', $response->getHeader( 'X-Content-Type-Options' ) );
	}

	public static function provideExtensions(): array {
		return [
			'json' => [ 'json', 'application/json; charset=UTF-8' ],
			'wikitext' => [ 'wikitext', 'text/plain; charset=UTF-8' ],
			// An extension nobody registered must not become a rendered type.
			'html attempt' => [ 'html', 'text/plain; charset=UTF-8' ],
			'svg attempt' => [ 'svg', 'text/plain; charset=UTF-8' ],
		];
	}

	/**
	 * Both of these reached a fatal before: a malformed title arrived at
	 * WikiPage's constructor as null, and a missing slot arrived at getText()
	 * on null. The path is entirely caller-supplied, so neither may crash.
	 *
	 * @dataProvider provideMalformedTargets
	 */
	public function testMalformedTargetsDoNotCrash( string $target ): void {
		[ $html, ] = $this->executeSpecialPage( $target, null, null, $this->getTestUser()->getUser() );

		$this->assertStringNotContainsString( self::CONTENT, $html );
		$this->assertNotSame( '', $html, 'Something should be reported rather than nothing.' );
	}

	public static function provideMalformedTargets(): array {
		return [
			'empty' => [ '' ],
			'no slot part' => [ 'nonsense' ],
			'no extension' => [ 'Category/Thing' ],
			'unparseable title' => [ 'Category/Bad<>Title.slot_main.txt' ],
			'missing page' => [ 'Category/NoSuchPageAnywhere.slot_main.txt' ],
			'empty slot name' => [ 'Category/Thing.slot_.txt' ],
		];
	}
}
