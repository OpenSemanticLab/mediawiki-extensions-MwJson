<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Title\TitleFactory;
use ParserOutput;

/**
 * Registers the pages a schema resolution read as parser-cache dependencies.
 *
 * ## What this fixes, and what it costs
 *
 * Resolving a schema reads the whole category chain and every `$ref` target,
 * but nothing tells MediaWiki that the rendered page depends on them. So
 * editing a category's `jsonschema` slot leaves every page below it serving a
 * stale parser-cache entry until it is edited or purged.
 *
 * Note this is not something the port introduced. The Lua behaves the same way,
 * and for the same reason: WSSlots reads register nothing, while Scribunto's
 * `mw.title` content reads do, which is why `JsonSchema:` refs already appear as
 * dependencies and categories never have.
 *
 * It is off by default because switching it on is an operational event rather
 * than a behaviour change: once categories are registered, editing a base
 * category queues a refresh for every page beneath it. That is the correct
 * outcome and the whole point, but on a wiki with thousands of entities it
 * wants to be scheduled rather than discovered.
 *
 * @see ResolvedSchemaCache which supplies the set, on a hit as well as a miss
 */
class ParserDependencyRegistrar {

	private ParserOutput $parserOutput;
	private TitleFactory $titleFactory;

	public function __construct( ParserOutput $parserOutput, TitleFactory $titleFactory ) {
		$this->parserOutput = $parserOutput;
		$this->titleFactory = $titleFactory;
	}

	/**
	 * @param array<string,int> $revisions Prefixed page title => revision id
	 *   read, 0 for a page that did not exist.
	 */
	public function register( array $revisions ): void {
		foreach ( $revisions as $pageTitle => $revisionId ) {
			$title = $this->titleFactory->newFromText( (string)$pageTitle );
			if ( $title === null || !$title->canExist() ) {
				continue;
			}

			// A page that was absent is registered too, with id and revision 0.
			// That is how core records a link to a page that does not exist yet,
			// and it is what makes creating one invalidate the pages that looked
			// for it.
			$this->parserOutput->addTemplate(
				$title,
				$title->getArticleID(),
				(int)$revisionId
			);
		}
	}
}
