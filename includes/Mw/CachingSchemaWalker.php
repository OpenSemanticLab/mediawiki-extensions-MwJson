<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Extension\MwJson\OOLD\SchemaResolver;
use MediaWiki\Extension\MwJson\OOLD\SchemaWalker;
use MediaWiki\Extension\MwJson\OOLD\SchemaWalkResult;
use MediaWiki\Extension\MwJson\OOLD\Slots;

/**
 * Serves a schema walk from ResolvedSchemaCache when one is available.
 *
 * Sits in front of SchemaWalker rather than inside it so the walker itself
 * stays MediaWiki-free and unit-testable, and so the cache can be left out
 * entirely by constructing the walker directly.
 *
 * Only walks that can be identified are cached. A page passing an inline
 * schema or template has no stable key, so those go straight through: the key
 * would have to hash the schema, and such calls are rare enough not to be
 * worth it.
 */
class CachingSchemaWalker implements SchemaResolver {

	private SchemaWalker $walker;
	private ResolvedSchemaCache $cache;
	private SlotDependencies $dependencies;
	private string $subjectTitle;
	private ?ParserDependencyRegistrar $registrar;

	/**
	 * @param ParserDependencyRegistrar|null $registrar Records the pages the
	 *   walk read as parser-cache dependencies. Null leaves them unregistered,
	 *   which is what both this port and the Lua have always done.
	 */
	public function __construct(
		SchemaWalker $walker,
		ResolvedSchemaCache $cache,
		SlotDependencies $dependencies,
		string $subjectTitle,
		?ParserDependencyRegistrar $registrar = null
	) {
		$this->walker = $walker;
		$this->cache = $cache;
		$this->dependencies = $dependencies;
		$this->subjectTitle = $subjectTitle;
		$this->registrar = $registrar;
	}

	/**
	 * Same signature as SchemaWalker::walk().
	 *
	 * @param string[]|string|null $categories
	 */
	public function walk(
		array $schema,
		$categories = null,
		string $mode = Slots::MODE_HEADER,
		bool $recursive = true,
		?string $template = null
	): SchemaWalkResult {
		$key = $this->cacheKey( $schema, $categories, $mode, $recursive, $template );

		if ( $key === null ) {
			return $this->walker->walk( $schema, $categories, $mode, $recursive, $template );
		}

		return $this->cache->get(
			$key,
			$this->dependencies,
			fn (): SchemaWalkResult => $this->walker->walk(
				$schema, $categories, $mode, $recursive, $template
			),
			$this->registrar
		);
	}

	/**
	 * A key that identifies this walk, or null when it cannot be identified
	 * cheaply.
	 *
	 * The categories are part of it because they are what the walk starts from,
	 * and the mode because header and footer collect different template slots.
	 * The subject title is included even though the walk does not depend on it,
	 * because two pages with the same categories still want separate entries:
	 * sharing one would be correct but would make every invalidation global.
	 *
	 * @param string[]|string|null $categories
	 */
	private function cacheKey(
		array $schema,
		$categories,
		string $mode,
		bool $recursive,
		?string $template
	): ?string {
		// An inline schema or template means the caller supplied content that
		// is not addressable by title, so there is nothing stable to key on.
		if ( $schema !== [] || $template !== null ) {
			return null;
		}

		$roots = $categories === null ? [ '' ] : (array)$categories;
		sort( $roots, SORT_STRING );

		return implode( '|', [
			$this->subjectTitle,
			$mode,
			$recursive ? 'r' : 'n',
			implode( ',', $roots ),
		] );
	}
}
