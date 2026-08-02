<?php

namespace MediaWiki\Extension\MwJson\Template;

use MediaWiki\Extension\MwJson\OOLD\JsonUtil;
use MediaWiki\Extension\MwJson\OOLD\SchemaKeys;
use MediaWiki\Extension\MwJson\Render\MultilangValue;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * Port of Module:MwJson's p.expandEmbeddedTemplates().
 *
 * Walks a page's jsondata alongside its schema and replaces each value with the
 * result of the `eval_template` its schema declares, so that by the time the
 * renderers see the data, a raw `["Category:Foo"]` has already become a
 * wikitext link. Runs twice per page with different modes: once as "store", to
 * produce the values that go to SMW, and once as "render", for display.
 *
 * @see docs/legacy-lua/MwJson.lua
 */
class EmbeddedTemplateExpander {

	private const TYPE_MUSTACHE = 'mustache';
	private const TYPE_MUSTACHE_WIKITEXT = 'mustache-wikitext';
	private const TYPE_WIKITEXT = 'wikitext';

	private MustacheRenderer $mustache;
	private WikitextPreprocessor $wikitext;
	private SchemaKeys $keys;
	private LoggerInterface $logger;
	private ?LegacyTemplateBypass $bypass;
	private ?MultilangValue $multilang;

	/**
	 * @param LegacyTemplateBypass|null $bypass Enables native rendering of the
	 *   legacy templates it recognises. Null leaves every template rendered as
	 *   written, which is the behaviour to fall back to if a schema turns up
	 *   whose template matches the shape but not the intent.
	 * @param MultilangValue|null $multilang Required for the bypass, since
	 *   resolving a language is the whole of what the bypassed template did.
	 */
	public function __construct(
		MustacheRenderer $mustache,
		WikitextPreprocessor $wikitext,
		?SchemaKeys $keys = null,
		?LoggerInterface $logger = null,
		?LegacyTemplateBypass $bypass = null,
		?MultilangValue $multilang = null
	) {
		$this->mustache = $mustache;
		$this->wikitext = $wikitext;
		$this->keys = $keys ?? new SchemaKeys();
		$this->logger = $logger ?? new NullLogger();
		$this->bypass = $multilang === null ? null : $bypass;
		$this->multilang = $multilang;
	}

	/**
	 * @param array $jsondata Page data.
	 * @param array $jsonschema Resolved schema for that data.
	 * @param string|null $mode "store" or "render"; selects between competing
	 *   eval_template declarations.
	 * @param bool $stringifyArrays Join expanded array members into one
	 *   semicolon-separated string, which is what wiki template parameters need.
	 */
	public function expand(
		array $jsondata,
		array $jsonschema,
		?string $mode = null,
		bool $stringifyArrays = false
	): array {
		$result = $this->expandNode( $jsondata, $jsonschema, [], $mode, $stringifyArrays, true );
		// The root call never substitutes a wikitext template, so this is
		// always the expanded data rather than a string.
		return is_array( $result ) ? $result : $jsondata;
	}

	/**
	 * @param array $template The template inherited from the parent property.
	 *   Empty array, never null: see selectTemplate().
	 * @return array|string The expanded data, or the rendered string when a
	 *   wikitext template replaced this node wholesale.
	 */
	private function expandNode(
		array $jsondata,
		array $jsonschema,
		array $template,
		?string $mode,
		bool $stringifyArrays,
		bool $root
	) {
		foreach ( $jsondata as $key => $value ) {
			$evalTemplate = $this->selectTemplate(
				JsonUtil::defaultArgPath( $jsonschema, [ 'properties', $key, $this->keys->legacy( 'template' ) ], [] ),
				$mode
			);

			if ( $this->isMustache( $evalTemplate ) ) {
				// The whole value goes to the template, arrays included, so a
				// template can iterate with a section.
				$rootKeyed = ( $evalTemplate['root_key'] ?? null ) !== false;
				$native = $rootKeyed
					? $this->renderNatively( $evalTemplate, (string)$key, $value )
					: null;
				$jsondata[$key] = $native
					?? $this->renderMustache( $evalTemplate, $rootKeyed ? [ $key => $value ] : $value );
				continue;
			}

			if ( !is_array( $value ) ) {
				continue;
			}

			if ( JsonUtil::isMap( $value ) ) {
				$jsondata[$key] = $this->expandNode(
					$value,
					JsonUtil::defaultArgPath( $jsonschema, [ 'properties', $key ], [] ),
					$evalTemplate,
					$mode,
					$stringifyArrays,
					false
				);
				continue;
			}

			$jsondata[$key] = $this->expandList(
				$value,
				$jsonschema,
				(string)$key,
				$mode,
				$stringifyArrays
			);
		}

		return $this->applyWikitextTemplate( $jsondata, $jsonschema, $template, $mode, $root );
	}

