<?php

namespace MediaWiki\Extension\MwJson\Template;

use Mustache_Exception;
use RuntimeException;

/**
 * Renders OSL's `eval_template` mustache templates, replacing Module:Lustache.
 *
 * Backed by mustache/mustache. The OSL schemas depend on Mustache delimiter
 * switching (`{{=<% %>=}}` ... `<%={{ }}=%>`), implicit iterators and nested
 * sections, so the engine has to be spec-complete; and, as explained below, it
 * has to allow the escaping function to be replaced, which rules out
 * zordius/lightncandy (already vendored by MediaWiki core, but it inlines
 * htmlspecialchars into the code it generates, Compiler.php:669, so escaping
 * cannot be overridden).
 *
 * Conformance against the incumbent is measured, not assumed:
 * tests/parity/compareMustache.php diffs this against the real Lustache over
 * every eval_template on the wiki.
 *
 * @see docs/library-choices.md
 * @see docs/legacy-lua/Lustache_Renderer.lua
 */
class MustacheRenderer {

	/**
	 * Lustache is a port of mustache.js and escapes `[&<>"'/]`
	 * (Lustache_Renderer.lua:300), which is the escaping this pipeline has to
	 * reproduce to keep rendered output identical.
	 *
	 * With one deliberate exception: the slash. See ESCAPE_SLASH.
	 */
	private const ESCAPE = [
		'&' => '&amp;',
		'<' => '&lt;',
		'>' => '&gt;',
		'"' => '&quot;',
		"'" => '&#39;',
	];

	/** Lustache's slash rule, kept separate because it is the disputed one. */
	private const SLASH = [ '/' => '&#x2F;' ];

	/**
	 * Whether to reproduce Lustache's escaping of "/" as "&#x2F;".
	 *
	 * Off, because reproducing it reproduces live data corruption. Quantity
	 * templates feed rendered values straight into {{#set:}}, so a unit like
	 * "1e-09 /mm³" reaches SMW as "1e-09 &#x2F;mm³" and the semicolon ending
	 * the entity splits the value in two. The wiki currently stores
	 * ["1e-09 &#x2F", "mm³"] for such properties instead of one correct value.
	 *
	 * Turning this on restores byte-identical parity with the Lua at the cost
	 * of keeping the corruption. It exists so the parity harness can run both
	 * ways and the change can be reviewed rather than discovered.
	 */
	public const ESCAPE_SLASH = false;

	private BoundedMustacheEngine $engine;

	public function __construct( bool $escapeSlash = self::ESCAPE_SLASH ) {
		$table = $escapeSlash ? self::ESCAPE + self::SLASH : self::ESCAPE;

		$this->engine = new BoundedMustacheEngine( [
			'escape' => static function ( $value ) use ( $table ) {
				return strtr( (string)$value, $table );
			},
			// Templates come from wiki-editable slots and are rendered many
			// times per request; the engine memoises parsed templates itself,
			// keyed by source, so a per-request instance is enough.
			'cache' => null,
			'strict_callables' => true,
		] );
	}

	/**
	 * @param string $template Mustache source.
	 * @param mixed $view Render input. Scalars are wrapped, since Mustache
	 *   needs a context and OSL renders bare array items against `{{.}}`.
	 * @param array<string,string> $partials Partial name => source. OSL
	 *   registers the template itself as "self" so a template can recurse.
	 * @throws MustacheCompileException when the template is malformed.
	 */
	public function render( string $template, $view, array $partials = [] ): string {
		$this->engine->setPartials( $partials );
		$this->engine->resetExpansionBudget();

		try {
			return $this->engine->render( $template, $this->normaliseView( $view ) );
		} catch ( Mustache_Exception | RuntimeException $e ) {
			// Two things land here. A malformed template: Lustache does not
			// check that a section's closing tag matches its opening one, so a
			// schema with a typo there renders as if it were well formed, while
			// a spec-compliant engine rejects it. And a template that recurses
			// without terminating, caught by BoundedMustacheEngine. Wrapping
			// both lets the caller keep the rest of the page rendering.
			throw new MustacheCompileException( $e->getMessage(), $template );
		}
	}

	/**
	 * A bare scalar is passed through as the context rather than wrapped.
	 *
	 * Item-level templates address the value as `{{.}}`, which means "the
	 * current context", so wrapping it as `[ '.' => $value ]` would make
	 * `{{.}}` resolve to the wrapper. Lustache does the same: it hands the
	 * value straight to make_context().
	 *
	 * @param mixed $view
	 * @return mixed
	 */
	private function normaliseView( $view ) {
		return $view ?? [];
	}
}
