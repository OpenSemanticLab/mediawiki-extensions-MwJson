<?php

namespace MediaWiki\Extension\MwJson\Template;

/**
 * Recognises `eval_template`s that exist only because Scribunto could not do
 * the job, and that the PHP pipeline can therefore do natively.
 *
 * ## Why the port absorbs these rather than the schemas dropping them
 *
 * Schemas ship to many OSL instances through page packages. A schema that
 * deleted its language-switching template would render raw `{text, lang}`
 * objects on every instance still running `Module:MwJson`, which is most of
 * them for as long as the rollout takes. So the schemas cannot move first.
 *
 * The port moves instead: it recognises the legacy shapes and ignores them,
 * rendering the underlying value directly. That gives four combinations, three
 * of which have to keep working:
 *
 *   old schema + Lua   unchanged, the template renders as it always has
 *   old schema + PHP   template ignored, value rendered natively, same output
 *   new schema + PHP   nothing to ignore, value rendered natively
 *   new schema + Lua   broken, which is why schemas migrate last
 *
 * Only once every instance is on the port can the templates come out of the
 * schemas, and at that point this class can go too.
 *
 * ## What this is not
 *
 * It is not a performance measure. Skipping the templates was expected to be
 * one, and it is not: alternating runs over 250 pages put it at 1 to 2 per
 * cent, which is less than the drift between consecutive runs. The compiled
 * template cache had already taken the cost it was aimed at. What it does buy
 * is correctness, since the `#switch` wrapper mangles any value containing
 * `}}`, and a migration path, since a schema cannot drop a template until every
 * instance can render without it.
 *
 * Recognising a template is not the same as replacing it. Of the two classes
 * here only the language one is currently rendered natively; see
 * EmbeddedTemplateExpander::renderNatively() for why the link one is recognised
 * but still run. The link class stays because it marks what a schema may drop
 * once every instance is on the port, which is what makes this report-driven
 * rather than guesswork.
 *
 * ## On matching
 *
 * Recognition has to be conservative. Ignoring a template that is *not* a plain
 * language switch or link would silently drop whatever else it was doing, and
 * the parity harness only catches that if a page happens to exercise it. So
 * each pattern is anchored to the whole template rather than searched for, and
 * anything carrying an `#ask`, `#set` or another template call is refused
 * outright even if it also matches.
 */
class LegacyTemplateBypass {

	/** A multilang value flattened for the reader's language. */
	public const CLASS_LANGUAGE = 'language';

	/**
	 * A reference rendered as a link to a wiki page.
	 *
	 * Recognised but not replaced here. `Module:Viewer/Link` runs an SMW query
	 * per link to find the target's label in the reader's language, so standing
	 * in for it means reproducing that query and its fallback chain.
	 */
	public const CLASS_LINK = 'link';

	/**
	 * A list of URLs rendered as external links.
	 *
	 * The same wiki template, but its url branch, which takes no query and no
	 * label lookup: `Module:Viewer/Link` defaults the label to the URL itself
	 * and emits `[url url]`. That is string building, so the pipeline can do it.
	 */
	public const CLASS_LINK_URL = 'link-url';

	/**
	 * Features that mean the template is doing something beyond the shape being
	 * recognised, so it must be rendered rather than bypassed.
	 */
	private const DISQUALIFYING = '/\{\{#(ask|set|arraymap|tag|batchupload|invoke|dateformat|info)\b/';

	/**
	 * A `#switch` on the reader's language over a `{text, lang}` list.
	 *
	 * Matches the shape OSL uses throughout: delimiters switched so the wikitext
	 * `#switch` can wrap a mustache section, one `#ifeq` picking `#default` for
	 * English, and the section's `text` as the case body.
	 *
	 * `lead`, `gap` and `suffix` capture the literal text outside the `#switch`.
	 * The delimiter-change tag itself produces no output, but it is not
	 * standalone on its line, so the whitespace around it is literal and does
	 * reach the page. The replacement has to emit it too, or every bypassed value
	 * loses a character relative to the template it stands in for.
	 */
	private const LANGUAGE_PATTERN =
		'/^(?P<lead>\s*)\{\{=<%\s*%>=\}\}(?P<gap>\s*)\{\{#switch:\s*\{\{USERLANGUAGECODE\}\}\s*'
		. '<%#(?P<key>[\w.]+)%>\s*\|\s*\{\{#ifeq:\s*<%lang%>\s*\|\s*en\s*\|\s*#default\s*\|\s*<%lang%>\}\}\s*'
		. '=\s*<%text%>\s*<%\/(?P=key)%>\s*\}\}(?P<suffix>\s*)$/';

