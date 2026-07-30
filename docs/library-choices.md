# Library choices for the OO-LD pipeline

Policy: **use the standard JSON Schema / JSON-LD libraries wherever they are
adequate**, and keep bespoke code only where a standard library demonstrably
cannot do the job. Every bespoke component below states *why*, so the decision
can be revisited when the ecosystem moves.

Verified against the OSL dev stack `osl-mw-dev-test-1.43` (MediaWiki 1.43.9,
PHP 8.1) on 2026-07-30.

## Mustache: `mustache/mustache` ^2.14 ✅ standard lib, needs a deployment step

Replaces `Module:Lustache` (a Lua port of mustache.js).

The OSL schemas depend on Mustache **delimiter switching**
(`{{=<% %>=}}` ... `<%={{ }}=%>`) so that Mustache and wikitext template syntax
can be interleaved in one string, plus implicit iterators (`{{{.}}}`) and nested
sections. The engine therefore has to be spec-complete.

### Why not `zordius/lightncandy`, which is already vendored

It was the first choice, precisely because MediaWiki core already ships it as
the engine behind `TemplateParser`, so it would have cost no deployment change.
It handles delimiter switching correctly. It was rejected for one reason:
**escaping cannot be overridden.** The compiler inlines
`htmlspecialchars((string)$var, ENT_QUOTES, 'UTF-8')` into the code it generates
(`vendor/zordius/lightncandy/src/Compiler.php:669`), so there is no hook, and
replacing the `runtime` class does not reach the simple-variable path.

That matters because Lustache escapes `[&<>"'/]` with `'` as `&#39;` and `/` as
`&#x2F;` (`Lustache_Renderer.lua:300`), and PHP's `htmlspecialchars` matches
neither spelling. `mustache/mustache` takes an `escape` callable, so it can
reproduce Lustache exactly, or deliberately not, per the decision below.

### Deployment step

`mustache/mustache` is not in core's `vendor/`, so the wiki has to be told about
it. In the `osl-mw` image build (`mediawiki/build/Dockerfile`), alongside the
existing `mediawiki/bootstrap-components` line:

```dockerfile
&& COMPOSER=composer.local.json composer require --no-update mustache/mustache:^2.14 \
&& composer update --no-dev
```

Requiring the package directly rather than adding
`extensions/MwJson/composer.json` to the merge-plugin `include` list, because
the extension is bind-mounted at run time and is not present when the image is
built.

### Conformance, measured

`tests/parity/compareMustache.php` renders every `eval_template` on the wiki
against real `jsondata`, through both engines, and diffs. With Lustache-exact
escaping the result is **97/101 identical**, and all four residual differences
are Lustache defects rather than port defects:

| Case | Lustache | mustache/mustache |
|---|---|---|
| `[[{{{creator}}}]]` where `creator` is an array | `[[table: 0x55d1d1156400]]`, a **memory address**, different every run | `[[Array]]` |
| Two schemas closing `<%#input_components%>` with `<%/input_componentss%>` | renders as if well formed; it does not check that the tags match | rejected as malformed |

The malformed schemas are `Category:OSW0583b134c618484c9911a3dff145c7eb`
(`mixing_process`) and `Category:OSWb8435fabafcb48f985422448e9df5faa`
(`input_components`). Neither property currently appears in any page's
`jsondata`, so nothing renders them today. They should be fixed on the wiki.

### Decision: the slash is not escaped

`MustacheRenderer::ESCAPE_SLASH` is **false**, so the port diverges from
Lustache here on purpose.

Reproducing Lustache's `/` to `&#x2F;` reproduces live data corruption. Quantity
templates feed rendered values straight into `{{#set:}}`, and the `;` that ends
the entity splits the value:

```
value                1e-09 /mm³
Lustache renders     {{#set: |Corresponds to=1e-09 &#x2F;mm³ }}
SMW stores           ["1e-09 &#x2F", "mm³"]      two broken values
```

Verified against the live wiki: `Property:HasAbsoluteActivityValue` and
`Property:HasAbsoluteHumidityValue` among others hold exactly these split
values, and over 500 pages carry `Corresponds to` values. With the slash left
alone, SMW stores one correct value.

The flag is kept so the parity harness can run both ways: pass `--escape-slash`
to `compareMustache.php` to measure against the Lua's exact output. Turning the
fix on changes stored SMW data for quantity properties, so it needs a
`rebuildData` pass, and any saved query matching the corrupted strings needs
updating.

## JSON-LD: `ml/json-ld` ^1.2 ⚠️ standard lib, with a hard limit

