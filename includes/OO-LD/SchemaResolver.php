<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Resolves a page's schema chain.
 *
 * Exists so the orchestrator can be handed either the plain SchemaWalker or a
 * caching decorator around it, without the walker having to know that caching
 * exists or the orchestrator having to know that it does not.
 */
interface SchemaResolver {

	/**
	 * @param array $schema The subject page's own schema.
	 * @param string[]|string|null $categories Chain root, or null to derive it
	 *   from $schema's allOf.
	 * @param string $mode Slots::MODE_HEADER or Slots::MODE_FOOTER.
	 * @param bool $recursive Follow ancestors' own allOf chains.
	 * @param string|null $template Template for the subject page itself.
	 */
	public function walk(
		array $schema,
		$categories = null,
		string $mode = Slots::MODE_HEADER,
		bool $recursive = true,
		?string $template = null
	): SchemaWalkResult;
}
