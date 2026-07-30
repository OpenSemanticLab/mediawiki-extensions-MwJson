<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Port of Module:MwJson's p.getSemanticProperties().
 *
 * Maps a page's jsondata onto SMW properties by looking each key up in the
 * JSON-LD `@context`. A key mapped to `Property:HasLabel` becomes an SMW
 * property; a key mapped to an external IRI is ignored, because there is
 * nothing local to store it against. Nested objects become SMW subobjects,
 * identified by their uuid so they survive re-saves.
 *
 * Unlike the Lua this writes nothing: subobjects are collected into the
 * returned SemanticMapping and SmwWriter applies them, in order. See
 * SemanticMapping for why.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class SemanticPropertyMapper {

	/** Marks a subobject's own categories, consumed by SmwWriter. */
	private const CATEGORY_KEY = '@category';

	private SchemaKeys $keys;
	private MergeStrategy $merge;
	private ContextBuilder $contextBuilder;
	private QuantityValueMapper $quantities;
	private StatementMapper $statements;
	private LabelHelper $labels;

	public function __construct(
		?SchemaKeys $keys = null,
		?MergeStrategy $merge = null,
		?ContextBuilder $contextBuilder = null,
		?QuantityValueMapper $quantities = null,
		?StatementMapper $statements = null,
		?LabelHelper $labels = null
	) {
		$this->keys = $keys ?? new SchemaKeys();
		$this->merge = $merge ?? new LegacyLuaMergeStrategy();
		$this->contextBuilder = $contextBuilder ?? new ContextBuilder( $this->keys, $this->merge );
		$this->quantities = $quantities ?? new QuantityValueMapper( $this->keys );
		$this->statements = $statements ?? new StatementMapper();
		$this->labels = $labels ?? new LabelHelper( $this->keys );
	}

	/**
	 * @param string $subjectTitle Prefixed title of the page being mapped;
	 *   becomes HasOswId and the subject of reverse properties.
	 */
	public function map( array $jsondata, array $schema, string $subjectTitle ): SemanticMapping {
		$subobjects = [];
		$context = $this->contextBuilder->build( $schema );

		$mapping = $this->walk(
			$jsondata, $schema, $schema, $context, [], $subjectTitle, true, $subobjects
		);

		$mapping->subobjects = $subobjects;
		return $mapping;
	}

	/**
	 * @param array $subschema The schema node governing $jsondata, which is the
	 *   whole schema at the page level and a property's subschema below it.
	 * @param array<string,mixed> $properties Seeded with reverse properties when
	 *   descending into a subobject.
	 * @param array<int,array{id:?string,properties:array}> &$subobjects
	 */
	private function walk(
		array $jsondata,
		array $schema,
		array $subschema,
		array $context,
		array $properties,
		string $subjectTitle,
		bool $root,
		array &$subobjects
	): SemanticMapping {
		$subjectId = $subjectTitle;
		$subobjectId = null;
		if ( !$root && isset( $jsondata['uuid'] ) ) {
			// A stable id derived from the uuid, so re-saving a page updates a
			// subobject rather than orphaning it.
			$subobjectId = 'OSW' . str_replace( '-', '', (string)$jsondata['uuid'] );
			$subjectId .= '#' . $subobjectId;
		}

		$definitions = [];
		$schemaProperties = $subschema['properties']
			?? JsonUtil::defaultArgPath( $subschema, [ 'items', 'properties' ], [] );
		if ( !is_array( $schemaProperties ) ) {
			$schemaProperties = [];
		}

		foreach ( $jsondata as $key => $value ) {
			$targets = $this->resolveTargets( $context, (string)$key );

			$propertyNames = [];
			$reverseProperties = [];
			$mappingFound = false;

			foreach ( $targets as $target ) {
				// Only wiki-local properties are stored. A term mapped to an
				// external IRI is still valid JSON-LD, it just has no SMW
				// property behind it.
				if ( ( JsonUtil::splitString( $target['id'], ':' )[0] ?? null ) !== SchemaKeys::PROPERTY_NS_PREFIX ) {
					continue;
				}
				$mappingFound = true;
				$name = str_replace( SchemaKeys::PROPERTY_NS_PREFIX . ':', '', $target['id'] );

				if ( $target['reverse'] ) {
					// Stored on the far end: the subobject points back at us.
					$reverseProperties[$name] ??= [];
					$reverseProperties[$name][] = $subjectId;
				} else {
					$propertyNames[] = $name;
				}

				$schemaProperty = $schemaProperties[$key] ?? [];
				$definitions[$key] = [
					'schema_type' => is_array( $schemaProperty ) ? ( $schemaProperty['type'] ?? null ) : null,
					'schema_data' => $schemaProperty,
					'property' => $name,
					'value' => $value,
					'reverse' => $target['reverse'],
				];
			}

			foreach ( $propertyNames as $name ) {
				$properties[$name] ??= [];
			}

			if ( !is_array( $value ) ) {
				if ( $mappingFound ) {
					foreach ( $propertyNames as $name ) {
						$properties[$name][] = $value;
					}
				}
				continue;
			}

			if ( $mappingFound ) {
				// A nested context declared under this term applies from here
				// down. The Lua pulls it up into the shared context rather than
				// scoping it, so it stays in force for the rest of the walk.
				$context = $this->merge->merge(
					$context,
					JsonUtil::defaultArgPath( $context, [ $key, $this->keys->legacy( 'context' ) ], [] )
				);

				$values = $this->descend(
					$value,
					$schema,
					$schemaProperties[$key] ?? [],
					$context,
					$reverseProperties,
					$subjectTitle,
					$properties,
					$subobjects
				);

				foreach ( $propertyNames as $name ) {
					foreach ( $values as $item ) {
						$properties[$name][] = $item;
					}
				}
			}

			// The quantity mapper writes its working back into the value
			// object, and the Lua's reference semantics propagate that into
			// jsondata and into the definitions. Written back explicitly here,
			// since PHP arrays do not alias.
			[ $properties, $value ] = $this->applyQuantities(
				$properties, $value, $schemaProperties[$key] ?? []
			);
			$jsondata[$key] = $value;
			if ( isset( $definitions[$key] ) ) {
				$definitions[$key]['value'] = $value;
			}
		}

		if ( !$root ) {
			$properties = $this->finaliseSubobject( $properties, $jsondata, $subschema );
			$properties['HasOswId'] = $subjectId;
			if ( $properties !== [] ) {
				$subobjects[] = [ 'id' => $subobjectId, 'properties' => $properties ];
			}
		}

		return new SemanticMapping( $properties, [], $definitions, $context, $subobjectId );
	}

	/**
	 * Recurse into an object or list value, returning the subobject references
	 * to record against the parent property.
	 *
	 * @param array<string,mixed> $reverseProperties
	 * @param array<string,mixed> &$properties Statement shortcuts are folded in here.
	 * @param array<int,array{id:?string,properties:array}> &$subobjects
	 * @return array<int,string>
	 */
	private function descend(
		array $value,
		array $schema,
		$subschema,
		array $context,
		array $reverseProperties,
		string $subjectTitle,
		array &$properties,
		array &$subobjects
	): array {
		if ( !is_array( $subschema ) ) {
			$subschema = [];
		}

		if ( JsonUtil::isMap( $value ) ) {
			return $this->descendInto(
				$value, $schema, $subschema, $context, $reverseProperties,
				$subjectTitle, $properties, $subobjects
			);
		}

		$values = [];
		foreach ( $value as $item ) {
			if ( !is_array( $item ) ) {
				// A list of plain strings maps straight through. The Lua
				// assigns the whole list here rather than appending, so a mixed
				// list of objects and strings keeps only the strings.
				$values = array_values( $value );
				continue;
			}
			foreach ( $this->descendInto(
				$item, $schema, $subschema, $context, $reverseProperties,
				$subjectTitle, $properties, $subobjects
			) as $reference ) {
				$values[] = $reference;
			}
		}
		return $values;
	}

	/**
	 * @param array<string,mixed> &$properties
	 * @param array<int,array{id:?string,properties:array}> &$subobjects
	 * @return array<int,string>
	 */
	private function descendInto(
		array $node,
		array $schema,
		array $subschema,
		array $context,
		array $reverseProperties,
		string $subjectTitle,
		array &$properties,
		array &$subobjects
	): array {
		$child = $this->walk(
			$node, $schema, $subschema, $context, $reverseProperties,
			$subjectTitle, false, $subobjects
		);

		// A statement subobject additionally writes its predicate straight onto
		// the parent, so the graph can be queried without a subquery.
		$properties = $this->statements->apply( $properties, $child->properties );

		return $child->id === null ? [] : [ $subjectTitle . '#' . $child->id ];
	}

	/**
	 * Category and display-title handling that applies to subobjects only; the
	 * page level equivalent lives in the page processor.
	 *
	 * @param array<string,mixed> $properties
	 * @return array<string,mixed>
	 */
	private function finaliseSubobject( array $properties, array $jsondata, array $subschema ): array {
		$categories = [];
		$categories = $this->merge->merge( $categories, $jsondata[$this->keys->legacy( 'category' )] ?? null );
		$categories = $this->merge->merge( $categories, $properties[SchemaKeys::CATEGORY_PSEUDO_PROPERTY] ?? null );
		$properties[self::CATEGORY_KEY] = $categories;
		unset( $properties[SchemaKeys::CATEGORY_PSEUDO_PROPERTY] );

		if ( !isset( $properties['Display title of'] ) && !isset( $properties['Display_title_of'] ) ) {
			$label = $this->labels->getDisplayLabel( $jsondata, $properties );
			$properties['Display title of'] = ( $label !== null && $label !== '' )
				? $label
				// Falling back to the schema's own title names the subobject
				// after its type when the data carries no label of its own.
				: ( $subschema['title'] ?? '' );
		}

		return $this->labels->setNormalizedLabel( $properties );
	}

	/**
	 * @param array<string,mixed> $properties
	 * @param mixed $value
	 * @param mixed $subschema
	 * @return array{0:array<string,mixed>,1:mixed}
	 */
	private function applyQuantities( array $properties, $value, $subschema ): array {
		if ( !is_array( $value ) ) {
			return [ $properties, $value ];
		}
		if ( JsonUtil::isMap( $value ) ) {
			return $this->quantities->apply( $properties, $value, $subschema );
		}
		foreach ( $value as $index => $item ) {
			if ( is_array( $item ) ) {
				[ $properties, $value[$index] ] = $this->quantities->apply( $properties, $item, $subschema );
			}
		}
		return [ $properties, $value ];
	}

	/**
	 * Find every context term that maps $key, following OO-LD's inline
	 * multi-mapping shorthand: a term written `label*` or `label**` maps the
	 * key `label`, so one key can reach several properties.
	 *
	 * @return array<int,array{id:string,reverse:bool}>
	 */
	private function resolveTargets( array $context, string $key ): array {
		$targets = [];

		foreach ( $context as $term => $definition ) {
			if ( ( JsonUtil::splitString( (string)$term, '*' )[0] ?? null ) !== $key ) {
				continue;
			}

			if ( !is_array( $definition ) ) {
				if ( is_string( $definition ) ) {
					// Null rather than false: the Lua builds this target as
					// `{id=def}` with no reverse member at all, where the
					// expanded forms below set it explicitly. The distinction
					// survives into the returned definitions, so it is kept.
					$targets[] = [ 'id' => $definition, 'reverse' => null ];
				}
				continue;
			}

			// JSON-LD allows @id or @reverse but not both; the Lua reads each
			// independently, so a term carrying both yields two targets.
			if ( isset( $definition['@id'] ) && is_string( $definition['@id'] ) ) {
				$targets[] = [ 'id' => $definition['@id'], 'reverse' => false ];
			}
			if ( isset( $definition['@reverse'] ) && is_string( $definition['@reverse'] ) ) {
				$targets[] = [ 'id' => $definition['@reverse'], 'reverse' => true ];
			}
		}

		return $targets;
	}
}