	/**
	 * Expand a list-valued property, whose items carry their own eval_template
	 * under `properties.<key>.items`.
	 *
	 * @return array|string A string when $stringifyArrays is set.
	 */
	private function expandList(
		array $items,
		array $jsonschema,
		string $key,
		?string $mode,
		bool $stringifyArrays
	) {
		$itemTemplate = $this->selectTemplate(
			JsonUtil::defaultArgPath(
				$jsonschema,
				[ 'properties', $key, 'items', $this->keys->legacy( 'template' ) ],
				[]
			),
			$mode
		);
		$itemSchema = JsonUtil::defaultArgPath( $jsonschema, [ 'properties', $key, 'items' ], [] );

		$joined = '';
		foreach ( $items as $index => $item ) {
			if ( is_array( $item ) ) {
				$expanded = $this->expandNode(
					$item, $itemSchema, $itemTemplate, $mode, $stringifyArrays, false
				);
				if ( is_array( $expanded ) ) {
					// Still structured, so it cannot go into a wiki template
					// parameter and is left out of the joined string. It does
					// have to be written back, though: the Lua passes the item
					// into the recursion by reference and mutates it in place,
					// which PHP's value semantics do not do for us.
					$items[$index] = $expanded;
					continue;
				}
				if ( $stringifyArrays ) {
					$joined .= $expanded . ';';
				} else {
					$items[$index] = $expanded;
				}
				continue;
			}

			if ( $this->isMustache( $itemTemplate ) ) {
				// A bare item is its own view, so the template refers to it as
				// {{.}} rather than by name.
				$item = $this->renderMustache( $itemTemplate, $item );
				$items[$index] = $item;
			}
			if ( $stringifyArrays ) {
				$joined .= $item . ';';
			}
		}

		return $stringifyArrays ? $joined : $items;
	}

	/**
	 * Replace a node with a rendered wiki template, if one applies.
	 *
	 * Only reached below the root: the top-level jsondata object is never
	 * stringified, since the caller needs it as data.
	 *
	 * @return array|string
	 */
	private function applyWikitextTemplate(
		array $jsondata,
		array $jsonschema,
		array $template,
		?string $mode,
		bool $root
	) {
		if ( $root || $template === [] ) {
			// Note the Lua also has a branch here for looking a template up on
			// the node itself when none was inherited. It is unreachable:
			// selectTemplate() returns an empty table rather than nil when a
			// property declares no eval_template, so the inherited template is
			// never nil and the lookup never runs. Reproduced by treating an
			// empty template as "nothing to apply", which has the same effect.
			return $jsondata;
		}

		if ( ( $template['type'] ?? null ) !== self::TYPE_WIKITEXT ) {
			return $jsondata;
		}

		// Wiki template parameters are strings, so a node still holding
		// structure cannot be rendered and is returned as data.
		foreach ( $jsondata as $value ) {
			if ( is_array( $value ) ) {
				return $jsondata;
			}
		}

		$args = array_map( 'strval', $jsondata );

		if ( isset( $template['value'] ) && is_string( $template['value'] ) ) {
			return $this->wikitext->preprocessWithArgs( $template['value'], $args );
		}
		if ( isset( $template['page'] ) && is_string( $template['page'] ) ) {
			return $this->wikitext->expandTemplate( $template['page'], $args );
		}

		return $jsondata;
	}

	/**
	 * Choose between competing eval_template declarations for the current mode.
	 *
	 * A declaration with a matching `mode` is taken, and so is one with no
	 * `mode` at all; later declarations win over earlier ones, so a
	 * mode-agnostic entry listed after a mode-specific one overrides it. That
	 * is the Lua's behaviour, order dependence included.
	 *
	 * Returns an empty array rather than null when nothing matches, matching
	 * the Lua, where the "ensure a list" wrap turns an absent declaration into
	 * a list holding one empty table.
	 *
	 * @param mixed $candidates
	 */
	private function selectTemplate( $candidates, ?string $mode ): array {
		if ( !is_array( $candidates ) ) {
			return [];
		}
		if ( !JsonUtil::hasFirstElement( $candidates ) ) {
			$candidates = [ $candidates ];
		}

		$selected = [];
		foreach ( $candidates as $candidate ) {
			if ( !is_array( $candidate ) ) {
				continue;
			}
			$candidateMode = $candidate[$this->keys->legacy( 'mode' )] ?? null;
			if ( $candidateMode === null || $candidateMode === $mode ) {
				$selected = $candidate;
			}
		}
		return $selected;
	}