Already in `vendor/` (a SemanticMediaWiki dependency). Provides real context
processing: term to IRI expansion, `@type: "@id"`, `@reverse`, `@container`,
`@vocab`, and remote-context loading via a pluggable `DocumentLoaderInterface`
(which lets us serve wiki-hosted contexts without HTTP).

**There is no JSON-LD 1.1 processor for PHP.** Checked, rather than assumed, by
installing every candidate on Packagist and reading its keyword table:

| Library | Version | Status | Keywords |
|---|---|---|---|
| `ml/json-ld` | 1.2.1 (2022) | vendored via SMW | 1.0 set (`Processor.php:35-36`) |
| `sweetrdf/json-ld` | 1.4.3 (2026-05) | fork of the above; the author states it is "maintained but not developed any further" | identical 1.0 set |
| `digitalbazaar/json-ld` | 0.4.8 (2023) | the reference implementation author's PHP port | 1.0 set (`_isKeyword()` ends at `@vocab`) |

None of the three contains `@protected`, `@propagate`, `@version`, `@nest`,
`processingMode` or `json-ld-1.1` anywhere in its source. Note digitalbazaar's
*JavaScript* library is fully 1.1; the PHP port was never brought forward.

So none of them supports **property-scoped or type-scoped contexts**, which is
what OO-LD leans on: it requires `"@version": 1.1`, mirrors `$ref` inside
`type: object` properties as property-scoped contexts, and resolves
`oneOf`/`anyOf` keyword conflicts with type-scoped contexts.

**Consequence:** `ContextBuilder` stays bespoke for the scoped-context
assembly, which is what `Module:MwJson`'s `buildContext` already hand-rolls by
"pulling up" nested contexts. We delegate to `ml/json-ld` for the parts it does
correctly (flat term resolution, IRI expansion, remote contexts) and keep our
own layer above it. Do not describe this as "OO-LD via a standard processor";
it is a standard processor plus a documented 1.1 shim.

For the OO-LD phase that leaves three options, none of them free: implement the
1.1 subset OO-LD actually needs on top of a 1.0 processor, which is roughly
where the current code already sits; contribute 1.1 support upstream to
`sweetrdf/json-ld`, which is the only actively released one; or accept that
scoped contexts are resolved by OSL's own rules rather than by a conforming
processor, and say so in the OO-LD documentation.

## JSON Schema

Two distinct jobs, and they need different tools.

### `$ref` resolution: standard lib ✅

Use a proper resolver with a wiki-backed URI retriever for OSL's
`/wiki/<Title>?action=raw&slot=<slot>` refs, rather than the ad-hoc string
matching in `MwJson.lua`'s `expandJsonRef`.

### Schema *flattening*: bespoke, by definition ⚠️

What `expandJsonRef` and `walkJsonSchema` actually do is not `$ref` resolution;
it is **bundling a schema and its `allOf` ancestors into one merged object** for
the form generator, the infobox and the context. No JSON Schema library does
this, because it is not a JSON Schema operation: validators evaluate `allOf`
conjunctively and never merge. OO-LD specifies the merge (JSON Merge Patch,
RFC 7396, narrow-only), so this stays ours, behind `MergeStrategy`.

### Validation: deferred, and `justinrainbow` will not do ❌

The vendored `justinrainbow/json-schema` is **5.3.1, which ships only
draft-03 and draft-04 metaschemas** (`dist/schema/`). OO-LD *requires* JSON
Schema 2020-12, specifically for `$ref` alongside sibling keywords, which
draft-04 ignores, and for `unevaluatedProperties`. So justinrainbow is unusable
for this pipeline.

The 2020-12 option in PHP is **`opis/json-schema` ^2.3**. Like
`mustache/mustache` it is not in core's `vendor/`, so it needs the same
Dockerfile step. Not added yet: validation is not on the critical path for the
migration, and pulling in an unused dependency now would be premature. Add it
with the validation feature.

## JSON Merge Patch (RFC 7396)

~30 lines, no dependency worth taking. Implemented as `MergePatchStrategy`
alongside `LegacyLuaMergeStrategy` so the OO-LD switch is a strategy swap.

## JSONPath: `galbar/jsonpath` ^2.1 ✅ standard lib

For the Overlay `target` expressions in the slot-patch feature. Already in
`vendor/` via WSSlots, and the engine behind its `#slotdata`, so patches and
`#slotdata` will agree on what a path means. Confirm it covers the RFC 9535
subset actually used (notably filter expressions) before committing.
