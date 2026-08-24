<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * What SemanticPropertyMapper produces: everything that needs writing to SMW,
 * as data, with nothing written yet.
 *
 * The Lua calls mw.smw.subobject() partway through its traversal and leaves the
 * page-level mw.smw.set() to its caller. Collecting instead of writing is the
 * one structural change the port makes here, and it buys two things: the parity
 * harness can compare what *would* be stored without touching the store, and
 * the traversal becomes a pure function that unit tests can drive.
 *
 * Ordering is preserved, so SmwWriter reproduces the original sequence of
 * store calls exactly.
 */
final class SemanticMapping {

	/**
	 * Page-level SMW properties: name => list of values.
	 *
	 * @var array<string,mixed>
	 */
	public array $properties;

	/**
	 * Subobjects to store, in the order the traversal reached them.
	 *
	 * @var array<int,array{id:?string,properties:array<string,mixed>}>
	 */
	public array $subobjects;

	/**
	 * Where each jsondata key was mapped, keyed by that key. Carries the SMW
	 * property name, the subschema and the raw value, which the renderers use
	 * to label and format the value and to build query filters.
	 *
	 * @var array<string,array<string,mixed>>
	 */
	public array $definitions;

	/** The term map as it stood at the end, with nested contexts pulled up. */
	public array $context;

	/** Subobject id for this node, null at the page level. */
	public ?string $id;

	/**
	 * @param array<string,mixed> $properties
	 * @param array<int,array{id:?string,properties:array<string,mixed>}> $subobjects
	 * @param array<string,array<string,mixed>> $definitions
	 */
	public function __construct(
		array $properties = [],
		array $subobjects = [],
		array $definitions = [],
		array $context = [],
		?string $id = null
	) {
		$this->properties = $properties;
		$this->subobjects = $subobjects;
		$this->definitions = $definitions;
		$this->context = $context;
		$this->id = $id;
	}
}
