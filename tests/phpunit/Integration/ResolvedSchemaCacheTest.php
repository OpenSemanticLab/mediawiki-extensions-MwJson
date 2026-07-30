<?php

namespace MediaWiki\Extension\MwJson\Tests\Integration;

use HashBagOStuff;
use MediaWiki\Cache\LinkBatchFactory;
use MediaWiki\Extension\MwJson\Mw\ResolvedSchemaCache;
use MediaWiki\Extension\MwJson\Mw\SlotDependencies;
use MediaWiki\Extension\MwJson\OOLD\SchemaWalkResult;
use MediaWiki\Title\Title;
use MediaWiki\Title\TitleFactory;
use MediaWikiIntegrationTestCase;
use WANObjectCache;

/**
 * The cache decides whether a stored resolution is still valid, so a mistake
 * here serves a stale schema silently: pages keep rendering, just with the
 * wrong properties. These tests pin the invalidation rules rather than the
 * speedup.
 *
 * An integration test rather than a unit one only because it type-hints
 * MediaWiki service classes; it uses a HashBagOStuff and stub titles, so it
 * needs no database content.
 *
 * @covers \MediaWiki\Extension\MwJson\Mw\ResolvedSchemaCache
 * @covers \MediaWiki\Extension\MwJson\Mw\SlotDependencies
 * @group MwJson
 */
class ResolvedSchemaCacheTest extends MediaWikiIntegrationTestCase {

	private WANObjectCache $wan;
	/** @var array<string,int> title => latest revision id the stub reports */
	private array $revisions = [];

	protected function setUp(): void {
		parent::setUp();
		$this->wan = new WANObjectCache( [ 'cache' => new HashBagOStuff() ] );
	}

	private function newCache(): ResolvedSchemaCache {
		$titleFactory = $this->createStub( TitleFactory::class );
		$titleFactory->method( 'newFromText' )->willReturnCallback(
			function ( $text ) {
				$title = $this->createStub( Title::class );
				$title->method( 'getLatestRevID' )->willReturnCallback(
					fn () => $this->revisions[$text] ?? 0
				);
				return $title;
			}
		);

		// The batch is a pure prefetch; nothing reads its result.
		$linkBatch = $this->createStub( \MediaWiki\Cache\LinkBatch::class );
		$linkBatchFactory = $this->createStub( LinkBatchFactory::class );
		$linkBatchFactory->method( 'newLinkBatch' )->willReturn( $linkBatch );

		return new ResolvedSchemaCache( $this->wan, $titleFactory, $linkBatchFactory );
	}

	/**
	 * @param string[] $visited
	 * @param array<string,int> $reads title => revision the resolution "read"
	 */
	private function computer( array $visited, array $reads, SlotDependencies $deps, int &$calls ): callable {
		return static function () use ( $visited, $reads, $deps, &$calls ) {
			$calls++;
			foreach ( $reads as $title => $revision ) {
				$deps->record( $title, $revision );
			}
			return new SchemaWalkResult( [ 'title' => 'merged' ], [], [], $visited );
		};
	}

	public function testComputesOnMissAndReusesOnHit(): void {
		$cache = $this->newCache();
		$deps = new SlotDependencies();
		$calls = 0;
		$this->revisions = [ 'Category:Entity' => 10 ];
		$compute = $this->computer( [ 'Category:Entity' ], [ 'Category:Entity' => 10 ], $deps, $calls );

		$first = $cache->get( 'Item:X|header', $deps, $compute );
		$cache->clearProcessCache();
		$second = $cache->get( 'Item:X|header', $deps, $compute );

		$this->assertSame( 1, $calls, 'the second call comes from the shared cache' );
		$this->assertSame( $first->visited, $second->visited );
		$this->assertSame( [ 'title' => 'merged' ], $second->schema );
	}

	public function testEditingADependencyInvalidates(): void {
		$cache = $this->newCache();
		$deps = new SlotDependencies();
		$calls = 0;
		$this->revisions = [ 'Category:Entity' => 10 ];
		$compute = $this->computer( [ 'Category:Entity' ], [ 'Category:Entity' => 10 ], $deps, $calls );

		$cache->get( 'Item:X|header', $deps, $compute );
		$cache->clearProcessCache();

		// Somebody edits the base Category. Every descendant must recompute
		// without anyone maintaining an invalidation list.
		$this->revisions['Category:Entity'] = 11;
		$cache->get( 'Item:X|header', $deps, $compute );

		$this->assertSame( 2, $calls );
	}

	public function testCreatingAPageThatWasLookedForAndMissingInvalidates(): void {
		$cache = $this->newCache();
		$deps = new SlotDependencies();
		$calls = 0;
		// Revision 0 records "this page was consulted and did not exist".
		$this->revisions = [ 'Category:Later' => 0 ];
		$compute = $this->computer( [], [ 'Category:Later' => 0 ], $deps, $calls );

		$cache->get( 'Item:X|header', $deps, $compute );
		$cache->clearProcessCache();

		$this->revisions['Category:Later'] = 5;
		$cache->get( 'Item:X|header', $deps, $compute );

		$this->assertSame( 2, $calls, 'an absent dependency appearing must invalidate' );
	}

	public function testResolutionsThatReadNothingAreNotStored(): void {
		$cache = $this->newCache();
		$deps = new SlotDependencies();
		$calls = 0;
		$compute = $this->computer( [], [], $deps, $calls );

		$cache->get( 'Item:X|header', $deps, $compute );
		$cache->clearProcessCache();
		$cache->get( 'Item:X|header', $deps, $compute );

		// With no dependencies there is nothing that could invalidate the
		// entry, so it must not be stored at all.
		$this->assertSame( 2, $calls );
	}

	public function testDifferentSubjectKeysDoNotShareAnEntry(): void {
		$cache = $this->newCache();
		$deps = new SlotDependencies();
		$calls = 0;
		$this->revisions = [ 'Category:Entity' => 10 ];
		$compute = $this->computer( [ 'Category:Entity' ], [ 'Category:Entity' => 10 ], $deps, $calls );

		// header and footer walks collect different template slots, so the
		// mode has to be part of the key.
		$cache->get( 'Item:X|header', $deps, $compute );
		$cache->get( 'Item:X|footer', $deps, $compute );

		$this->assertSame( 2, $calls );
	}

	public function testDependenciesAreResetPerResolution(): void {
		$cache = $this->newCache();
		$deps = new SlotDependencies();
		$calls = 0;
		$this->revisions = [ 'Category:A' => 1, 'Category:B' => 1 ];

		$cache->get( 'Item:A|header', $deps, $this->computer( [], [ 'Category:A' => 1 ], $deps, $calls ) );
		$cache->get( 'Item:B|header', $deps, $this->computer( [], [ 'Category:B' => 1 ], $deps, $calls ) );

		// Item:B must not inherit Item:A's dependencies, or an edit to
		// Category:A would needlessly invalidate Item:B and, worse, a stale
		// collector could mask a dependency that really did change.
		$this->assertSame( [ 'Category:B' => 1 ], $deps->getAll() );
	}

	public function testSlotDependenciesSortsAndResets(): void {
		$deps = new SlotDependencies();
		$this->assertTrue( $deps->isEmpty() );

		$deps->record( 'Category:Z', 2 );
		$deps->record( 'Category:A', 1 );

		// Sorted so the stored set is stable regardless of walk order.
		$this->assertSame( [ 'Category:A' => 1, 'Category:Z' => 2 ], $deps->getAll() );

		$deps->reset();
		$this->assertTrue( $deps->isEmpty() );
	}
}
