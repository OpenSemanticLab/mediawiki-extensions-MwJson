<?php

namespace MediaWiki\Extension\MwJson\Tests\Parity;

use MediaWiki\Maintenance\Maintenance;
use MediaWiki\Title\Title;

// @codeCoverageIgnoreStart
if ( getenv( 'MW_INSTALL_PATH' ) !== false ) {
	require_once getenv( 'MW_INSTALL_PATH' ) . '/maintenance/Maintenance.php';
} else {
	require_once __DIR__ . '/../../../../maintenance/Maintenance.php';
}
// @codeCoverageIgnoreEnd

require_once __DIR__ . '/HtmlNormalizer.php';
require_once __DIR__ . '/ParityRecorder.php';

/**
 * Strict-parity harness for the Module:MwJson -> PHP migration.
 *
 * Record a baseline from the legacy Lua implementation:
 *
 *     php maintenance/run.php extensions/MwJson/tests/parity/renderParity.php \
 *         --label=lua
 *
 * Then, after switching $wgMwJsonRenderer to 'php', diff against it:
 *
 *     php maintenance/run.php extensions/MwJson/tests/parity/renderParity.php \
 *         --label=php --compare=lua
 *
 * Exits non-zero when any page differs, so it can gate the cutover.
 */
class RenderParity extends Maintenance {

	private const DEFAULT_MODES = [ 'header', 'footer' ];

	public function __construct() {
		parent::__construct();
		$this->addDescription(
			'Record or compare rendered output + SMW data for the OSL header/footer pipeline.'
		);
		$this->addOption( 'label', 'Name for this run, e.g. "lua" or "php".', true, true );
		$this->addOption(
			'implementation',
			'Entry point to render through: "lua" ({{#invoke:Entity}}) or "php" ({{#mwjson:}}). '
				. 'Defaults to the label when that is one of the two.',
			false,
			true
		);
		$this->addOption( 'compare', 'Diff against a previously recorded label.', false, true );
		$this->addOption( 'modes', 'Comma-separated modes (default: header,footer).', false, true );
		$this->addOption( 'pages', 'Comma-separated titles instead of the full corpus.', false, true );
		$this->addOption( 'namespaces', 'Comma-separated namespace ids to restrict the corpus.', false, true );
		$this->addOption( 'limit', 'Only process the first N pages of the corpus.', false, true );
		$this->addOption( 'report', 'Write a human-readable report to this file.', false, true );
		$this->addOption(
			'renderer',
			'Set $wgMwJsonRenderer for this run ("lua" or "php"). With the Module:Entity shim '
				. 'deployed this is what actually selects the implementation, and it keeps the '
				. 'entry point identical on both sides, which the --implementation option does not.',
			false,
			true
		);
		$this->addOption( 'timings', 'Also record per-page wall time (excluded from diffs).' );
		$this->requireExtension( 'MwJson' );
	}

	public function execute() {
		$label = $this->getOption( 'label' );
		$outputDir = __DIR__ . '/output/' . $label;
		if ( !is_dir( $outputDir ) && !mkdir( $outputDir, 0777, true ) && !is_dir( $outputDir ) ) {
			$this->fatalError( "Cannot create $outputDir" );
		}

		$implementation = $this->getOption( 'implementation' )
			?? ( in_array( $label, [ 'lua', 'php' ], true ) ? $label : 'lua' );
		$renderer = $this->getOption( 'renderer' );
		if ( $renderer !== null ) {
			// Set before anything parses. The config is read through
			// GlobalVarConfig, so the global is the switch.
			$GLOBALS['wgMwJsonRenderer'] = $renderer;
			$this->output( "wgMwJsonRenderer: $renderer\n" );
		}

		$recorder = ParityRecorder::newFromGlobalState( $implementation );
		$this->output( "Entry point: $implementation\n" );
		$modes = $this->parseList( $this->getOption( 'modes' ) ) ?: self::DEFAULT_MODES;
		$titles = $this->resolveTitles( $recorder );

		if ( !$titles ) {
			$this->fatalError( 'Corpus is empty. Is Module:MwJson transcluded anywhere?' );
		}

		$this->output( sprintf(
			"Recording '%s': %d page(s) x %d mode(s)\n",
			$label, count( $titles ), count( $modes )
		) );

		$records = [];
		$timings = [];
		foreach ( $titles as $i => $title ) {
			foreach ( $modes as $mode ) {
				$key = $title->getPrefixedText() . '#' . $mode;
				$start = microtime( true );
				$record = $recorder->record( $title, $mode );
				$timings[$key] = round( ( microtime( true ) - $start ) * 1000, 1 );
				$records[$key] = $record;

				if ( $record['error'] !== null ) {
					$this->output( "  ERROR $key: {$record['error']}\n" );
				}
			}
			if ( ( $i + 1 ) % 25 === 0 ) {
				$this->output( sprintf( "  %d/%d\n", $i + 1, count( $titles ) ) );
			}
		}

		ksort( $records, SORT_STRING );
		$this->writeJson( "$outputDir/records.json", $records );
		if ( $this->hasOption( 'timings' ) ) {
			$this->writeJson( "$outputDir/timings.json", $timings );
			$this->reportTimings( $timings );
		}
		$this->output( "Wrote $outputDir/records.json\n" );

		$compare = $this->getOption( 'compare' );
		if ( $compare === null ) {
			return;
		}

		$baselineFile = __DIR__ . '/output/' . $compare . '/records.json';
		if ( !is_readable( $baselineFile ) ) {
			$this->fatalError( "No baseline to compare against at $baselineFile" );
		}
		$baseline = json_decode( file_get_contents( $baselineFile ), true );

		$diffs = $this->diff( $baseline, $records );
		$this->reportDiffs( $compare, $label, $diffs, count( $records ), count( $baseline ) );

		if ( $diffs ) {
			$this->fatalError( sprintf( '%d record(s) differ. Parity not reached.', count( $diffs ) ) );
		}
		$this->output( "Parity reached: all records identical.\n" );
	}

