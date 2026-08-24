<?php

namespace MediaWiki\Extension\MwJson\Tests\Parity;

use MediaWiki\Extension\MwJson\Mw\SlotDependencies;
use MediaWiki\Extension\MwJson\Mw\SlotJsonLoader;
use MediaWiki\Extension\MwJson\Mw\WsSlotSource;
use MediaWiki\Extension\MwJson\OOLD\JsonRefExpander;
use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
use MediaWiki\Extension\MwJson\OOLD\SchemaWalker;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\MediaWikiServices;

// @codeCoverageIgnoreStart
if ( getenv( 'MW_INSTALL_PATH' ) !== false ) {
	require_once getenv( 'MW_INSTALL_PATH' ) . '/maintenance/Maintenance.php';
} else {
	require_once __DIR__ . '/../../../../maintenance/Maintenance.php';
}
// @codeCoverageIgnoreEnd

/**
 * Resolve a real page's schema chain through the PHP pipeline and print it.
 *
 * A development tool, not an assertion: it exercises WsSlotSource ->
 * SlotJsonLoader -> JsonRefExpander -> SchemaWalker against the live wiki so
 * the adapters can be checked before the renderer that will consume them
 * exists. Correctness of the algorithm itself is pinned by the Lua differential
 * tests in tests/phpunit/Unit.
 *
 *     php maintenance/run.php extensions/MwJson/tests/parity/resolveSchema.php \
 *         --page=Category:Entity
 */
class ResolveSchema extends Maintenance {

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Resolve a page schema chain through the PHP OO-LD pipeline.' );
		$this->addOption( 'page', 'Page to resolve.', true, true );
		$this->addOption( 'mode', 'header (default) or footer.', false, true );
		$this->addOption( 'properties', 'Also list merged properties by propertyOrder.' );
		$this->addOption( 'json', 'Dump the merged schema as JSON.' );
		$this->addOption( 'cached', 'Resolve twice through ResolvedSchemaCache and report both timings.' );
		$this->requireExtension( 'MwJson' );
	}

	public function execute() {
		$services = MediaWikiServices::getInstance();
		$page = $this->getOption( 'page' );
		$mode = $this->getOption( 'mode', Slots::MODE_HEADER );

		$dependencies = new SlotDependencies();
		$merge = new LegacyLuaMergeStrategy();
		$slots = new WsSlotSource(
			$services->getTitleFactory(),
			$services->getWikiPageFactory(),
			$dependencies
		);
		$loader = new SlotJsonLoader( $slots, $merge );
		$expander = new JsonRefExpander( $loader, $merge );
		$walker = new SchemaWalker( $loader, $slots, $merge );

		// Module:Entity's dispatch, minimally: a Category page is walked as an
		// instance of Category:Category, anything else takes its categories
		// from its own jsondata "type".
		$title = $services->getTitleFactory()->newFromText( $page );
		if ( $title === null ) {
			$this->fatalError( "Not a valid title: $page" );
		}

		$jsondata = $loader->load( $page, Slots::JSONDATA );
		$categories = null;
		$schema = [];

		if ( $title->getNamespace() === NS_CATEGORY ) {
			$categories = [ 'Category:Category' ];
			$schema = $loader->load( $page, Slots::JSONSCHEMA );
		} elseif ( isset( $jsondata['type'] ) ) {
			$categories = (array)$jsondata['type'];
		}

		$start = microtime( true );
		$result = $walker->walk( $schema, $categories, $mode );
		$merged = $expander->expand( $result->schema );
		$elapsed = ( microtime( true ) - $start ) * 1000;

		$this->output( "Page:       $page\n" );
		$this->output( "Mode:       $mode\n" );
		$this->output( sprintf( "Resolved in %.1f ms\n\n", $elapsed ) );

		$this->output( "Chain (most basal first):\n" );
		foreach ( $result->visited as $category ) {
			$this->output( sprintf(
				"  %-60s %s\n",
				$category,
				isset( $result->templates[$category] ) ? 'has template' : 'no template'
			) );
		}

		$this->output( "\nSlots read (" . count( $dependencies->getAll() ) . "):\n" );
		foreach ( $dependencies->getAll() as $dependency => $revision ) {
			$this->output( sprintf( "  %-60s rev %d\n", $dependency, $revision ) );
		}

		if ( $this->hasOption( 'properties' ) ) {
			$properties = $merged['properties'] ?? [];
			uasort( $properties, static function ( $a, $b ) {
				return ( $a['propertyOrder'] ?? PHP_INT_MAX ) <=> ( $b['propertyOrder'] ?? PHP_INT_MAX );
			} );
			$this->output( "\nMerged properties (" . count( $properties ) . ") by propertyOrder:\n" );
			foreach ( $properties as $name => $definition ) {
				$this->output( sprintf(
					"  %12s  %s\n",
					$definition['propertyOrder'] ?? '-',
					$name
				) );
			}
		}

		if ( $this->hasOption( 'cached' ) ) {
			$this->reportCache( $services, $dependencies, $walker, $schema, $categories, $mode, $page );
		}

		if ( $this->hasOption( 'json' ) ) {
			$this->output( "\n" . json_encode(
				$merged,
				JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
			) . "\n" );
		}
	}

	/**
	 * Resolve through ResolvedSchemaCache twice against the wiki's real
	 * WANObjectCache: once cold (the process memo is cleared in between, so the
	 * second call has to come from the shared cache) and once warm.
	 *
	 * @param string[]|null $categories
	 */
	private function reportCache(
		MediaWikiServices $services,
		SlotDependencies $dependencies,
		SchemaWalker $walker,
		array $schema,
		?array $categories,
		string $mode,
		string $page
	): void {
		$cache = new \MediaWiki\Extension\MwJson\Mw\ResolvedSchemaCache(
			$services->getMainWANObjectCache(),
			$services->getTitleFactory(),
			$services->getLinkBatchFactory()
		);

		$compute = static function () use ( $walker, $schema, $categories, $mode ) {
			return $walker->walk( $schema, $categories, $mode );
		};

		$this->output( "\nResolvedSchemaCache:\n" );

		$timings = [];
		foreach ( [ 'first call', 'shared cache', 'process memo' ] as $label ) {
			if ( $label === 'shared cache' ) {
				$cache->clearProcessCache();
			}
			$start = microtime( true );
			$result = $cache->get( "$page|$mode", $dependencies, $compute );
			$timings[$label] = [ ( microtime( true ) - $start ) * 1000, $result ];
		}

		$reference = null;
		foreach ( $timings as $label => [ $ms, $result ] ) {
			$this->output( sprintf( "  %-14s %7.2f ms  chain of %d\n", $label, $ms, count( $result->visited ) ) );
			$reference ??= $result;
			if ( $result->visited !== $reference->visited || $result->schema !== $reference->schema ) {
				$this->fatalError( "Cached result differs from the computed one at '$label'." );
			}
		}
		$this->output( "  cached result matches the computed one\n" );
	}
}

// @codeCoverageIgnoreStart
$maintClass = ResolveSchema::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
