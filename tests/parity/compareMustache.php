<?php

namespace MediaWiki\Extension\MwJson\Tests\Parity;

use MediaWiki\Extension\MwJson\Template\MustacheRenderer;
use MediaWiki\Maintenance\Maintenance;

// @codeCoverageIgnoreStart
if ( getenv( 'MW_INSTALL_PATH' ) !== false ) {
	require_once getenv( 'MW_INSTALL_PATH' ) . '/maintenance/Maintenance.php';
} else {
	require_once __DIR__ . '/../../../../maintenance/Maintenance.php';
}
// @codeCoverageIgnoreEnd

/**
 * The mustache conformance gate.
 *
 * Renders every eval_template on the wiki through MustacheRenderer and diffs
 * the output against the same templates rendered by the real Module:Lustache,
 * so replacing the engine is an evidence-based decision rather than an
 * assumption. The OSL templates use delimiter switching, implicit iterators and
 * nested sections, which a synthetic suite would not exercise.
 *
 * Run the three steps in order:
 *
 *   php maintenance/run.php extensions/MwJson/tests/parity/dumpEvalTemplates.php
 *   lua extensions/MwJson/tests/parity/lua/compareMustache.lua \
 *       > extensions/MwJson/tests/parity/output/lustache-results.json
 *   php maintenance/run.php extensions/MwJson/tests/parity/compareMustache.php
 *
 * Exits non-zero if any case differs, so it can gate the phase.
 */
class CompareMustache extends Maintenance {

	public function __construct() {
		parent::__construct();
		$this->addDescription( 'Diff MustacheRenderer against Module:Lustache over the wiki eval_templates.' );
		$this->addOption( 'verbose-diff', 'Print the full text of every difference.' );
		$this->addOption( 'report', 'Write the report to this file.', false, true );
		$this->addOption(
			'escape-slash',
			'Reproduce Lustache\'s escaping of "/" as "&#x2F;". See MustacheRenderer::ESCAPE_SLASH.'
		);
		$this->requireExtension( 'MwJson' );
	}

	public function execute() {
		$dir = __DIR__ . '/output';
		$cases = $this->readJson( "$dir/eval-templates.json" );
		$lua = $this->readJson( "$dir/lustache-results.json" );

		$renderer = new MustacheRenderer( $this->hasOption( 'escape-slash' ) );
		$lines = [];
		$same = 0;
		$differing = [];

		foreach ( $lua['results'] as $expected ) {
			$case = $cases[$expected['index']] ?? null;
			if ( $case === null ) {
				$this->fatalError(
					"Lua results reference case {$expected['index']}, which is not in eval-templates.json. "
					. 'Regenerate both, in order.'
				);
			}

			$input = $this->inputFor( $case, $expected['input'] );
			$actual = null;
			$error = null;
			try {
				$actual = $renderer->render(
					$case['template'],
					$input,
					$this->partialsFor( $case )
				);
			} catch ( \Throwable $e ) {
				$error = get_class( $e ) . ': ' . $e->getMessage();
			}

			if ( $error === null && $expected['ok'] && $actual === ( $expected['output'] ?? '' ) ) {
				$same++;
				continue;
			}

			$differing[] = [
				'index' => $expected['index'],
				'input' => $expected['input'],
				'property' => $case['property'],
				'source' => $case['source'],
				'template' => $case['template'],
				'lustache' => $expected['ok'] ? ( $expected['output'] ?? '' ) : 'ERROR: ' . $expected['error'],
				'lightncandy' => $error ?? $actual,
			];
		}

		$total = $same + count( $differing );
		$lines[] = sprintf( '%d/%d rendered outputs identical', $same, $total );
		$lines[] = '';

		foreach ( $differing as $diff ) {
			$lines[] = sprintf(
				'case %d (%s, property "%s", from %s)',
				$diff['index'], $diff['input'], $diff['property'], $diff['source']
			);
			if ( $this->hasOption( 'verbose-diff' ) ) {
				$lines[] = '  template:    ' . $diff['template'];
			}
			$lines[] = '  lustache:    ' . $this->show( $diff['lustache'] );
			$lines[] = '  lightncandy: ' . $this->show( $diff['lightncandy'] );
			$lines[] = '  first diff:  ' . $this->firstDifference( $diff['lustache'], (string)$diff['lightncandy'] );
			$lines[] = '';
		}

		$text = implode( "\n", $lines ) . "\n";
		$this->output( $text );

		$report = $this->getOption( 'report' );
		if ( $report !== null ) {
			file_put_contents( $report, $text );
		}

		if ( $differing ) {
			$this->fatalError( sprintf( '%d case(s) differ.', count( $differing ) ) );
		}
	}

	/**
	 * Rebuild the render input for a case, matching inputsFor() in
	 * lua/compareMustache.lua. The label identifies which sample and, for
	 * item-level templates, which element of it.
	 *
	 * @return mixed
	 */
	private function inputFor( array $case, string $label ) {
		if ( $label === 'empty' ) {
			return [];
		}

		preg_match( '/^sample (\d+)(?: item (\d+))?$/', $label, $m );
		$sample = $case['samples'][(int)$m[1] - 1] ?? null;

		if ( isset( $m[2] ) ) {
			return $sample[(int)$m[2] - 1] ?? null;
		}
		if ( ( $case['root_key'] ?? null ) === false ) {
			return $sample;
		}
		return [ $case['property'] => $sample ];
	}

	/**
	 * expandEmbeddedTemplates registers the template itself as a partial named
	 * "self", so a template can recurse.
	 */
	private function partialsFor( array $case ): array {
		return [ 'self' => $case['template'] ] + ( $case['partials'] ?? [] );
	}

	/**
	 * @param mixed $value
	 */
	private function show( $value ): string {
		$text = (string)$value;
		return strlen( $text ) > 300 ? substr( $text, 0, 300 ) . '...' : $text;
	}

	private function firstDifference( string $a, string $b ): string {
		$limit = min( strlen( $a ), strlen( $b ) );
		for ( $i = 0; $i < $limit; $i++ ) {
			if ( $a[$i] !== $b[$i] ) {
				return sprintf(
					'byte %d: lustache %s vs lightncandy %s',
					$i,
					var_export( substr( $a, $i, 12 ), true ),
					var_export( substr( $b, $i, 12 ), true )
				);
			}
		}
		return $a === $b ? 'none' : sprintf( 'length %d vs %d', strlen( $a ), strlen( $b ) );
	}

	private function readJson( string $path ): array {
		if ( !is_readable( $path ) ) {
			$this->fatalError( "Missing $path. See the header of this script for the run order." );
		}
		return json_decode( file_get_contents( $path ), true, 512, JSON_THROW_ON_ERROR );
	}
}

// @codeCoverageIgnoreStart
$maintClass = CompareMustache::class;
require_once RUN_MAINTENANCE_IF_MAIN;
// @codeCoverageIgnoreEnd
