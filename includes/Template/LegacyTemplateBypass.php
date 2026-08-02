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

	/** A reference rendered as a link. */
	public const CLASS_LINK = 'link';

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
	 * A section iterating a list of references and emitting `Viewer/Link` for
	 * each, in either the page or the url form.
	 */
	private const LINK_PATTERNS = [
		// {{=<% %>=}} <%#type%> {{Viewer/Link |page=<%.%> }} <br><%/type%>
		'/^\s*\{\{=<%\s*%>=\}\}\s*<%#(?P<key>[\w.]+)%>\s*\{\{Viewer\/Link\s*\|\s*page\s*=\s*<%\.%>\s*\}\}\s*'
		. '(?:<br\s*\/?>)?\s*<%\/(?P=key)%>\s*$/',
		// {{#rdf_type}} {{=<% %>=}} {{Viewer/Link |url= <%={{ }}=%> {{{.}}} ... }}
		'/^\s*\{\{#(?P<key>[\w.]+)\}\}\s*\{\{=<%\s*%>=\}\}\s*\{\{Viewer\/Link\s*\|\s*url\s*=\s*'
		. '<%=\{\{\s*\}\}=%>\s*\{\{\{\.\}\}\}\s*\{\{=<%\s*%>=\}\}\s*\}\}\s*'
		. '(?:<br\s*\/?>)?\s*<%=\{\{\s*\}\}=%>\{\{\/(?P=key)\}\}\s*$/',
	];

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
	 * @return array{class:string,prefix:string,suffix:string}|null
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
			return [
				'class' => self::CLASS_LANGUAGE,
				'prefix' => $m['lead'] . $m['gap'],
				'suffix' => $m['suffix'],
			];
		}

		foreach ( self::LINK_PATTERNS as $pattern ) {
			if ( preg_match( $pattern, $value, $m ) && $m['key'] === $key ) {
				return [ 'class' => self::CLASS_LINK, 'prefix' => '', 'suffix' => '' ];
			}
		}

		return null;
	}
}
