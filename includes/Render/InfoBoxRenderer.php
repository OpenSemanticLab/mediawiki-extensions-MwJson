<?php

namespace MediaWiki\Extension\MwJson\Render;

use MediaWiki\Extension\MwJson\OOLD\JsonUtil;

/**
 * Port of p.renderInfoBox().
 *
 * Renders one schema's own properties as a table. The page processor calls it
 * once per category in the inheritance chain, so an entity shows one box per
 * class it belongs to, each listing what that class contributes.
 *
 * The opt-in alternative to TreeRenderer: reached only when jsondata sets
 * `__render_mode__` to "table", or when a category's own header template
 * already contains an info box.
 *
 * ## Row order
 *
 * The Lua iterates jsondata with pairs(), whose order is undefined, so the row
 * order of an infobox is not reproducible today. PHP preserves insertion order,
 * which means the port is deterministic where the Lua was not. That is the one
 * place the migration cannot be byte-identical, and it is an improvement rather
 * than a regression, so the parity harness compares these rows as a set.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class InfoBoxRenderer {

	/** Longer plain-text values are truncated, since a box is not an article. */
	private const MAX_PLAIN_TEXT = 100;

	private MultilangValue $multilang;
	private PropertyTypeResolver $types;
	private DateFormatter $dates;

	public function __construct(
		MultilangValue $multilang,
		PropertyTypeResolver $types,
		DateFormatter $dates
	) {
		$this->multilang = $multilang;
		$this->types = $types;
		$this->dates = $dates;
	}

	/**
	 * @param array $schema The category's own schema, deciding which rows appear.
	 * @param array $mergedSchema The whole chain flattened, read for property
	 *   definitions, since a subclass may have overridden them.
	 * @param array $context JSON-LD term map, for deciding link and date types.
	 * @param array<string,array> $propertyDefinitions From SemanticMapping.
	 * @param array $jsondata The rendered data.
	 * @param array<string,bool> $ignoreProperties Keys already shown by a more
	 *   specific box, so each property appears once, at its most derived class.
	 */
	public function render(
		array $schema,
		array $mergedSchema,
		array $context,
		array $propertyDefinitions,
		array $jsondata,
		array $ignoreProperties = []
	): string {
		if ( $schema === [] ) {
			return '';
		}

		$rows = '';
		foreach ( $jsondata as $key => $value ) {
			if ( isset( $ignoreProperties[$key] ) ) {
				continue;
			}
			// Only properties this schema declares, and only literals or lists
			// of them: a nested object has no single-cell representation.
			if ( !isset( $schema['properties'][$key] ) ) {
				continue;
			}
			if ( is_array( $value ) && !JsonUtil::hasFirstElement( $value ) ) {
				continue;
			}

			$definition = $mergedSchema['properties'][$key] ?? [];
			if ( !is_array( $definition ) ) {
				$definition = [];
			}

			$hidden = JsonUtil::defaultArgPath( $definition, [ 'options', 'hidden' ], false );
			if ( $hidden === true || $hidden === 'true' ) {
				continue;
			}

			$rows .= $this->renderRow(
				(string)$key, $value, $definition, $context, $propertyDefinitions
			);
		}

		return $this->wrap( $this->multilang->render( $schema, [], 'title', '' ), $rows );
	}

	/**
	 * @param mixed $value
	 * @param array<string,array> $propertyDefinitions
	 */
	private function renderRow(
		string $key,
		$value,
		array $definition,
		array $context,
		array $propertyDefinitions
	): string {
		$label = $this->multilang->render( $definition, [], 'title', $key )
			. $this->buildTooltip( $key, $definition, $propertyDefinitions );

		$type = $this->types->resolve( $context, $key, $definition );
		$smwProperty = JsonUtil::defaultArgPath( $propertyDefinitions, [ $key, 'property' ] );

		if ( is_array( $value ) ) {
			$cell = '';
			foreach ( $value as $item ) {
				if ( is_array( $item ) ) {
					continue;
				}
				$cell .= "\n* " . $this->formatValue( $item, $type, $definition, $smwProperty, true );
			}
		} else {
			$cell = "\n" . $this->formatValue( $value, $type, $definition, $smwProperty, false );
		}

		return '<tr><th>' . $label . '</th><td>' . $cell . '</td></tr>';
	}

	/**
	 * @param mixed $value
	 * @param bool $isListItem Whether the type lives on the items subschema.
	 */
	private function formatValue(
		$value,
		string $type,
		array $definition,
		?string $smwProperty,
		bool $isListItem
	): string {
		if ( $type === PropertyTypeResolver::ID ) {
			$declaredType = $isListItem
				? ( $definition['items']['type'] ?? 'unknown' )
				: ( $definition['type'] ?? 'unknown' );

			// Only auto-link when the schema declares a plain string and no
			// eval_template already produced markup of its own.
			if ( $declaredType === 'string' && !isset( $definition['eval_template'] ) ) {
				$linked = str_replace( 'Category:', ':Category:', (string)$value );
				// Leading colon on File: too, or the image embeds instead of
				// linking.
				$linked = str_replace( 'File:', ':File:', $linked );
				return '[[' . $linked . ']]';
			}
		}

		if ( $type === PropertyTypeResolver::DATE || $type === PropertyTypeResolver::DATE_TIME ) {
			return (string)$this->dates->format( $value, $type, $smwProperty );
		}

		if ( is_bool( $value ) ) {
			// Green check or red cross.
			return $value ? '&#x2705;' : '&#x274C;';
		}

		// Numbers reach wikitext through Lua's tostring(), not PHP's cast.
		$text = LuaNumberFormatter::format( $value );
		if (
			!isset( $definition['eval_template'] )
			&& mb_strlen( $text ) > self::MAX_PLAIN_TEXT
			&& strpos( $text, '{{' ) === false
			&& strpos( $text, '</' ) === false
			&& strpos( $text, '[[' ) === false
		) {
			return mb_substr( $text, 0, self::MAX_PLAIN_TEXT ) . '...';
		}

		return $text;
	}

	/**
	 * @param array<string,array> $propertyDefinitions
	 */
	private function buildTooltip( string $key, array $definition, array $propertyDefinitions ): string {
		$description = $this->multilang->render( $definition, [], 'description', '' );
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
	 * Serialise exactly as Scribunto's mw.html does, which is what the Lua
	 * builds the box with: tags concatenated with no whitespace between them
	 * (mw.html.lua's _build uses table.concat with no separator) and attributes
	 * in the order they were set. Any stray newline here would show up as a
	 * diff on every infobox in the parity run.
	 */
	private function wrap( string $heading, string $rows ): string {
		return '<table class="info_box">'
			. '<tr><th class="heading" colspan="2">' . $heading . '</th></tr>'
			. $rows
			. '</table>';
	}
}