	/**
	 * @return array<string,array{html:bool,smw:bool,error:bool}>
	 */
	private function diff( array $baseline, array $current ): array {
		$diffs = [];
		// Only what this run actually rendered. A subset run against the full
		// baseline would otherwise report every page it did not touch as a
		// difference; reportDiffs() states the coverage instead.
		foreach ( array_keys( $current ) as $key ) {
			$a = $baseline[$key] ?? null;
			$b = $current[$key] ?? null;
			if ( $a === null || $b === null ) {
				$diffs[$key] = [ 'missing' => true ];
				continue;
			}
			$delta = array_filter( [
				'html' => $a['html'] !== $b['html'],
				'smw' => $a['smw'] !== $b['smw'],
				'error' => $a['error'] !== $b['error'],
			] );
			if ( $delta ) {
				$diffs[$key] = $delta;
			}
		}
		ksort( $diffs, SORT_STRING );
		return $diffs;
	}

	private function reportDiffs(
		string $baselineLabel,
		string $label,
		array $diffs,
		int $compared = 0,
		int $baselineSize = 0
	): void {
		$lines = [ sprintf( '=== %s vs %s ===', $baselineLabel, $label ), '' ];
		if ( !$diffs ) {
			$lines[] = 'No differences.';
		}
		foreach ( $diffs as $key => $delta ) {
			$lines[] = sprintf( '%-70s %s', $key, implode( ', ', array_keys( $delta ) ) );
		}
		$lines[] = sprintf(
			'Compared %d of %d baseline record(s); %d differ.',
			$compared, $baselineSize, count( $diffs )
		);
		$text = implode( "\n", $lines ) . "\n";

		$this->output( $text );
		$report = $this->getOption( 'report' );
		if ( $report !== null ) {
			file_put_contents( $report, $text );
			$this->output( "Report written to $report\n" );
		}
	}

	private function reportTimings( array $timings ): void {
		$values = array_values( $timings );
		sort( $values, SORT_NUMERIC );
		$count = count( $values );
		if ( !$count ) {
			return;
		}
		$percentile = static fn ( float $p ) => $values[(int)floor( ( $count - 1 ) * $p )];
		$this->output( sprintf(
			"Wall time per record: p50 %.1f ms, p95 %.1f ms, max %.1f ms (n=%d)\n",
			$percentile( 0.5 ), $percentile( 0.95 ), end( $values ), $count
		) );
	}

	/** @return Title[] */
	private function resolveTitles( ParityRecorder $recorder ): array {
		$explicit = $this->parseList( $this->getOption( 'pages' ) );
		if ( $explicit ) {
			$titles = [];
			foreach ( $explicit as $text ) {
				$title = Title::newFromText( $text );
				if ( $title === null ) {
					$this->fatalError( "Not a valid title: $text" );
				}
				$titles[] = $title;
			}
			return $titles;
		}

		$namespaces = $this->parseList( $this->getOption( 'namespaces' ) );
		$titles = $recorder->getCorpus(
			$namespaces ? array_map( 'intval', $namespaces ) : null
		);

		$limit = $this->getOption( 'limit' );
		return $limit !== null ? array_slice( $titles, 0, (int)$limit ) : $titles;
	}

	/** @return string[] */
	private function parseList( ?string $value ): array {
		if ( $value === null || trim( $value ) === '' ) {
			return [];
		}
		return array_values( array_filter( array_map( 'trim', explode( ',', $value ) ) ) );
	}

	private function writeJson( string $path, array $data ): void {
		file_put_contents(
			$path,
			json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . "\n"
		);
	}
}

// @codeCoverageIgnoreStart
$maintClass = RenderParity::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