	/**
	 * A section iterating a list of page references, emitting `Viewer/Link` for
	 * each. Recognised only; see CLASS_LINK.
	 *
	 *     {{=<% %>=}} <%#type%> {{Viewer/Link |page=<%.%> }} <br><%/type%>
	 */
	private const LINK_PAGE_PATTERN =
		'/^\s*\{\{=<%\s*%>=\}\}\s*<%#(?P<key>[\w.]+)%>\s*\{\{Viewer\/Link\s*\|\s*page\s*=\s*<%\.%>\s*\}\}\s*'
		. '(?:<br\s*\/?>)?\s*<%\/(?P=key)%>\s*$/';

	/**
	 * The same section over a list of URLs.
	 *
	 *     {{#rdf_type}} {{=<% %>=}} {{Viewer/Link |url= <%={{ }}=%> {{{.}}} {{=<% %>=}} }} <br><%={{ }}=%>{{/rdf_type}}
	 *
	 * The delimiters switch twice so that the mustache interpolation can sit
	 * inside a wikitext template call. What survives as literal output is the
	 * whitespace between the tags, and it is captured here in the two positions
	 * it can occupy: `a1` and `a2` run before the `Viewer/Link` call and repeat
	 * per item, `b` follows it and carries the `<br>` separator.
	 *
	 * Note `{{{.}}}` is a triple stache, so the URL is interpolated unescaped.
	 */
	private const LINK_URL_PATTERN =
		'/^(?P<prefix>\s*)\{\{#(?P<key>[\w.]+)\}\}(?P<a1>\s*)\{\{=<%\s*%>=\}\}(?P<a2>\s*)'
		. '\{\{Viewer\/Link\s*\|\s*url\s*=\s*<%=\{\{\s*\}\}=%>\s*\{\{\{\.\}\}\}\s*'
		. '\{\{=<%\s*%>=\}\}\s*\}\}(?P<b>[^<]*(?:<br\s*\/?>)?\s*)'
		. '<%=\{\{\s*\}\}=%>\{\{\/(?P=key)\}\}(?P<suffix>\s*)$/';

	/**
	 * Which native rendering this template duplicates, or null if it has to be
	 * rendered as written.
	 *
	 * @param array $template One entry from a property's `eval_template`.
	 * @param string $key The property it belongs to. A pattern that iterates a
	 *   different key than the property it is attached to is not the shape this
	 *   recognises, so it is refused.
	 */
	public function classify( array $template, string $key ): ?string {
		$match = $this->match( $template, $key );
		return $match === null ? null : $match['class'];
	}

	/**
	 * As classify(), but also reporting the literal text the template emits
	 * around the part being replaced, so a caller can reproduce it exactly.
	 *
	 * `prefix` and `suffix` are emitted once. `itemPrefix` and `itemSuffix`
	 * surround each iteration of a section, and are empty for a class that does
	 * not iterate.
	 *
	 * @return array{class:string,prefix:string,suffix:string,itemPrefix:string,itemSuffix:string}|null
	 */
	public function match( array $template, string $key ): ?array {
		$value = $template['value'] ?? null;
		if ( !is_string( $value ) || $value === '' ) {
			return null;
		}

		$type = $template['type'] ?? null;
		if ( $type !== 'mustache-wikitext' ) {
			// A plain mustache template costs no parser round-trip, so there is
			// nothing to gain and a shape to lose.
			return null;
		}

		if ( preg_match( self::DISQUALIFYING, $value ) ) {
			return null;
		}

		if ( preg_match( self::LANGUAGE_PATTERN, $value, $m ) && $m['key'] === $key ) {
			return self::result( self::CLASS_LANGUAGE, $m['lead'] . $m['gap'], $m['suffix'] );
		}

		if ( preg_match( self::LINK_URL_PATTERN, $value, $m ) && $m['key'] === $key ) {
			return self::result(
				self::CLASS_LINK_URL,
				$m['prefix'],
				$m['suffix'],
				$m['a1'] . $m['a2'],
				$m['b']
			);
		}

		if ( preg_match( self::LINK_PAGE_PATTERN, $value, $m ) && $m['key'] === $key ) {
			return self::result( self::CLASS_LINK );
		}

		return null;
	}

	/**
	 * @return array{class:string,prefix:string,suffix:string,itemPrefix:string,itemSuffix:string}
	 */
	private static function result(
		string $class,
		string $prefix = '',
		string $suffix = '',
		string $itemPrefix = '',
		string $itemSuffix = ''
	): array {
		return [
			'class' => $class,
			'prefix' => $prefix,
			'suffix' => $suffix,
			'itemPrefix' => $itemPrefix,
			'itemSuffix' => $itemSuffix,
		];
	}
}
