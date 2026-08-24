<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Port of p.processStatement().
 *
 * OSL models arbitrary relations as statement subobjects carrying HasSubject,
 * HasProperty and HasObject. Querying through a subobject needs a subquery, so
 * for statements about the page itself this also writes the relation directly
 * onto the page: a statement `<this page> HasPart <Item:X>` additionally sets
 * `HasPart = Item:X` on the page, and `[[HasPart::Item:X]]` finds it.
 *
 * Only statements with an implicit subject are shortcut. A statement whose
 * HasSubject names something else is a claim about that other thing, so writing
 * it onto this page would assert something false.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class StatementMapper {

	/**
	 * @param array<string,mixed> $subject Properties of the containing page.
	 * @param array<string,mixed> $statement Properties of the statement subobject.
	 * @return array<string,mixed> $subject, with the shortcut added if one applied.
	 */
	public function apply( array $subject, array $statement ): array {
		$explicitSubject = $statement['HasSubject'][0] ?? null;
		if ( $explicitSubject !== null && $explicitSubject !== '' ) {
			return $subject;
		}

		$property = $statement['HasProperty'][0] ?? null;
		if ( !is_string( $property ) || $property === '' ) {
			return $subject;
		}
		if ( !isset( $statement['HasObject'] ) || !is_array( $statement['HasObject'] ) ) {
			return $subject;
		}

		// Unanchored, matching the Lua's global gsub, so a prefixed property
		// such as "Property:schema:url" loses the namespace wherever it occurs.
		$name = str_replace( SchemaKeys::PROPERTY_NS_PREFIX . ':', '', $property );

		$subject[$name] ??= [];
		foreach ( $statement['HasObject'] as $object ) {
			$subject[$name][] = $object;
		}

		return $subject;
	}
}
