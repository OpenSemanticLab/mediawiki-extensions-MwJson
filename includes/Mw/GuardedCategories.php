<?php

namespace MediaWiki\Extension\MwJson\Mw;

use MediaWiki\Extension\MwJson\OOLD\CategoryExtractor;
use MediaWiki\Extension\MwJson\OOLD\JsonLoader;
use MediaWiki\Extension\MwJson\OOLD\Slots;

/**
 * Which rights a page needs because of the classes it belongs to.
 *
 * $wgMwJsonCategoryEditRights maps a category to the right required to create,
 * edit, delete or move an instance of it. A page is covered when its class
 * chain reaches a guarded category, which is what stops the obvious bypass:
 * declaring a subclass of the guarded category and instantiating that instead.
 *
 * A page relates to a class in two ways, and both are roots of the same walk:
 *
 * - **instance of**, from jsondata `type`. `Item:X` typed `Category:Laptop`,
 *   with Laptop a subclass of Device, is covered by a rule on Device.
 * - **subclass of**, from jsondata `subclass_of`. `Category:Laptop` declaring
 *   Device as its superclass is covered too, so defining what a Device is
 *   takes the same right as creating one.
 *
 * Neither root is redundant. Without the first, the guard is bypassed by
 * subclassing. Without the second, a subcategory slips through, because its own
 * `type` is `Category:Category` and never reaches Device on the instance path.
 *
 * The answer is computed from decoded jsondata rather than from a title,
 * because the decisive check runs at save time, when the incoming content is
 * the only place the new class is stated. A page being created has no stored
 * type at all.
 */
class GuardedCategories {

	/** Depth limit for the ancestor walk. Real chains are two to four deep. */
	private const MAX_DEPTH = 32;

	/** @var array<string,string> Normalised category title => required right. */
	private array $map;

	private JsonLoader $loader;
	private CategoryExtractor $categories;

	/** @var array<string,string[]> Memo of category => rights on its chain. */
	private array $memo = [];

	/**
	 * @param array<string,string> $map Category page title => right.
	 * @param JsonLoader $loader Reads the jsonschema slot of each ancestor.
	 */
	public function __construct(
		array $map,
		JsonLoader $loader,
		?CategoryExtractor $categories = null
	) {
		$this->map = [];
		foreach ( $map as $category => $right ) {
			$this->map[self::normalise( $category )] = $right;
		}
		$this->loader = $loader;
		$this->categories = $categories ?? new CategoryExtractor();
	}

	/**
	 * True when no rule is configured, which is the shipped default.
	 *
	 * Callers check this before anything else. getUserPermissionsErrors runs on
	 * every read of every title, so the feature has to cost one array check
	 * until someone turns it on.
	 */
	public function isEmpty(): bool {
		return $this->map === [];
	}

	/**
	 * Rights required by the classes this data declares.
	 *
	 * @param array $jsondata A decoded jsondata slot.
	 * @return string[] Deduplicated, in the order the chains were walked. All
	 *   of them are required, not any one: two guarded ancestors naming
	 *   different rights means both.
	 */
	public function rightsForData( array $jsondata ): array {
		if ( $this->isEmpty() ) {
			return [];
		}

		$rights = [];
		foreach ( [ 'type', 'subclass_of' ] as $key ) {
			foreach ( self::stringList( $jsondata[$key] ?? null ) as $category ) {
				foreach ( $this->rightsForCategory( $category ) as $right ) {
					$rights[$right] = true;
				}
			}
		}

		return array_keys( $rights );
	}

	/**
	 * Rights required to instantiate or subclass this category.
	 *
	 * One walk serves both: instantiating `Category:Laptop` and subclassing it
	 * reach the same ancestors, so the two questions have the same answer. The
	 * distinction only decides which field supplies the roots when the caller
	 * has data rather than a category.
	 *
	 * @return string[]
	 */
	public function rightsForCategory( string $category ): array {
		if ( $this->isEmpty() ) {
			return [];
		}

		$category = self::normalise( $category );
		if ( isset( $this->memo[$category] ) ) {
			return $this->memo[$category];
		}

		// Reserve the memo slot before walking, so a cycle in the chain sees an
		// answer rather than recursing.
		$this->memo[$category] = [];

		$rights = [];
		if ( isset( $this->map[$category] ) ) {
			$rights[$this->map[$category]] = true;
		}

		foreach ( $this->ancestors( $category ) as $ancestor ) {
			if ( isset( $this->map[$ancestor] ) ) {
				$rights[$this->map[$ancestor]] = true;
			}
		}

		$this->memo[$category] = array_keys( $rights );
		return $this->memo[$category];
	}

	/**
	 * Every category above this one, breadth first.
	 *
	 * Reads the superclass chain the way SchemaWalker does, out of the
	 * jsonschema slot's `allOf` refs via CategoryExtractor, so the guard and the
	 * resolver agree on what inheritance means. Reading `subclass_of` from
	 * jsondata instead would be a second definition of the same relation.
	 *
	 * @return string[]
	 */
	private function ancestors( string $category ): array {
		$seen = [ $category => true ];
		$queue = [ $category ];
		$found = [];

		for ( $depth = 0; $depth < self::MAX_DEPTH && $queue !== []; $depth++ ) {
			$next = [];
			foreach ( $queue as $current ) {
				$schema = $this->loader->load( $current, Slots::JSONSCHEMA );
				foreach ( $this->categories->extract( $schema, true ) as $parent ) {
					$parent = self::normalise( $parent );
					if ( isset( $seen[$parent] ) ) {
						continue;
					}
					$seen[$parent] = true;
					$found[] = $parent;
					$next[] = $parent;
				}
			}
			$queue = $next;
		}

		return $found;
	}

	/**
	 * @param mixed $value
	 * @return string[]
	 */
	private static function stringList( $value ): array {
		if ( is_string( $value ) ) {
			return [ $value ];
		}
		if ( !is_array( $value ) ) {
			return [];
		}
		return array_values( array_filter( $value, 'is_string' ) );
	}

	/**
	 * Titles reach us from three places with three spellings: the config file,
	 * a jsondata slot, and a url. Underscores and stray whitespace are the only
	 * differences that matter here, since the rest of the title is an OSW id.
	 */
	private static function normalise( string $title ): string {
		return trim( str_replace( '_', ' ', $title ) );
	}
}
