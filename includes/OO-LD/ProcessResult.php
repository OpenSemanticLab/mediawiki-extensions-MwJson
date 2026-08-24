<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Everything EntityProcessor produces for one page render.
 *
 * The Lua's processJsondata emits wikitext and, along the way, writes to SMW
 * and sets the display title. This separates the two: the processor computes,
 * the caller applies. Nothing here has happened yet.
 *
 * That is safe because SMW's `#ask` reads the store as it was last saved rather
 * than the data being written by the current parse, so moving the writes to the
 * end of the render cannot change what any query returns.
 */
final class ProcessResult {

	/** Rendered wikitext for the slot. */
	public string $wikitext;

	/**
	 * SMW properties and subobjects to store, or null in modes that store
	 * nothing. Only the header pass maps semantics; the footer pass renders.
	 */
	public ?SemanticMapping $mapping;

	/** Display title to set, or null to leave the page title alone. */
	public ?string $displayTitle;

	/** @var string[] Debug lines, populated only when the page asks for them. */
	public array $debug;

	/** @param string[] $debug */
	public function __construct(
		string $wikitext = '',
		?SemanticMapping $mapping = null,
		?string $displayTitle = null,
		array $debug = []
	) {
		$this->wikitext = $wikitext;
		$this->mapping = $mapping;
		$this->displayTitle = $displayTitle;
		$this->debug = $debug;
	}
}
