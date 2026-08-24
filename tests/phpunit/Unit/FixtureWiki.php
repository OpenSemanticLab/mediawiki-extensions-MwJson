<?php

namespace MediaWiki\Extension\MwJson\Tests\Unit;

use MediaWiki\Extension\MwJson\OOLD\JsonLoader;
use MediaWiki\Extension\MwJson\OOLD\SlotTextLoader;

/**
 * In-memory wiki for the schema tests.
 *
 * The page set must stay identical to the `pages` table in
 * tests/parity/lua/dumpSchema.lua, so the Lua and the PHP see the same input
 * and LuaSchemaFixtureTest is comparing implementations rather than fixtures.
 * It is shaped after the real OSL core schemas: a JsonSchema: page in the main
 * slot, Category: pages with theirs in the jsonschema slot chaining via allOf
 * raw-action refs, and header_template slots as plain wikitext.
 */
class FixtureWiki implements JsonLoader, SlotTextLoader {

	/** @var array<string,array<string,mixed>> page title => slot => content */
	public const PAGES = [
		// Reached by any $ref whose path has no "wiki/" segment: p.loadJson
		// defaults its title to this. See JsonRefExpander's
		// UNPARSEABLE_REF_FALLBACK.
		'JsonSchema:Entity' => [
			'main' => [ 'title' => 'FALLBACK Entity schema', 'type' => 'object' ],
		],
		'JsonSchema:Label' => [
			'main' => [
				'title' => 'Label',
				'type' => 'object',
				'properties' => [
					'text' => [ 'type' => 'string', 'propertyOrder' => 10 ],
					'lang' => [ 'type' => 'string', 'propertyOrder' => 20 ],
				],
			],
		],
		'Category:Entity' => [
			'jsonschema' => [
				'title' => 'Entity',
				'@context' => [ 'label' => 'Property:HasLabel' ],
				'properties' => [
					'uuid' => [ 'type' => 'string', 'propertyOrder' => 10 ],
					'label' => [ 'type' => 'array', 'propertyOrder' => 20 ],
					'comment' => [ 'type' => 'string', 'propertyOrder' => 2000 ],
					'internal' => [ 'type' => 'string' ],
				],
				'required' => [ 'uuid' ],
			],
			'header_template' => '<div>Entity {{{label|}}}</div>',
		],
		'Category:Item' => [
			'jsonschema' => [
				'title' => 'Item',
				'allOf' => [ [ '$ref' => '/wiki/Category:Entity?action=raw&slot=jsonschema' ] ],
				'properties' => [
					'name' => [ 'type' => 'string', 'propertyOrder' => 5 ],
					// Redeclares an inherited property with no order of its
					// own, which must keep the ancestor's ranked position.
					'label' => [ 'type' => 'array', 'title' => 'Label override' ],
				],
				'required' => [ 'name' ],
			],
			'header_template' => '<div>Item</div>',
		],
		'Category:Tool' => [
			'jsonschema' => [
				'title' => 'Tool',
				'allOf' => [ [ '$ref' => '/wiki/Category:Item?action=raw&slot=jsonschema' ] ],
				'properties' => [
					'serial' => [ 'type' => 'string', 'propertyOrder' => 0 ],
					'retired' => [ 'type' => 'string', 'propertyOrder' => -5 ],
				],
			],
			// No header_template slot, so the walker records no entry for it.
		],
		'Category:Diamond' => [
			'jsonschema' => [
				'title' => 'Diamond',
				'allOf' => [
					[ '$ref' => '/wiki/Category:Item?action=raw&slot=jsonschema' ],
					[ '$ref' => '/wiki/Category:Tool?action=raw&slot=jsonschema' ],
				],
			],
		],
		'Category:Conflict' => [
			'jsonschema' => [
				'title' => 'Conflict',
				'allOf' => [
					[ '$ref' => '/wiki/JsonSchema:Label?action=raw', 'title' => 'sibling wins' ],
				],
			],
		],
	];

	/** @inheritDoc */
	public function load( string $pageTitle, ?string $slot = null ): array {
		$content = self::PAGES[$pageTitle][$slot ?? 'main'] ?? null;
		return is_array( $content ) ? $content : [];
	}

	/** @inheritDoc */
	public function getText( string $pageTitle, string $slot ): ?string {
		$content = self::PAGES[$pageTitle][$slot] ?? null;
		return is_string( $content ) ? $content : null;
	}
}
