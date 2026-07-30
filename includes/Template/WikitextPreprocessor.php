<?php

namespace MediaWiki\Extension\MwJson\Template;

/**
 * The wikitext operations expandEmbeddedTemplates needs from the parser.
 *
 * Kept as an interface so EmbeddedTemplateExpander stays MediaWiki-free and
 * testable with arrays in and arrays out. The three methods correspond to
 * frame:preprocess, frame:newChild{args=...}:preprocess and
 * frame:expandTemplate in the Lua.
 */
interface WikitextPreprocessor {

	/**
	 * Lua: frame:preprocess( $wikitext ).
	 *
	 * Expands templates and parser functions in the current frame.
	 */
	public function preprocess( string $wikitext ): string;

	/**
	 * Lua: frame:newChild{ args = $args }:preprocess( $wikitext ).
	 *
	 * Expands in a child frame whose numbered and named arguments are $args, so
	 * the wikitext can refer to {{{key}}}.
	 *
	 * @param array<string,string> $args
	 */
	public function preprocessWithArgs( string $wikitext, array $args ): string;

	/**
	 * Lua: frame:expandTemplate{ title = $title, args = $args }.
	 *
	 * @param array<string,string> $args
	 */
	public function expandTemplate( string $title, array $args ): string;

	/**
	 * Lua: frame:callParserFunction( $name, $args ).
	 *
	 * Used for `#tree`, which wraps the rendered bullet list, and `filepath`,
	 * which resolves File: values for the embedded JSON-LD.
	 *
	 * @param array<int|string,string> $args
	 */
	public function callParserFunction( string $name, array $args ): string;
}
