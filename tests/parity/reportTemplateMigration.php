<?php

namespace MediaWiki\Extension\MwJson\Tests\Parity;

use MediaWiki\Extension\MwJson\Mw\SlotJsonLoader;
use MediaWiki\Extension\MwJson\Mw\WsSlotSource;
use MediaWiki\Extension\MwJson\OOLD\LegacyLuaMergeStrategy;
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
 * Report which eval_templates the PHP pipeline can render natively, so schemas
 * can migrate before the Lua is retired rather than after.
 *
 * Most of them are Lua-era workarounds. Scribunto could not read the reader's
 * language or resolve a display title, so schemas wrapped values in wikitext
 * that did it at parse time. The PHP pipeline resolves both from declarations
 * the schema already carries, which means the usual migration is to *delete*
 * the eval_template rather than to rewrite it.
 *
 *     php maintenance/run.php extensions/MwJson/tests/parity/reportTemplateMigration.php
 *     php maintenance/run.php .../reportTemplateMigration.php --verbose --class=language
 */
class ReportTemplateMigration extends Maintenance {

	private const SCHEMA_NAMESPACES = [ NS_CATEGORY, 7220 ];

	/**
	 * Each class: how to recognise it, what the pipeline does instead, and what
	 * the schema should carry once the template is gone.
	 */
	private const CLASSES = [
		'language' => [
			'pattern' => '/#switch:\s*\{\{USERLANGUAGECODE/',
			'replaced_by' => 'Render\\MultilangValue resolves the reader language, then English, then a default',
			'schema_after' => 'Delete the eval_template. Keep the value in the {text, lang} shape it '
				. 'already uses; the renderer reads it directly. No new declaration needed.',
		],
		'link' => [
			'pattern' => '/\{\{\s*Viewer\/Link|\[\[\s*\{\{\{?\.\}?\}\}\s*\]\]/',
			'replaced_by' => 'Render\\LinkHelper links any value the context types as @id',
			'schema_after' => 'Delete the eval_template. Ensure the @context entry for the property is '
				. '{"@id": "...", "@type": "@id"}, which is what tells the renderer it is a reference.',
		],
		'no_wikitext' => [
			'pattern' => null,
			'replaced_by' => 'Nothing; it already renders without the parser',
			'schema_after' => 'Change "type" from "mustache-wikitext" to "mustache". Output is '
				. 'unchanged; it just stops taking a parser round-trip it never used.',
		],
		'query' => [
			'pattern' => '/\{\{#ask:/',
			'replaced_by' => 'Nothing. A live query against the store.',
			'schema_after' => 'Keep as is.',
		],
		'store_write' => [
			'pattern' => '/\{\{#set:/',
			'replaced_by' => 'Nothing. Writes semantic data as a side effect of rendering.',
			'schema_after' => 'Keep as is, though a value mapped through @context would be preferable.',
		],
	];

