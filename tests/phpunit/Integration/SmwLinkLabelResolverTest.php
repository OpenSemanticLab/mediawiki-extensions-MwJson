<?php

namespace MediaWiki\Extension\MwJson\Tests\Integration;

use MediaWiki\Cache\LinkBatchFactory;
use MediaWiki\Extension\MwJson\Mw\SmwLinkLabelResolver;
use MediaWiki\Permissions\PermissionManager;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use MediaWiki\User\User;
use MediaWikiIntegrationTestCase;
use ParserOutput;
use SMW\DIProperty;
use SMW\DIWikiPage;
use SMW\SemanticData;
use SMW\Store;
use SMWDIBlob;

/**
 * The access and caching rules for resolved link labels.
 *
 * These exist because the parity harness cannot reach them. It renders every
 * page as a single user who may read everything, so the branch that withholds
 * a label, and the branch that stops the result being cached, never execute
 * there. A regression in either would show as a clean parity run and a leak in
 * production.
 *
 * The failure mode being pinned is specific: a label the reader is not allowed
 * to see must not appear, and output that varies by reader must not be stored
 * in the parser cache for the next reader to receive.
 *
 * @covers \MediaWiki\Extension\MwJson\Mw\SmwLinkLabelResolver
 * @group MwJson
 */
class SmwLinkLabelResolverTest extends MediaWikiIntegrationTestCase {

	private const TARGET = 'Item:OSWtarget';

	public function testResolvesTheLabelForAPermittedReader(): void {
		$output = new ParserOutput();
		$resolver = $this->newResolver( true, [], $output );

		$this->assertSame( 'Widget', $resolver->label( self::TARGET ) );
		$this->assertNotSame(
			0,
			$output->getCacheExpiry(),
			'A label everyone may see leaves the parser cache alone.'
		);
	}

	/**
	 * The whole point of the permission check. A denied reader gets no label,
	 * which renders as the plain link showing the raw title, exactly as
	 * Module:Viewer/Link does when its query is filtered to nothing.
	 */
	public function testWithholdsTheLabelFromADeniedReader(): void {
		$output = new ParserOutput();
		$resolver = $this->newResolver( false, [], $output );

		$this->assertNull( $resolver->label( self::TARGET ) );
	}

	/**
	 * Two readers, one label. If the denied reader's render were cached and
	 * served onward, or the permitted reader's were, one of them would see the
	 * wrong thing. Disabling the cache is what keeps that from happening.
	 */
	public function testADeniedReaderDisablesTheParserCache(): void {
		$output = new ParserOutput();
		$this->newResolver( false, [], $output )->label( self::TARGET );

		$this->assertSame( 0, $output->getCacheExpiry() );
	}

	/**
	 * SemanticACL disables caching for a page carrying a non-public visibility
	 * marker, because whether its data shows depends on the reader. This
	 * resolver reads the same data, so it owes the same, even when the reader
	 * is permitted and a label is returned.
	 *
	 * @dataProvider provideAclMarkers
	 */
	public function testANonPublicTargetDisablesTheParserCache( string $property ): void {
		$output = new ParserOutput();
		$resolver = $this->newResolver( true, [ $property => 'users' ], $output );

		$this->assertSame( 'Widget', $resolver->label( self::TARGET ) );
		$this->assertSame( 0, $output->getCacheExpiry() );
	}

	public static function provideAclMarkers(): array {
		return [ 'visible' => [ '___VISIBLE' ], 'editable' => [ '___EDITABLE' ] ];
	}

	public function testAPublicMarkerLeavesTheCacheAlone(): void {
		$output = new ParserOutput();
		$resolver = $this->newResolver( true, [ '___VISIBLE' => 'public' ], $output );

		$this->assertNotSame( 0, $output->getCacheExpiry() );
	}

	/**
	 * File targets are declined rather than answered, because SemanticACL
	 * applies a category check to them that userCan() does not cover. Declining
	 * sends the caller back to the wiki template, which does apply it.
	 */
	public function testDeclinesFileTargets(): void {
		$resolver = $this->newResolver( true, [], new ParserOutput() );

		$this->assertFalse( $resolver->handles( 'File:Photo.png' ) );
		$this->assertTrue( $resolver->handles( self::TARGET ) );
	}

	/**
	 * @param array<string,string> $aclValues Extra properties on the target.
	 */
	private function newResolver(
		bool $canRead,
		array $aclValues,
		ParserOutput $output
	): SmwLinkLabelResolver {
		return new SmwLinkLabelResolver(
			$this->newStore( $aclValues ),
			$this->newTitleFactory(),
			$this->newPermissionManager( $canRead ),
			$this->createMock( LinkBatchFactory::class ),
			$this->createMock( User::class ),
			$output,
			'en'
		);
	}

	/**
	 * A store holding one labelled target, plus whatever ACL markers the test
	 * asks for. The label is a plain blob rather than a monolingual record, so
	 * these tests stay about access rather than about unpacking.
	 *
	 * @param array<string,string> $aclValues
	 */
	private function newStore( array $aclValues ): Store {
		$store = $this->createMock( Store::class );
		$store->method( 'service' )->willThrowException( new \RuntimeException( 'no prefetch' ) );
		$store->method( 'getPropertyValues' )->willReturnCallback(
			static function ( $subject, DIProperty $property ) use ( $aclValues ) {
				$key = $property->getKey();
				if ( isset( $aclValues[$key] ) ) {
					return [ new SMWDIBlob( $aclValues[$key] ) ];
				}
				if ( $key === '_DTITLE' ) {
					return [ new SMWDIBlob( 'Widget' ) ];
				}
				return [];
			}
		);
		$store->method( 'getSemanticData' )->willReturn(
			new SemanticData( DIWikiPage::newFromText( 'x' ) )
		);
		return $store;
	}

	private function newTitleFactory(): TitleFactory {
		$factory = $this->createMock( TitleFactory::class );
		$factory->method( 'newFromText' )->willReturnCallback(
			static function ( string $text ) {
				$title = Title::newFromText( $text );
				if ( $title === null ) {
					return null;
				}
				// The target need not exist in the database for these tests, so
				// existence is asserted rather than created.
				return $title->getNamespace() === NS_FILE ? $title : self::existing( $title );
			}
		);
		return $factory;
	}

	/** A title that reports itself as existing, without touching the database. */
	private static function existing( Title $title ): Title {
		$title->resetArticleID( 1 );
		return $title;
	}

	private function newPermissionManager( bool $canRead ): PermissionManager {
		$permissions = $this->createMock( PermissionManager::class );
		$permissions->method( 'userCan' )->willReturn( $canRead );
		return $permissions;
	}
}
