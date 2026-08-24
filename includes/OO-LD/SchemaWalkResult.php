<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * What p.walkJsonSchema() returns, as a value object instead of five loose
 * table fields.
 *
 * Downstream code needs all five: the merged schema to read property
 * definitions from, the per-category schemas to work out where a property was
 * declared, the per-category templates to render, and the visit order to
 * iterate both of those in.
 */
final class SchemaWalkResult {

	/** The whole inheritance chain flattened into one object. */
	public array $schema;

	/**
	 * Category key => that category's own schema, unflattened, with
	 * propertyOrder already rescaled.
	 *
	 * Keyed by prefixed title, plus the literal "_" for the subject page's own
	 * schema, which the Lua appends as a dummy category so it participates in
	 * the same ordering and merging as its ancestors.
	 *
	 * @var array<string,array>
	 */
	public array $schemas;

	/**
	 * Category key => header_template/footer_template wikitext, or null.
	 *
	 * @var array<string,?string>
	 */
	public array $templates;

	/**
	 * Category keys in visit order, most basal first, "_" last.
	 *
	 * @var string[]
	 */
	public array $visited;

	/** @var string[] */
	public array $debug;

	/**
	 * @param array<string,array> $schemas
	 * @param array<string,?string> $templates
	 * @param string[] $visited
	 * @param string[] $debug
	 */
	public function __construct(
		array $schema,
		array $schemas,
		array $templates,
		array $visited,
		array $debug = []
	) {
		$this->schema = $schema;
		$this->schemas = $schemas;
		$this->templates = $templates;
		$this->visited = $visited;
		$this->debug = $debug;
	}
}