	/** Anything matching this genuinely needs the parser. */
	private const NEEDS_PARSER = '/\{\{#(ask|set|arraymap|tag|batchupload|invoke)|\{\{#if|\{\{[A-Z]/';

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Report eval_templates the PHP pipeline can render natively.' );
		$this->addOption( 'verbose', 'Print every template rather than a summary.' );
		$this->addOption( 'class', 'Only report one class (see the summary for names).', false, true );
		$this->requireExtension( 'MwJson' );
	}

	public function execute() {
		$services = MediaWikiServices::getInstance();
		$loader = new SlotJsonLoader(
			new WsSlotSource( $services->getTitleFactory(), $services->getWikiPageFactory() ),
			new LegacyLuaMergeStrategy()
		);

		$found = [];
		foreach ( $this->schemaPages() as $page ) {
			$slot = $page->getNamespace() === NS_CATEGORY ? Slots::JSONSCHEMA : Slots::MAIN;
			$schema = $loader->load( $page->getPrefixedText(), $slot );
			foreach ( $this->collect( $schema ) as $entry ) {
				$entry['source'] = $page->getPrefixedText();
				$found[sha1( $entry['value'] . $entry['property'] )] = $entry;
			}
		}

		$byClass = [];
		foreach ( $found as $entry ) {
			$byClass[$this->classify( $entry )][] = $entry;
		}

		$only = $this->getOption( 'class' );
		$replaceable = 0;

		foreach ( self::CLASSES as $name => $meta ) {
			$entries = $byClass[$name] ?? [];
			if ( $only !== null && $only !== $name ) {
				continue;
			}
			if ( in_array( $name, [ 'language', 'link', 'no_wikitext' ], true ) ) {
				$replaceable += count( $entries );
			}

			$this->output( sprintf( "\n=== %s: %d template(s) ===\n", $name, count( $entries ) ) );
			$this->output( '  pipeline:     ' . $meta['replaced_by'] . "\n" );
			$this->output( '  schema after: ' . $meta['schema_after'] . "\n" );

			if ( !$this->hasOption( 'verbose' ) ) {
				foreach ( array_slice( $entries, 0, 3 ) as $entry ) {
					$this->output( sprintf( "    %-26s %s\n", $entry['property'], $this->trim( $entry['value'] ) ) );
				}
				if ( count( $entries ) > 3 ) {
					$this->output( sprintf( "    ... and %d more\n", count( $entries ) - 3 ) );
				}
				continue;
			}
			foreach ( $entries as $entry ) {
				$this->output( sprintf( "    %s\n      on %s\n      %s\n",
					$entry['property'], $entry['source'], $this->trim( $entry['value'] ) ) );
			}
		}

		$this->output( sprintf(
			"\n%d of %d template(s) can be retired or downgraded once the PHP pipeline renders.\n",
			$replaceable, count( $found )
		) );

		// What the port would actually absorb without any schema change. The
		// gap against the classes above is the point of interest: those are
		// templates that are replaceable in principle but whose exact shape the
		// recogniser refuses, so they keep being rendered until a schema moves.
		$bypass = new LegacyTemplateBypass();
		$absorbed = [];
		$missed = [];
		foreach ( $found as $entry ) {
			$class = $bypass->classify(
				[ 'type' => $entry['type'], 'value' => $entry['value'] ],
				$entry['property']
			);
			if ( $class !== null ) {
				$absorbed[$class] = ( $absorbed[$class] ?? 0 ) + 1;
			} elseif ( in_array( $this->classify( $entry ), [ 'language', 'link' ], true ) ) {
				$missed[] = $entry;
			}
		}

		$this->output( sprintf(
			"\nLegacyTemplateBypass would absorb %d with no schema change: %s\n",
			array_sum( $absorbed ),
			json_encode( $absorbed )
		) );
		if ( $missed ) {
			$this->output( sprintf(
				"%d replaceable template(s) the recogniser refuses, so they keep rendering:\n",
				count( $missed )
			) );
			foreach ( $missed as $entry ) {
				$this->output( sprintf( "    %-24s %s\n", $entry['property'], $this->trim( $entry['value'] ) ) );
			}
		}
	}

	private function classify( array $entry ): string {
		$value = $entry['value'];

		// Order matters: a template doing a live query keeps needing the parser
		// even if it also switches on the language.
		foreach ( [ 'query', 'store_write' ] as $name ) {
			if ( preg_match( self::CLASSES[$name]['pattern'], $value ) ) {
				return $name;
			}
		}
		if ( $entry['type'] !== 'mustache-wikitext' || !preg_match( self::NEEDS_PARSER, $value ) ) {
			return 'no_wikitext';
		}
		foreach ( [ 'language', 'link' ] as $name ) {
			if ( preg_match( self::CLASSES[$name]['pattern'], $value ) ) {
				return $name;
			}
		}
		return 'other';
	}

	/** @return array<int,array{property:string,value:string,type:string}> */
	private function collect( array $schema, string $property = '' ): array {
		$found = [];
		foreach ( $schema['properties'] ?? [] as $name => $definition ) {
			if ( !is_array( $definition ) ) {
				continue;
			}
			foreach ( [ $definition, $definition['items'] ?? [] ] as $node ) {
				if ( !is_array( $node ) ) {
					continue;
				}
				$raw = $node['eval_template'] ?? null;
				if ( !is_array( $raw ) ) {
					continue;
				}
				foreach ( array_is_list( $raw ) ? $raw : [ $raw ] as $template ) {
					if ( is_array( $template ) && isset( $template['value'] ) && is_string( $template['value'] ) ) {
						$found[] = [
							'property' => (string)$name,
							'value' => $template['value'],
							'type' => $template['type'] ?? '',
						];
					}
				}
				$found = array_merge( $found, $this->collect( $node, (string)$name ) );
			}
		}
		return $found;
	}

	private function trim( string $value ): string {
		$value = preg_replace( '/\s+/', ' ', $value );
		return strlen( $value ) > 96 ? substr( $value, 0, 96 ) . '...' : $value;
	}

	/** @return Title[] */
	private function schemaPages(): array {
		$rows = $this->getReplicaDB()->newSelectQueryBuilder()
			->select( [ 'page_namespace', 'page_title' ] )
			->from( 'page' )
			->where( [ 'page_namespace' => self::SCHEMA_NAMESPACES ] )
			->caller( __METHOD__ )
			->fetchResultSet();

		$titles = [];
		foreach ( $rows as $row ) {
			$titles[] = Title::makeTitle( $row->page_namespace, $row->page_title );
		}
		return $titles;
	}
}

// @codeCoverageIgnoreStart
$maintClass = ReportTemplateMigration::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