	private function isMustache( array $template ): bool {
		if ( !isset( $template['value'] ) || !is_string( $template['value'] ) ) {
			return false;
		}
		$type = $template['type'] ?? null;
		return $type === self::TYPE_MUSTACHE || $type === self::TYPE_MUSTACHE_WIKITEXT;
	}

	/**
	 * Produce a recognised legacy template's output without running it.
	 *
	 * Only the language class is handled. The link class is recognised but not
	 * bypassed: its output is an expansion of the `Viewer/Link` wiki template,
	 * which the port does not reimplement, so producing it still costs a parser
	 * call and only the mustache render would be saved. The language class, by
	 * contrast, is a `#switch` the pipeline can answer outright, and it sits on
	 * `label` and `description`, so it runs on essentially every page.
	 *
	 * @param mixed $value
	 * @return string|null Null when the template has to be rendered as written.
	 */
	private function renderNatively( array $template, string $key, $value ): ?string {
		if ( $this->bypass === null || $this->multilang === null ) {
			return null;
		}
		if ( !is_array( $value ) || !JsonUtil::hasFirstElement( $value ) ) {
			return null;
		}

		$match = $this->bypass->match( $template, $key );
		if ( $match === null || $match['class'] !== LegacyTemplateBypass::CLASS_LANGUAGE ) {
			return null;
		}

		// The template interpolates the text, so it is escaped; and #switch trims
		// the case value it selects. Both have to happen here for the result to
		// be the same bytes.
		//
		// One known divergence: where a value repeats a language, #switch takes
		// the first case and MultilangValue takes the last. Repeated languages
		// are malformed data rather than a supported shape, and no page in the
		// corpus has one.
		$text = $this->multilang->render( [], [ $key => $value ], $key, '' );
		$rendered = $match['prefix'] . trim( $this->mustache->escape( $text ) ) . $match['suffix'];

		return $this->preprocessIfNeeded( $rendered );
	}

	/**
	 * Run the preprocessor only over text that can actually contain something
	 * for it to expand.
	 *
	 * The preprocessor handles templates and arguments (`{{`, `{{{`), the
	 * language converter (`-{`) and comments and extension tags (`<`). Text
	 * holding none of those constructs comes back unchanged, so the round-trip
	 * into the parser is pure overhead. Wiki markup like `''` or `[[` is handled
	 * later, by the parser proper, and is unaffected either way.
	 *
	 * The test is on any of `{}<>` rather than only the characters that open a
	 * construct. Being able to say "this string contains no brace and no angle
	 * bracket at all" is a much easier claim to check than "no construct starts
	 * here", and it costs nothing: the templates this is meant to catch resolve
	 * to a plain label or to the empty string.
	 *
	 * Worth guarding because most `mustache-wikitext` templates on the wiki
	 * produce exactly that: a language switch resolves to a label, a link
	 * section over an empty list produces nothing at all.
	 */
	private function preprocessIfNeeded( string $wikitext ): string {
		if ( strcspn( $wikitext, '{}<>' ) === strlen( $wikitext ) ) {
			return $wikitext;
		}
		return $this->wikitext->preprocess( $wikitext );
	}

	/**
	 * @param mixed $view
	 */
	private function renderMustache( array $template, $view ): string {
		$partials = [ 'self' => $template['value'] ]
			+ ( is_array( $template['partials'] ?? null ) ? $template['partials'] : [] );

		try {
			$rendered = $this->mustache->render( $template['value'], $view, $partials );
		} catch ( MustacheCompileException $e ) {
			// Lustache does not verify that a section's closing tag matches its
			// opening one, so schemas exist on the wiki with a typo there that
			// render as if well formed. Rather than take the page down, log and
			// emit nothing for this property, which is what the malformed
			// template produced anyway.
			$this->logger->warning( 'MwJson: eval_template failed to compile: {message}', [
				'message' => $e->getMessage(),
			] );
			return '';
		}

		if ( ( $template['type'] ?? null ) === self::TYPE_MUSTACHE_WIKITEXT ) {
			return $this->preprocessIfNeeded( $rendered );
		}
		return $rendered;
	}
}
