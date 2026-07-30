<?php

namespace MediaWiki\Extension\MwJson\Template;

use RuntimeException;

/**
 * A schema's eval_template could not be compiled.
 *
 * Templates come from wiki-editable jsonschema slots, so a broken one is an
 * editing mistake rather than a code defect. Callers catch this and render the
 * property unexpanded, keeping the rest of the page alive.
 */
class MustacheCompileException extends RuntimeException {

	private string $template;

	public function __construct( string $message, string $template ) {
		parent::__construct( $message . ': ' . $template );
		$this->template = $template;
	}

	public function getTemplate(): string {
		return $this->template;
	}
}
