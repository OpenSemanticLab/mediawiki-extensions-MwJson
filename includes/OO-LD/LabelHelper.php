<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Port of p.getDisplayLabel() and p.setNormalizedLabel().
 *
 * OSL stores labels as language-tagged lists, but MediaWiki's display title and
 * SMW's sort and search need one plain string, so these two functions pick it
 * and derive the normalised forms that case-insensitive and
 * punctuation-insensitive queries match against.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class LabelHelper {

	private SchemaKeys $keys;

	public function __construct( ?SchemaKeys $keys = null ) {
		$this->keys = $keys ?? new SchemaKeys();
	}

	/**
	 * Choose the string to display for an entity.
	 *
	 * Prefers the mapped SMW properties, since by the time this runs the
	 * eval_templates have already rendered them, and falls back to the raw
	 * jsondata keywords for entities whose schema maps neither.
	 *
	 * @return string|null Null when nothing suitable exists, which the caller
	 *   treats as "leave the display title alone".
	 */
	public function getDisplayLabel( array $jsondata, array $properties ): ?string {
		$label = $properties['HasLabel'][0] ?? null;
		if ( $label !== null && !is_array( $label ) ) {
			// Stored as "text@lang"; the display form is the text. Cast rather
			// than type-check, because Lua's string functions coerce numbers.
			return JsonUtil::splitString( (string)$label, '@' )[0] ?? null;
		}

		if ( array_key_exists( 'HasName', $properties ) ) {
			$name = $properties['HasName'];
			return is_array( $name ) ? ( $name[0] ?? null ) : $name;
		}

		$labelKey = $this->keys->legacy( 'label' );
		$first = $jsondata[$labelKey][0] ?? null;
		if ( $first !== null ) {
			if ( !is_array( $first ) ) {
				return JsonUtil::splitString( (string)$first, '@' )[0] ?? null;
			}
			// No eval_template has run over it, so it is still the raw
			// { text, lang } object.
			return $first[$this->keys->legacy( 'text' )] ?? null;
		}

		return $jsondata[$this->keys->legacy( 'name' )] ?? null;
	}

	/**
	 * Derive HasNormalizedLabel from whichever label property is present.
	 *
	 * The normalised form is lowercased with every non-alphanumeric character
	 * removed, keeping the language tag, so that a search for "lab note" finds
	 * "Lab-Note" and a German label is not matched against an English query.
	 *
	 * @param bool $useFallbacks Fall back to HasName and Display title of when
	 *   HasLabel is absent. The Lua exposes this and always passes true.
	 * @return array $properties with HasNormalizedLabel set, if anything applied.
	 */
	public function setNormalizedLabel( array $properties, bool $useFallbacks = true ): array {
		if ( isset( $properties['HasLabel'] ) ) {
			$normalized = [];
			foreach ( JsonUtil::tablefy( $properties['HasLabel'] ) as $label ) {
				$parts = JsonUtil::splitString( (string)$label, '@' );
				$normalized[] = $this->normalize( $parts[0] ?? '' ) . '@' . ( $parts[1] ?? 'en' );
			}
			$properties['HasNormalizedLabel'] = $normalized;
			return $properties;
		}

		if ( !$useFallbacks ) {
			return $properties;
		}

		// Neither fallback carries a language, so both assume English.
		foreach ( [ 'HasName', 'Display title of' ] as $fallback ) {
			if ( !isset( $properties[$fallback] ) ) {
				continue;
			}
			$normalized = [];
			foreach ( JsonUtil::tablefy( $properties[$fallback] ) as $label ) {
				$normalized[] = $this->normalize( (string)$label ) . '@en';
			}
			$properties['HasNormalizedLabel'] = $normalized;
			return $properties;
		}

		return $properties;
	}

	/**
	 * Lua: `label:lower():gsub('[^%w]+','')`.
	 *
	 * Byte-wise on purpose. Lua's :lower() only touches ASCII and its %w class
	 * is ASCII-only, so an accented character is left alone by the first step
	 * and then stripped by the second: "Schlusselwort" with an umlaut
	 * normalises to "schlsselwort". strtolower and an explicit [a-z0-9] class
	 * reproduce that exactly, where mb_strtolower would not: it maps some
	 * characters onto ASCII letters that Lua would have stripped.
	 */
	private function normalize( string $label ): string {
		return preg_replace( '/[^a-z0-9]+/', '', strtolower( $label ) );
	}
}
