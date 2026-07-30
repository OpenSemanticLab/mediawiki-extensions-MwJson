<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\Template\WikitextPreprocessor;

/**
 * Makes every crossing of the wikitext boundary visible in the output.
 *
 * The markers match those produced by the frame stub in
 * tests/parity/lua/dumpExpand.lua, so the fixture pins not only the expanded
 * values but exactly when the parser is invoked and with which arguments.
 */
class StubWikitextPreprocessor implements WikitextPreprocessor {

	/** @inheritDoc */
	public function preprocess( string $wikitext ): string {
		return "PRE[$wikitext]";
	}

	/** @inheritDoc */
	public function preprocessWithArgs( string $wikitext, array $args ): string {
		return "CHILD[$wikitext|" . $this->showArgs( $args ) . ']';
	}

	/** @inheritDoc */
	public function expandTemplate( string $title, array $args ): string {
		return "TPL[$title|" . $this->showArgs( $args ) . ']';
	}

	/**
	 * Sorted, because the Lua stub sorts too: pairs() has no defined order, so
	 * an unsorted rendering would not be reproducible.
	 *
	 * @param array<string,string> $args
	 */
	private function showArgs( array $args ): string {
		ksort( $args, SORT_STRING );
		$parts = [];
		foreach ( $args as $key => $value ) {
			$parts[] = "$key=$value";
		}
		return implode( ',', $parts );
	}
}
