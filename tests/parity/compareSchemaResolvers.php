<?php

namespace MediaWiki\Extension\MwJson\Tests\Parity;

use MediaWiki\Extension\MwJson\Mw\RevisionResolver;
use MediaWiki\Extension\MwJson\Mw\SlotDependencies;
use MediaWiki\Extension\MwJson\Mw\SlotJsonLoader;
use MediaWiki\Extension\MwJson\Mw\WsSlotSource;
use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
use MediaWiki\Extension\MwJson\OOLD\SchemaWalker;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\Maintenance\Maintenance;
use MediaWiki\MediaWikiServices;
use MediaWiki\Title\Title;

// @codeCoverageIgnoreStart
if ( getenv( 'MW_INSTALL_PATH' ) !== false ) {
	require_once getenv( 'MW_INSTALL_PATH' ) . '/maintenance/Maintenance.php';
} else {
	require_once __DIR__ . '/../../../../maintenance/Maintenance.php';
}
// @codeCoverageIgnoreEnd

/**
 * Half one of the schema resolver divergence check.
 *
 * A patched slot is fed to two different resolvers: SchemaWalker here in PHP,
 * and the browser, which does its own allOf walk with its own override tracking
 * and its own propertyOrder re-ranking by nesting level
 * (MwJson_schema.js _preprocess). If the two disagree about the shape of the
 * merged schema then a JSONPath such as `$.properties.unit.enum` can land
 * differently in the form than in the render, which would make patch
 * expressions unsafe to write.
 *
 * This script records what PHP does. compareSchemaResolvers.js replays the real
 * client code over the same raw slots and diffs the two. Neither half asserts on
 * its own; the JS half prints the verdict.
 *
 *     php maintenance/run.php extensions/MwJson/tests/parity/compareSchemaResolvers.php
 *     php maintenance/run.php extensions/MwJson/tests/parity/compareSchemaResolvers.php \
 *         --pages=Category:Entity,Item:OSW... --out=/tmp/php.json
 */
class CompareSchemaResolvers extends Maintenance {

	/**
	 * Keywords worth comparing per property.
	 *
	 * Not the whole definition: the two resolvers are structurally different by
	 * design (PHP flattens the chain, the client hands nested allOf to the JSON
	 * editor), so comparing whole documents would report that difference over
	 * and over. These are the keywords a patch would actually target.
	 */
	private const COMPARED_KEYWORDS = [
		'propertyOrder', 'type', 'format', 'title', 'description', 'enum', 'const', '$ref',
	];

