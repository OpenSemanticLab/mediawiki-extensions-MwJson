<?php

namespace MediaWiki\Extension\MwJson\OOLD;

/**
 * Port of the propertyOrder re-ranking block in p.walkJsonSchema()
 * (MwJson.lua:164-209).
 *
 * A property's `propertyOrder` is written relative to its own schema, but the
 * renderer sorts one flat merged object, so the same number means different
 * things depending on which schema in the inheritance chain declared it. This
 * rewrites every order into a single global scale before the schemas are
 * merged.
 *
 * The scale, with level 1 being the most derived schema and the highest level
 * the most basal:
 *
 *   order < 0        left alone (an explicit absolute position)
 *   order <= 1000    1000000 - level*2000 + order   (grouped above the default)
 *   order >  1000    1000000 + level*2000 + order   (grouped below the default)
 *
 * So base-class properties sort above subclass properties within the "top"
 * band and below them within the "bottom" band, and an unannotated property
 * lands on the 1000 midpoint of its own level.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class PropertyOrderRanker {

	private const DEFAULT_ORDER = 1000;
	private const SCALE_ORIGIN = 1000 * 1000;
	private const LEVEL_STRIDE = 2000;

	private SchemaKeys $keys;

	public function __construct( ?SchemaKeys $keys = null ) {
		$this->keys = $keys ?? new SchemaKeys();
	}

	/**
	 * @param string[] $visited Category keys in walk order, most basal first.
	 * @param array<string,array> $schemas Category key => schema.
	 * @return array<string,array> $schemas with rewritten propertyOrder values.
	 */
	public function rank( array $visited, array $schemas ): array {
		$seenProperties = [];
		$count = count( $visited );

		foreach ( array_values( $visited ) as $index => $category ) {
			$properties = $schemas[$category]['properties'] ?? null;
			if ( !is_array( $properties ) ) {
				continue;
			}

			// Lua: level = #visited - i + 1, with i one-based.
			$level = $count - $index;

			foreach ( $properties as $name => $definition ) {
				if ( !is_array( $definition ) ) {
					$seenProperties[$name] = true;
					continue;
				}

				$hasOrder = array_key_exists( 'propertyOrder', $definition )
					&& $definition['propertyOrder'] !== null;

				// Only default a property the chain has not already ranked. A
				// subclass that re-declares an inherited property without an
				// order deliberately gets none, so the merge leaves the
				// ancestor's ranked value in place and the property keeps its
				// inherited position.
				if ( !$hasOrder && !isset( $seenProperties[$name] ) ) {
					$definition['propertyOrder'] = self::DEFAULT_ORDER;
					$hasOrder = true;
				}

				if ( $hasOrder ) {
					// Lua's `if prop_data.propertyOrder then` is true for 0,
					// which is falsy in PHP. Hence the explicit key check
					// above rather than a truthiness test: an explicit
					// propertyOrder of 0 must still be rescaled.
					$definition['propertyOrder'] = $this->rescale(
						$definition['propertyOrder'],
						$level
					);
					$schemas[$category]['properties'][$name] = $definition;
				}

				$seenProperties[$name] = true;
			}
		}

		return $schemas;
	}

	/**
	 * @param mixed $order
	 * @return mixed
	 */
	private function rescale( $order, int $level ) {
		if ( !is_int( $order ) && !is_float( $order ) ) {
			// Not a number, so there is nothing meaningful to rescale. The Lua
			// would attempt arithmetic and raise; leaving it untouched keeps a
			// malformed schema rendering instead of killing the page.
			return $order;
		}

		if ( $order < 0 ) {
			return $order;
		}
		if ( $order <= self::DEFAULT_ORDER ) {
			return ( self::SCALE_ORIGIN - $level * self::LEVEL_STRIDE ) + $order;
		}
		return ( self::SCALE_ORIGIN + $level * self::LEVEL_STRIDE ) + $order;
	}
}
