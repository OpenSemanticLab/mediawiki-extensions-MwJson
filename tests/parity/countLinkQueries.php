<?php

namespace MediaWiki\Extension\MwJson\Tests\Parity;

use MediaWiki\Extension\MwJson\Mw\PipelineFactory;
use MediaWiki\Extension\MwJson\Mw\SlotJsonLoader;
use MediaWiki\Extension\MwJson\OOLD\JsonUtil;
use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
use MediaWiki\Extension\MwJson\OOLD\SchemaKeys;
use MediaWiki\Extension\MwJson\OOLD\Slots;
use MediaWiki\Extension\MwJson\Template\LegacyTemplateBypass;
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
 * Count the SMW queries the link templates cost, per page.
 *
 * Module:Viewer/Link resolves a link's label with one mw.smw.ask per link, so
 * the cost of rendering a page's references is linear in how many it has. This
 * reports that distribution over the corpus, which is what decides whether
 * batching the lookup is worth building.
 *
 *     php maintenance/run.php extensions/MwJson/tests/parity/countLinkQueries.php
 */
class CountLinkQueries extends Maintenance {

	private $walker;
	private $merge;

	/** Which recognised class to count; see the --class option. */
	private $wanted;

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Report how many per-link SMW label queries each page costs.' );
		$this->addOption( 'limit', 'Only look at the first N pages.', false, true );
		$this->addOption( 'top', 'How many worst offenders to list (default 15).', false, true );
		$this->addOption(
			'class',
			'Which recognised template class to count: "link" (page form, one SMW label '
				. 'query each) or "link-url" (url form, no query). Default "link".',
			false,
			true
		);
		$this->requireExtension( 'MwJson' );
	}

	public function execute() {
		$services = MediaWikiServices::getInstance();
		$factory = new PipelineFactory();
		$loader = $factory->newSlotJsonLoader();
		$this->merge = new LegacyLuaMergeStrategy();
		$this->walker = new \MediaWiki\Extension\MwJson\OOLD\SchemaWalker(
			$loader,
			new \MediaWiki\Extension\MwJson\Mw\WsSlotSource(
				$services->getTitleFactory(),
				$services->getWikiPageFactory()
			),
			$this->merge
		);
		$bypass = new LegacyTemplateBypass();
		$keys = new SchemaKeys();
		$this->wanted = $this->getOption( 'class' ) ?? LegacyTemplateBypass::CLASS_LINK;

		$counts = [];
		$pages = $this->corpus();
		$limit = (int)( $this->getOption( 'limit' ) ?? 0 );
		if ( $limit > 0 ) {
			$pages = array_slice( $pages, 0, $limit );
		}

		foreach ( $pages as $i => $title ) {
			if ( $i % 200 === 0 ) {
				$this->output( sprintf( "  %d/%d\n", $i, count( $pages ) ) );
			}

			$data = $loader->load( $title->getPrefixedText(), Slots::JSONDATA );
			$schema = $this->schemaFor( $title, $loader );
			if ( !$data || !$schema ) {
				continue;
			}

			$counts[$title->getPrefixedText()] = $this->countLinks( $data, $schema, $bypass, $keys );
		}

		$this->report( $counts );
	}

	/**
	 * How many values on this page would each be rendered by a page-form
	 * Viewer/Link, and so cost one label query.
	 */
	private function countLinks(
		array $data,
		array $schema,
		LegacyTemplateBypass $bypass,
		SchemaKeys $keys
	): int {
		$total = 0;

		foreach ( $data as $key => $value ) {
			$templates = JsonUtil::defaultArgPath(
				$schema, [ 'properties', $key, $keys->legacy( 'template' ) ], []
			);
			if ( !JsonUtil::hasFirstElement( $templates ) ) {
				$templates = $templates === [] ? [] : [ $templates ];
			}

			foreach ( $templates as $template ) {
				if ( !is_array( $template ) ) {
					continue;
				}
				$class = $bypass->classify( $template, (string)$key );
				if ( $class !== $this->wanted ) {
					continue;
				}
				// One query per item in the list, or one for a bare value.
				$total += is_array( $value ) ? count( $value ) : 1;
			}

			// Nested objects carry their own link properties.
			if ( is_array( $value ) && !JsonUtil::hasFirstElement( $value ) ) {
				$total += $this->countLinks(
					$value,
					JsonUtil::defaultArgPath( $schema, [ 'properties', $key ], [] ),
					$bypass,
					$keys
				);
			} elseif ( is_array( $value ) ) {
				$itemSchema = JsonUtil::defaultArgPath( $schema, [ 'properties', $key, 'items' ], [] );
				foreach ( $value as $item ) {
					if ( is_array( $item ) && !JsonUtil::hasFirstElement( $item ) ) {
						$total += $this->countLinks( $item, $itemSchema, $bypass, $keys );
					}
				}
			}
		}

		return $total;
	}

	/**
	 * The page's own resolved schema, so that link properties declared by a
	 * derived category are counted too, not only the ones on Category:Entity.
	 *
	 * @return array|null
	 */
	private function schemaFor( Title $title, SlotJsonLoader $loader ): ?array {
		$isCategory = $title->getNamespace() === NS_CATEGORY;

		$schema = $isCategory
			? ( $loader->load( $title->getPrefixedText(), Slots::JSONSCHEMA ) ?: [] )
			: ( $loader->load( $title->getPrefixedText(), Slots::JSONDATA ) ?: [] );

		return $this->walker->walk(
			$isCategory ? $schema : [],
			$isCategory ? [ 'Category:Category' ] : ( $schema['type'] ?? null )
		)->schema;
	}

	private function report( array $counts ): void {
		$values = array_values( $counts );
		sort( $values );
		$n = count( $values );
		if ( $n === 0 ) {
			$this->output( "No pages.\n" );
			return;
		}

		$this->output( sprintf(
			"\n%d page(s). Per-link label queries: total %d, mean %.1f, p50 %d, p90 %d, p99 %d, max %d\n",
			$n,
			array_sum( $values ),
			array_sum( $values ) / $n,
			$values[(int)( $n * 0.5 )],
			$values[(int)( $n * 0.9 )],
			$values[(int)( $n * 0.99 )],
			end( $values )
		) );

		$zero = count( array_filter( $values, static fn ( $v ) => $v === 0 ) );
		$this->output( sprintf( "%d page(s) have none; %d have at least one.\n", $zero, $n - $zero ) );

		arsort( $counts );
		$top = (int)( $this->getOption( 'top' ) ?? 15 );
		$this->output( "\nWorst:\n" );
		foreach ( array_slice( $counts, 0, $top, true ) as $title => $count ) {
			$this->output( sprintf( "  %5d  %s\n", $count, $title ) );
		}
	}

	/**
	 * The same corpus the parity harness uses: every page that transcludes the
	 * module, so the census covers exactly the pages the port has to render.
	 *
	 * @return Title[]
	 */
	private function corpus(): array {
		require_once __DIR__ . '/HtmlNormalizer.php';
		require_once __DIR__ . '/ParityRecorder.php';
		return ParityRecorder::newFromGlobalState( 'lua' )->getCorpus();
	}
}

// @codeCoverageIgnoreStart
$maintClass = CountLinkQueries::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
