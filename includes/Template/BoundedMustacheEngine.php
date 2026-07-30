<?php

namespace MediaWiki\Extension\MwJson\Template;

use Mustache_Engine;
use RuntimeException;

/**
 * A Mustache engine that refuses to expand partials without limit.
 *
 * OSL registers a template as its own partial, named "self", so that a template
 * can recurse into nested data. Mustache's context stack walks *up* when a name
 * is not found in the current frame, so a self-recursive template whose data
 * does not shadow the section key recurses forever.
 *
 * Both engines get this wrong, but not equally badly. Lustache blows the Lua
 * stack after a few thousand frames and surfaces a script error. mustache/php
 * keeps memory flat, so PHP's memory_limit never trips and the render simply
 * never returns: measured at over 90 seconds with no end in sight and no fatal.
 * Since eval_templates come from wiki-editable jsonschema slots, that is an
 * availability hole rather than a rendering bug, so it is closed here.
 *
 * The generated template code calls loadPartial() on every expansion rather
 * than once per partial, which makes it the hook. Counting total expansions
 * per render bounds the work whatever shape the nesting takes; a legitimate
 * recursive render does one expansion per node of the data.
 */
class BoundedMustacheEngine extends Mustache_Engine {

	/**
	 * Generous next to real data, where the deepest OSL structures are a
	 * handful of levels over a few dozen members, and immediate next to a
	 * runaway template.
	 */
	public const MAX_PARTIAL_EXPANSIONS = 10000;

	private int $expansions = 0;

	/**
	 * Reset the budget. Call once per top-level render.
	 */
	public function resetExpansionBudget(): void {
		$this->expansions = 0;
	}

	/**
	 * @inheritDoc
	 * @throws RuntimeException once the budget is exhausted.
	 */
	public function loadPartial( $name ) {
		if ( ++$this->expansions > self::MAX_PARTIAL_EXPANSIONS ) {
			throw new RuntimeException( sprintf(
				'Mustache partial expansion limit of %d exceeded at partial "%s"; '
					. 'the template is probably recursing into itself without terminating',
				self::MAX_PARTIAL_EXPANSIONS,
				$name
			) );
		}
		return parent::loadPartial( $name );
	}
}