	/** @var array<string,array> Category key => raw schema, shared by every page. */
	private array $schemaPool = [];

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Record how PHP resolves schema chains, for comparison against the client.' );
		$this->addOption( 'pages', 'Comma-separated titles instead of the whole corpus.', false, true );
		$this->addOption( 'namespaces', 'Comma-separated namespace ids to restrict the corpus.', false, true );
		$this->addOption( 'limit', 'Only process the first N pages.', false, true );
		$this->addOption( 'out', 'Where to write the recording.', false, true );
		$this->requireExtension( 'MwJson' );
	}

	public function execute() {
		$out = $this->getOption( 'out', __DIR__ . '/output/schema-resolvers/php.json' );
		$directory = dirname( $out );
		if ( !is_dir( $directory ) && !mkdir( $directory, 0777, true ) && !is_dir( $directory ) ) {
			$this->fatalError( "Cannot create $directory" );
		}

		$titles = $this->resolveTitles();
		$this->output( 'Recording ' . count( $titles ) . " pages\n" );

		$pages = [];
		foreach ( $titles as $i => $title ) {
			$pages[] = $this->record( $title );
			if ( ( $i + 1 ) % 100 === 0 ) {
				$this->output( sprintf( "  %d/%d\n", $i + 1, count( $titles ) ) );
			}
		}

		// Chains repeat heavily across a corpus, so the schemas are filed once
		// in a shared pool and the pages reference them. Inlining them per page
		// made the recording two orders of magnitude larger than the wiki.
		file_put_contents( $out, json_encode(
			[
				'pages' => $pages,
				'schemas' => $this->schemaPool,
				'comparedKeywords' => self::COMPARED_KEYWORDS,
			],
			JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
		) . "\n" );

		$this->output( "Wrote $out\n" );
	}

	/**
	 * One page's chain, in the three forms the comparison needs.
	 *
	 * - `raw` is what the client would fetch, so the JS half resolves refs from
	 *   the same bytes rather than from a second set of wiki reads.
	 * - `ranked` is the per-category propertyOrder after PropertyOrderRanker but
	 *   before the merge, which is the level the client can be compared against
	 *   at all: the client never merges.
	 * - `merged` is the flattened result the renderer actually reads.
	 */
	private function record( Title $title ): array {
		$services = MediaWikiServices::getInstance();
		$merge = new LegacyLuaMergeStrategy();
		$slots = new WsSlotSource(
			$services->getTitleFactory(),
			new RevisionResolver( $services->getWikiPageFactory() ),
			new SlotDependencies()
		);
		$loader = new SlotJsonLoader( $slots, $merge );
		$walker = new SchemaWalker( $loader, $slots, $merge );

		$page = $title->getPrefixedText();

		// Module:Entity's dispatch, as resolveSchema.php does it: a Category
		// page is walked as an instance of Category:Category, anything else
		// takes its categories from its own jsondata "type".
		$categories = null;
		$schema = [];
		if ( $title->getNamespace() === NS_CATEGORY ) {
			$categories = [ 'Category:Category' ];
			$schema = $loader->load( $page, Slots::JSONSCHEMA );
		} else {
			$jsondata = $loader->load( $page, Slots::JSONDATA );
			if ( isset( $jsondata['type'] ) ) {
				$categories = (array)$jsondata['type'];
			}
		}

		$result = $walker->walk( $schema, $categories, Slots::MODE_HEADER );

		// The walker read each category's schema before ranking mutated it, so
		// the pool gets that same starting value rather than the ranked one.
		foreach ( $result->visited as $category ) {
			if ( $category !== SchemaWalker::OWN_SCHEMA_KEY
				&& !array_key_exists( $category, $this->schemaPool )
			) {
				$this->schemaPool[$category] = $this->loadRaw( $loader, $category );
			}
		}

		return [
			'page' => $page,
			'ownCategories' => $categories,
			'visited' => $result->visited,
			// The subject's own schema is filed under "_" and is per page, so
			// it stays here rather than in the shared pool.
			'ownSchema' => $schema,
			'ranked' => $this->rankedOrders( $result->schemas ),
			'merged' => $this->summarise( $result->schema ),
		];
	}

	/**
	 * JsonSchema: pages hold their schema in the main slot, everything else in
	 * the jsonschema slot. Mirrors SchemaWalker::loadCategorySchema().
	 */
	private function loadRaw( SlotJsonLoader $loader, string $category ): array {
		$namespace = explode( ':', $category )[0] ?? '';
		return $namespace === 'JsonSchema'
			? $loader->load( $category, Slots::MAIN )
			: $loader->load( $category, Slots::JSONSCHEMA );
	}

	/**
	 * @param array<string,array> $schemas Category key => ranked schema.
	 * @return array<string,array<string,mixed>>
	 */
	private function rankedOrders( array $schemas ): array {
		$orders = [];
		foreach ( $schemas as $category => $schema ) {
			$properties = $schema['properties'] ?? null;
			if ( !is_array( $properties ) ) {
				continue;
			}
			foreach ( $properties as $name => $definition ) {
				$orders[$category][$name] = is_array( $definition )
					? ( $definition['propertyOrder'] ?? null )
					: null;
			}
		}
		return $orders;
	}

	/**
	 * @return array<string,mixed>
	 */
	private function summarise( array $schema ): array {
		$properties = $schema['properties'] ?? [];
		$summary = [];

		foreach ( $properties as $name => $definition ) {
			if ( !is_array( $definition ) ) {
				continue;
			}
			$entry = [];
			foreach ( self::COMPARED_KEYWORDS as $keyword ) {
				if ( array_key_exists( $keyword, $definition ) ) {
					$entry[$keyword] = $definition[$keyword];
				}
			}
			$summary[$name] = $entry;
		}

		return [
			'properties' => $summary,
			// Duplicates are meaningful here: the legacy merge appends
			// list-valued members, so the subject's own required list appears
			// twice. Kept verbatim rather than de-duplicated, since the client
			// does not merge at all and the difference is the finding.
			'required' => $schema['required'] ?? null,
			'defaultProperties' => $schema['defaultProperties'] ?? null,
		];
	}

	/**
	 * @return Title[]
	 */
	private function resolveTitles(): array {
		$explicit = $this->getOption( 'pages' );
		if ( $explicit !== null && trim( $explicit ) !== '' ) {
			$titles = [];
			foreach ( array_filter( array_map( 'trim', explode( ',', $explicit ) ) ) as $text ) {
				$title = Title::newFromText( $text );
				if ( $title === null ) {
					$this->fatalError( "Not a valid title: $text" );
				}
				$titles[] = $title;
			}
			return $titles;
		}

		// Every page carrying data, not every category. A Category page is
		// always walked as an instance of Category:Category, so a corpus of
		// categories resolves the same three-member chain over and over and
		// exercises one path however many pages it contains. Instances are
		// what produce deep and varied chains.
		$rows = $this->getDB( DB_REPLICA )->newSelectQueryBuilder()
			->select( [ 'page_namespace', 'page_title' ] )
			->from( 'page' )
			->join( 'slots', null, 'slot_revision_id = page_latest' )
			->join( 'slot_roles', null, 'slot_role_id = role_id' )
			->where( [ 'role_name' => 'jsondata' ] )
			->orderBy( [ 'page_namespace', 'page_title' ] )
			->caller( __METHOD__ )
			->fetchResultSet();

		$namespaces = $this->getOption( 'namespaces' );
		$allowed = $namespaces === null
			? null
			: array_map( 'intval', array_filter( array_map( 'trim', explode( ',', $namespaces ) ) ) );

		$titles = [];
		foreach ( $rows as $row ) {
			if ( $allowed !== null && !in_array( (int)$row->page_namespace, $allowed, true ) ) {
				continue;
			}
			$title = Title::makeTitleSafe( (int)$row->page_namespace, $row->page_title );
			if ( $title !== null ) {
				$titles[] = $title;
			}
		}

		$limit = $this->getOption( 'limit' );
		return $limit !== null ? array_slice( $titles, 0, (int)$limit ) : $titles;
	}
}

// @codeCoverageIgnoreStart
$maintClass = CompareSchemaResolvers::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
