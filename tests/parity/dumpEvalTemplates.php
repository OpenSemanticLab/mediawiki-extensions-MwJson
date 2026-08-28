<?php

namespace MediaWiki\Extension\MwJson\Tests\Parity;

use MediaWiki\Extension\MwJson\Mw\RevisionResolver;
use MediaWiki\Extension\MwJson\Mw\SlotJsonLoader;
use MediaWiki\Extension\MwJson\Mw\WsSlotSource;
use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
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
 * Collect every distinct eval_template on the wiki, paired with real jsondata
 * values to render it against.
 *
 * Feeds the Lustache/lightncandy conformance gate: swapping the mustache engine
 * is only safe if the replacement agrees with the incumbent on the templates
 * that actually exist, which use delimiter switching, implicit iterators and
 * nested sections. Synthetic cases would not be convincing.
 *
 * Writes two representations of the same case list, so both engines can be
 * driven from identical input:
 *
 *   tests/parity/output/eval-templates.json  read by compareMustache.php
 *   tests/parity/output/eval-templates.lua   read by lua/compareMustache.lua
 *
 *     php maintenance/run.php extensions/MwJson/tests/parity/dumpEvalTemplates.php
 */
class DumpEvalTemplates extends Maintenance {

	/** Namespaces that hold schemas. NS_CATEGORY plus OSL's JsonSchema. */
	private const SCHEMA_NAMESPACES = [ NS_CATEGORY, 7220 ];

	/** Cap on sample values kept per property, to keep the case list reviewable. */
	private const MAX_SAMPLES = 3;

