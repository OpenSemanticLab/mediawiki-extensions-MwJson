<?php

/**
 * Magic word definitions for the MwJson parser functions.
 *
 * MediaWiki resolves a parser function name through a magic word, so
 * setFunctionHook( 'mwjson', ... ) raises "invalid magic word" until the name
 * is declared here.
 *
 * The leading 0 makes the name case-insensitive, so {{#mwjson:}} and
 * {{#MwJson:}} both work, which matches how the other OSL parser functions
 * behave.
 */

$magicWords = [];

$magicWords['en'] = [
	'mwjson' => [ 0, 'mwjson' ],
];

$magicWords['de'] = [
	'mwjson' => [ 0, 'mwjson' ],
];
