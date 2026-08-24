<?php

namespace MediaWiki\Extension\MwJson\Render;

use MediaWiki\Extension\MwJson\OOLD\JsonUtil;

/**
 * Ports p.renderJson(), p.renderLiteral() and p.renderArrayItemSummary().
 *
 * Renders jsondata as a wikitext bullet list, which TreeAndMenu's `#tree` then
 * turns into a collapsible tree. This is the default view of an entity; the
 * infobox is the opt-in alternative.
 *
 * Properties are ordered by the propertyOrder that SchemaWalker rescaled onto a
 * single scale, then by key name so that properties sharing an order render
 * reproducibly rather than in whatever order the data happened to arrive.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class TreeRenderer {

	/** Sorts after every rescaled propertyOrder, so unannotated keys go last. */
	private const UNORDERED = 1000000;

	private MultilangValue $multilang;
	private PropertyTypeResolver $types;
	private DateFormatter $dates;
	private LinkHelper $links;

	public function __construct(
		MultilangValue $multilang,
		PropertyTypeResolver $types,
		DateFormatter $dates,
		LinkHelper $links
	) {
		$this->multilang = $multilang;
		$this->types = $types;
		$this->dates = $dates;
		$this->links = $links;
	}

	/**
	 * @param array $jsondata Data to render.
	 * @param mixed $jsonschema Schema governing it, used for labels and order.
	 * @param array<string,array> $propertyDefinitions Per-key SMW property name
	 *   and the categories that declared it, from SemanticMapping.
	 * @param int $level Nesting depth, which becomes the bullet indent.
	 * @param bool $displayEmpty Render properties whose value is empty.
	 */
	public function render(
		array $jsondata,
		$jsonschema = null,
		array $propertyDefinitions = [],
		int $level = 0,
		bool $displayEmpty = false
	): string {
		$schema = is_array( $jsonschema ) ? $jsonschema : null;
		$result = '';

		if ( $level === 0 ) {
			// Every linkable value on the page in one go, before any of them is
			// resolved. Without this the resolver pays a title lookup per link,
			// and the heaviest page in the corpus carries 1848 of them.
			$this->links->prefetch( $this->collectScalars( $jsondata ) );
		}

		foreach ( $this->sortKeys( $jsondata, $schema ) as $key ) {
			$value = $jsondata[$key];
			$propertySchema = $schema['properties'][$key] ?? null;

			if ( JsonUtil::defaultArgPath( $propertySchema, [ 'options', 'hidden' ], false ) === true ) {
				continue;
			}
			if ( !$displayEmpty && $this->isEmpty( $value ) ) {
				continue;
			}

			$result .= $this->renderValue(
				(string)$key, $value, $propertySchema, $propertyDefinitions, $level, $displayEmpty
			);
		}

		return $result;
	}

	/**
	 * @param mixed $value
	 * @param mixed $propertySchema
	 * @param array<string,array> $propertyDefinitions
	 */
	private function renderValue(
		string $key,
		$value,
		$propertySchema,
		array $propertyDefinitions,
		int $level,
		bool $displayEmpty
	): string {
		if ( !is_array( $value ) ) {
			return $this->renderLiteral( $key, $value, $propertySchema, $propertyDefinitions, $level );
		}

		if ( JsonUtil::hasFirstElement( $value ) || $value === [] ) {
			return $this->renderList(
				$key, $value, $propertySchema, $propertyDefinitions, $level, $displayEmpty
			);
		}

		// A single object. Quantities collapse to "5 m" rather than expanding
		// into a value/unit subtree.
		if ( $this->isQuantity( $value, $propertySchema ) ) {
			return $this->renderLiteral(
				$key, $this->formatQuantity( $value ), $propertySchema, $propertyDefinitions, $level
			);
		}

		return $this->renderLiteral( $key, '', $propertySchema, $propertyDefinitions, $level )
			// Definitions are deliberately not passed down. p.renderJson()
			// omits property_definitions from its recursive calls, so a nested
			// property never gets a "Definition:" tooltip even when its name
			// matches a top-level one that has definitions recorded. Passing
			// them down would add tooltips the Lua does not render.
			. $this->render( $value, $propertySchema, [], $level + 1, $displayEmpty );
	}

	/**
	 * @param array $value
	 * @param mixed $propertySchema
	 * @param array<string,array> $propertyDefinitions
	 */
	private function renderList(
		string $key,
		array $value,
		$propertySchema,
		array $propertyDefinitions,
		int $level,
		bool $displayEmpty
	): string {
		$first = $value[0] ?? null;
		if ( $value === [] || !is_array( $first ) ) {
			// Empty, or a list of plain values, which renders as one entry.
			return $this->renderLiteral( $key, $value, $propertySchema, $propertyDefinitions, $level );
		}

		$itemSchema = is_array( $propertySchema ) ? ( $propertySchema['items'] ?? null ) : null;

		// One header for the property, then the items beneath it.
		$result = $this->renderLiteral( $key, '', $propertySchema, $propertyDefinitions, $level );

		foreach ( $value as $index => $item ) {
			if ( $this->isQuantity( $item, null ) ) {
				$result .= $this->renderLiteral(
					$key, $this->formatQuantity( $item ), $itemSchema, $propertyDefinitions, $level + 1
				);
				continue;
			}

			// Item headings are numbered from 1: they are labels for a reader,
			// not indices into the array.
			$result .= $this->renderLiteral(
				(string)( $index + 1 ),
				$this->summariseItem( $item ),
				$itemSchema,
				$propertyDefinitions,
				$level + 1
			);
			// As above: nested levels get no definitions.
			$result .= $this->render( $item, $itemSchema, [], $level + 2, $displayEmpty );
		}

		return $result;
	}

	/**
	 * One bullet: a bold label, an optional tooltip saying where the property
	 * was declared, and the value.
	 *
	 * @param mixed $value
	 * @param mixed $schema
	 * @param array<string,array> $propertyDefinitions
	 */
	private function renderLiteral(
		string $key,
		$value,
		$schema,
		array $propertyDefinitions,
		int $level
	): string {
		$schemaArray = is_array( $schema ) ? $schema : [];
		$prefix = str_repeat( '*', $level + 1 );

		$label = "'''" . $this->multilang->render( $schemaArray, [], 'title', $key ) . "'''"
			. $this->buildTooltip( $key, $schemaArray, $propertyDefinitions );

		$type = $this->types->resolve( null, null, $schema );
		$smwProperty = JsonUtil::defaultArgPath( $propertyDefinitions, [ $key, 'property' ] );

		$values = $this->expandSemicolonList( $value );
		if ( $values === null ) {
			$values = is_array( $value ) && JsonUtil::hasFirstElement( $value )
				? JsonUtil::listPart( $value )
				: null;
		}

		if ( $values === null ) {
			return $prefix . ' ' . $label . ': '
				. $this->stringify( $value, $type, $smwProperty ) . "\n";
		}

		if ( count( $values ) === 1 ) {
			return $prefix . ' ' . $label . ': '
				. $this->stringify( $values[0], $type, $smwProperty ) . "\n";
		}

		$result = $prefix . ' ' . $label . ":\n";
		$nested = str_repeat( '*', $level + 2 );
		foreach ( $values as $item ) {
			$result .= $nested . ' ' . $this->stringify( $item, $type, $smwProperty ) . "\n";
		}
		return $result;
	}

	/**
	 * A tooltip carrying the property description and the categories that
	 * declared it, so a reader can see where a field comes from.
	 *
	 * @param array<string,array> $propertyDefinitions
	 */
	private function buildTooltip( string $key, array $schema, array $propertyDefinitions ): string {
		$description = $this->multilang->render( $schema, [], 'description', '' );
		$declaredIn = JsonUtil::defaultArgPath( $propertyDefinitions, [ $key, 'defined_in' ], [] );

		if ( is_array( $declaredIn ) && $declaredIn !== [] ) {
			$description .= '<br>Definition: ';
			$first = true;
			foreach ( $declaredIn as $category ) {
				if ( !$first ) {
					$description .= ', ';
				}
				$description .= '[[:' . $category . ']]';
				$first = false;
			}
		}

		return $description === '' ? '' : '{{#info: ' . $description . '|note }}';
	}

	/**
	 * A single string holding semicolon-separated namespaced titles renders as
	 * a list rather than as one run-on value. Only split when *every* part
	 * looks like a title, so ordinary prose containing a semicolon is safe.
	 *
	 * @param mixed $value
	 * @return array<int,string>|null Null when the value is not such a list.
	 */
	private function expandSemicolonList( $value ): ?array {
		if ( !is_string( $value ) || strpos( $value, ';' ) === false ) {
			return null;
		}

		$cleaned = [];
		foreach ( JsonUtil::splitString( $value, ';' ) as $part ) {
			$part = trim( $part );
			if ( $part === '' ) {
				continue;
			}
			if ( !preg_match( '/^[a-zA-Z]+:.+$/', $part ) ) {
				return null;
			}
			$cleaned[] = $part;
		}

		return $cleaned === [] ? null : $cleaned;
	}

	/**
	 * @param mixed $value
	 */
	private function stringify( $value, string $type, ?string $smwProperty ): string {
		if ( is_bool( $value ) ) {
			return $value ? 'true' : 'false';
		}
		if ( $value === null ) {
			return 'nil';
		}
		if ( is_string( $value ) ) {
			if ( $type === PropertyTypeResolver::DATE || $type === PropertyTypeResolver::DATE_TIME ) {
				return (string)$this->dates->format( $value, $type, $smwProperty );
			}
			return (string)$this->links->wrapLinkIfNamespaced( $value );
		}
		return $this->numberToString( $value );
	}

	/**
	 * @param mixed $value
	 */
	private function numberToString( $value ): string {
		return LuaNumberFormatter::format( $value );
	}

	/**
	 * Exposed for the Lua differential test, which exercises
	 * p.renderArrayItemSummary directly.
	 *
	 * @param mixed $item
	 */
	public function renderArrayItemSummaryForTesting( $item ): string {
		return $this->summariseItem( $item );
	}

	/**
	 * A heading for one item of an object list: its label or name, and its
	 * characteristic or type in brackets.
	 *
	 * @param mixed $item
	 */
	private function summariseItem( $item ): string {
		if ( !is_array( $item ) ) {
			return '';
		}

		$display = '';
		// Only a plain string: a label that is still a multilang list has not
		// been through its eval_template and is not displayable as-is.
		if ( isset( $item['label'] ) && is_string( $item['label'] ) ) {
			$display = $item['label'];
		}
		if ( $display === '' && isset( $item['name'] ) ) {
			$display = $this->numberToString( $item['name'] );
		}

		$typeInfo = '';
		if ( isset( $item['characteristic'] ) && is_string( $item['characteristic'] ) ) {
			$typeInfo = (string)$this->links->wrapLinkIfNamespaced( $item['characteristic'] );
		} elseif ( isset( $item['type'] ) && is_string( $item['type'] ) ) {
			$typeInfo = (string)$this->links->wrapLinkIfNamespaced( $item['type'] );
		}

		return $typeInfo === '' ? $display : $display . ' (' . $typeInfo . ')';
	}

	/**
	 * Recognise a quantity, either from the data carrying a number and an
	 * optional unit, or from the schema declaring that shape.
	 *
	 * @param mixed $value
	 * @param mixed $schema
	 */
	private function isQuantity( $value, $schema ): bool {
		if ( !is_array( $value ) ) {
			return false;
		}

		$number = $value['numerical_value'] ?? $value['value'] ?? $value['amount'] ?? null;
		$unit = $value['unit'] ?? null;
		if ( $number !== null && ( is_string( $unit ) || $unit === null ) ) {
			return true;
		}

		$properties = is_array( $schema ) ? ( $schema['properties'] ?? null ) : null;
		if ( !is_array( $properties ) ) {
			return false;
		}

		$hasNumber = isset( $properties['numerical_value'] )
			|| isset( $properties['value'] )
			|| isset( $properties['amount'] );

		return $hasNumber && isset( $properties['unit'] );
	}

	/**
	 * @param mixed $value
	 * @return string|null
	 */
	private function formatQuantity( $value ): ?string {
		$number = $value['numerical_value'] ?? $value['value'] ?? $value['amount'] ?? null;
		if ( $number === null ) {
			return null;
		}

		$unit = $value['unit'] ?? null;
		$unitText = $unit !== null ? (string)$this->links->wrapLinkIfNamespaced( $unit ) : '';

		return $unitText === ''
			? $this->numberToString( $number )
			: $this->numberToString( $number ) . ' ' . $unitText;
	}

	/**
	 * By rescaled propertyOrder, then by key name.
	 *
	 * The tie-break on the name is what makes the tree reproducible: without it
	 * properties sharing an order would render in whatever order the JSON
	 * decoder produced.
	 *
	 * @return array<int,string|int>
	 */
	private function sortKeys( array $jsondata, ?array $schema ): array {
		$keys = array_keys( $jsondata );

		usort( $keys, function ( $a, $b ) use ( $schema ) {
			$orderA = $this->propertyOrder( (string)$a, $schema );
			$orderB = $this->propertyOrder( (string)$b, $schema );
			if ( $orderA === $orderB ) {
				// strcmp, not <: PHP compares numeric strings numerically, so
				// "10" < "9" would come out backwards against Lua's bytewise
				// comparison.
				return strcmp( (string)$a, (string)$b );
			}
			return $orderA <=> $orderB;
		} );

		return $keys;
	}

	/**
	 * @return int|float
	 */
	private function propertyOrder( string $key, ?array $schema ) {
		$order = $schema['properties'][$key]['propertyOrder'] ?? null;
		// Lua's truthiness test lets 0 through, and so must this: an explicit
		// propertyOrder of 0 is a real position, not an absent one.
		return is_int( $order ) || is_float( $order ) ? $order : self::UNORDERED;
	}

	/**
	 * Every scalar anywhere in the data, so the caller can decide which are
	 * linkable. Deliberately not filtered here: knowing what counts as a title
	 * is LinkHelper's business, not the tree's.
	 *
	 * @param mixed $value
	 * @return array<int,mixed>
	 */
	private function collectScalars( $value ): array {
		if ( !is_array( $value ) ) {
			return [ $value ];
		}

		$found = [];
		foreach ( $value as $item ) {
			foreach ( $this->collectScalars( $item ) as $scalar ) {
				$found[] = $scalar;
			}
		}
		return $found;
	}

	/**
	 * @param mixed $value
	 */
	private function isEmpty( $value ): bool {
		return $value === null
			|| ( is_string( $value ) && trim( $value ) === '' )
			|| ( is_array( $value ) && $value === [] );
	}
}