	private SlotJsonLoader $loader;

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Dump eval_templates plus real sample data for the mustache conformance gate.' );
		$this->addOption( 'limit', 'Only scan the first N schema pages.', false, true );
		$this->requireExtension( 'MwJson' );
	}

	public function execute() {
		$services = MediaWikiServices::getInstance();
		$this->loader = new SlotJsonLoader(
			new WsSlotSource(
				$services->getTitleFactory(),
				new RevisionResolver( $services->getWikiPageFactory() )
			),
			new LegacyLuaMergeStrategy()
		);

		$this->output( "Scanning schemas...\n" );
		$templates = $this->collectTemplates( $this->schemaPages() );
		$this->output( sprintf( "  %d distinct template(s)\n", count( $templates ) ) );

		$this->output( "Collecting sample values...\n" );
		$samples = $this->collectSamples( array_column( $templates, 'property' ) );

		$cases = [];
		foreach ( $templates as $template ) {
			$values = $samples[$template['property']] ?? [];
			$cases[] = $template + [ 'samples' => array_slice( $values, 0, self::MAX_SAMPLES ) ];
		}

		$dir = __DIR__ . '/output';
		if ( !is_dir( $dir ) && !mkdir( $dir, 0777, true ) && !is_dir( $dir ) ) {
			$this->fatalError( "Cannot create $dir" );
		}

		file_put_contents(
			"$dir/eval-templates.json",
			json_encode( $cases, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "\n"
		);
		file_put_contents( "$dir/eval-templates.lua", $this->toLua( $cases ) );

		$withSamples = count( array_filter( $cases, static fn ( $c ) => $c['samples'] !== [] ) );
		$this->output( sprintf(
			"Wrote %d case(s), %d with sample data, to %s/eval-templates.{json,lua}\n",
			count( $cases ), $withSamples, $dir
		) );
	}

	/** @return Title[] */
	private function schemaPages(): array {
		$titles = [];
		$dbr = $this->getReplicaDB();
		$rows = $dbr->newSelectQueryBuilder()
			->select( [ 'page_namespace', 'page_title' ] )
			->from( 'page' )
			->where( [ 'page_namespace' => self::SCHEMA_NAMESPACES ] )
			->orderBy( [ 'page_namespace', 'page_title' ] )
			->caller( __METHOD__ )
			->fetchResultSet();

		foreach ( $rows as $row ) {
			$titles[] = Title::makeTitle( $row->page_namespace, $row->page_title );
		}

		$limit = $this->getOption( 'limit' );
		return $limit !== null ? array_slice( $titles, 0, (int)$limit ) : $titles;
	}

	/**
	 * @param Title[] $pages
	 * @return array<int,array{template:string,type:string,mode:?string,root_key:?bool,partials:array,property:string,level:string,source:string}>
	 */
	private function collectTemplates( array $pages ): array {
		$byHash = [];

		foreach ( $pages as $page ) {
			$title = $page->getPrefixedText();
			$slot = $page->getNamespace() === NS_CATEGORY ? Slots::JSONSCHEMA : Slots::MAIN;
			$schema = $this->loader->load( $title, $slot );

			foreach ( $this->findTemplates( $schema ) as $found ) {
				// Same template text plus same render shape is one case, however
				// many schemas declare it; OSL copies these between categories.
				$hash = sha1( $found['template'] . '|' . $found['property'] . '|' . $found['level'] );
				if ( !isset( $byHash[$hash] ) ) {
					$byHash[$hash] = $found + [ 'source' => $title ];
				}
			}
		}

		return array_values( $byHash );
	}

	/**
	 * Walk a schema for eval_template declarations, recording which property
	 * each belongs to and whether it renders the property or its array items,
	 * since that decides what the render input looks like.
	 *
	 * @return array<int,array<string,mixed>>
	 */
	private function findTemplates( array $schema, string $property = '', string $level = 'root' ): array {
		$found = [];

		foreach ( $schema['properties'] ?? [] as $name => $definition ) {
			if ( !is_array( $definition ) ) {
				continue;
			}
			foreach ( $this->normalise( $definition['eval_template'] ?? null ) as $template ) {
				$found[] = $template + [ 'property' => (string)$name, 'level' => 'property' ];
			}
			if ( isset( $definition['items'] ) && is_array( $definition['items'] ) ) {
				foreach ( $this->normalise( $definition['items']['eval_template'] ?? null ) as $template ) {
					$found[] = $template + [ 'property' => (string)$name, 'level' => 'items' ];
				}
				$found = array_merge( $found, $this->findTemplates( $definition['items'], (string)$name, 'items' ) );
			}
			$found = array_merge( $found, $this->findTemplates( $definition, (string)$name, 'nested' ) );
		}

		return $found;
	}

	/**
	 * eval_template is either one object or a list of them, and only the
	 * mustache flavours are of interest here; a plain "wikitext" template never
	 * reaches the mustache engine.
	 *
	 * @param mixed $raw
	 * @return array<int,array<string,mixed>>
	 */
	private function normalise( $raw ): array {
		if ( !is_array( $raw ) || $raw === [] ) {
			return [];
		}
		$list = array_is_list( $raw ) ? $raw : [ $raw ];

		$out = [];
		foreach ( $list as $entry ) {
			if ( !is_array( $entry ) || !isset( $entry['value'] ) || !is_string( $entry['value'] ) ) {
				continue;
			}
			$type = $entry['type'] ?? '';
			if ( $type !== 'mustache' && $type !== 'mustache-wikitext' ) {
				continue;
			}
			$out[] = [
				'template' => $entry['value'],
				'type' => $type,
				'mode' => $entry['mode'] ?? null,
				'root_key' => $entry['root_key'] ?? null,
				'partials' => is_array( $entry['partials'] ?? null ) ? $entry['partials'] : [],
			];
		}
		return $out;
	}

	/**
	 * Real values for each property name, taken from pages' jsondata slots.
	 *
	 * @param string[] $properties
	 * @return array<string,array<int,mixed>>
	 */
	private function collectSamples( array $properties ): array {
		$wanted = array_flip( $properties );
		$samples = [];

		$dbr = $this->getReplicaDB();
		$rows = $dbr->newSelectQueryBuilder()
			->select( [ 'page_namespace', 'page_title' ] )
			->from( 'page' )
			->where( $dbr->expr( 'page_namespace', '!=', NS_MEDIAWIKI ) )
			->orderBy( [ 'page_namespace', 'page_title' ] )
			->caller( __METHOD__ )
			->fetchResultSet();

		$scanned = 0;
		foreach ( $rows as $row ) {
			$title = Title::makeTitle( $row->page_namespace, $row->page_title );
			$jsondata = $this->loader->load( $title->getPrefixedText(), Slots::JSONDATA );
			if ( $jsondata === [] ) {
				continue;
			}
			$scanned++;

			foreach ( $jsondata as $key => $value ) {
				if ( !isset( $wanted[$key] ) || $value === null || $value === [] || $value === '' ) {
					continue;
				}
				$samples[$key] ??= [];
				if ( count( $samples[$key] ) >= self::MAX_SAMPLES ) {
					continue;
				}
				// Distinct values only, so three samples mean three shapes
				// rather than the same value three times.
				$encoded = json_encode( $value );
				foreach ( $samples[$key] as $existing ) {
					if ( json_encode( $existing ) === $encoded ) {
						continue 2;
					}
				}
				$samples[$key][] = $value;
			}

			// Keep the loader's process cache from growing without bound over
			// thousands of pages; nothing is read twice here.
			if ( $scanned % 200 === 0 ) {
				$this->loader->clearCache();
				$this->output( "  $scanned pages with jsondata\n" );
			}
		}

		return $samples;
	}

	/**
	 * Emit the case list as a Lua chunk, so the Lua side needs no JSON parser.
	 */
	private function toLua( array $cases ): string {
		$out = "-- Generated by tests/parity/dumpEvalTemplates.php. Do not edit.\n"
			. "-- Case list for the Lustache side of the mustache conformance gate.\n"
			. "return {\n";
		foreach ( $cases as $case ) {
			$out .= "\t" . $this->luaValue( $case ) . ",\n";
		}
		return $out . "}\n";
	}

	/**
	 * @param mixed $value
	 */
	private function luaValue( $value ): string {
		if ( $value === null ) {
			return 'nil';
		}
		if ( is_bool( $value ) ) {
			return $value ? 'true' : 'false';
		}
		if ( is_int( $value ) || is_float( $value ) ) {
			return (string)$value;
		}
		if ( is_string( $value ) ) {
			return $this->luaString( $value );
		}
		if ( !is_array( $value ) ) {
			return 'nil';
		}

		$parts = [];
		if ( array_is_list( $value ) ) {
			foreach ( $value as $item ) {
				$parts[] = $this->luaValue( $item );
			}
		} else {
			foreach ( $value as $key => $item ) {
				$parts[] = '[' . $this->luaString( (string)$key ) . '] = ' . $this->luaValue( $item );
			}
		}
		return '{ ' . implode( ', ', $parts ) . ' }';
	}

	/**
	 * Quote a string for Lua 5.1.
	 *
	 * Escapes every byte outside printable ASCII numerically rather than using
	 * long-bracket syntax, which would break on a template containing the
	 * closing bracket sequence.
	 */
	private function luaString( string $value ): string {
		$out = '"';
		$length = strlen( $value );
		for ( $i = 0; $i < $length; $i++ ) {
			$char = $value[$i];
			$byte = ord( $char );
			if ( $char === '"' || $char === '\\' ) {
				$out .= '\\' . $char;
			} elseif ( $byte < 32 || $byte === 127 ) {
				$out .= '\\' . $byte;
			} else {
				$out .= $char;
			}
		}
		return $out . '"';
	}
}

// @codeCoverageIgnoreStart
$maintClass = DumpEvalTemplates::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
