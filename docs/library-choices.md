# Library choices for the OO-LD pipeline

Policy: **use the standard JSON Schema / JSON-LD libraries wherever they are
adequate**, and keep bespoke code only where a standard library demonstrably
cannot do the job. Every bespoke component below states *why*, so the decision
can be revisited when the ecosystem moves.

Verified against the OSL dev stack `osl-mw-dev-test-1.43` (MediaWiki 1.43.9,
PHP 8.1) on 2026-07-30.

## Mustache: `zordius/lightncandy` ^1.2 ✅ standard lib

Replaces `Module:Lustache` (a Lua port of mustache.js). Already in MediaWiki
core's `vendor/` as the engine behind `TemplateParser`.

Run in `LightnCandy::FLAG_MUSTACHE` mode. The OSL schemas depend on Mustache
**delimiter switching** (`{{=<% %>=}}` … `<%={{ }}=%>`) to interleave Mustache
with wikitext templates, and lightncandy supports it (`src/Validator.php:527`),
which is the reason it is usable here at all. It compiles templates to PHP, so
compiled forms are cached by `sha1($template)`.

**Gate before adoption:** a conformance suite comparing Lustache and lightncandy
over every distinct `eval_template` on the wiki. If it fails, switch to
`mustache/mustache` (interpreted, spec-complete) rather than patching around it.

## JSON-LD: `ml/json-ld` ^1.2 ⚠️ standard lib, with a hard limit

Already in `vendor/` (a SemanticMediaWiki dependency). Provides real context
processing: term→IRI expansion, `@type: "@id"`, `@reverse`, `@container`,
`@vocab`, and remote-context loading via a pluggable `DocumentLoaderInterface`
(which lets us serve wiki-hosted contexts without HTTP).

**It implements JSON-LD 1.0 only.** Its keyword table (`Processor.php:35-36`) is
the 1.0 set. There is no `@version`, `@protected`, `@propagate`, `@nest` or
`@prefix`, and therefore **no property-scoped or type-scoped contexts**.

That matters because OO-LD leans on 1.1 scoped contexts: it requires
`"@version": 1.1`, mirrors `$ref` inside `type: object` properties as
*property-scoped* contexts, and resolves `oneOf`/`anyOf` keyword conflicts with
type-scoped contexts. There is no maintained JSON-LD 1.1 processor for PHP.

**Consequence:** `ContextBuilder` stays bespoke for the scoped-context
assembly, which is what `Module:MwJson`'s `buildContext` already hand-rolls by
"pulling up" nested contexts. We delegate to `ml/json-ld` for the parts it does
correctly (flat term resolution, IRI expansion, remote contexts) and keep our
own layer above it. Do not describe this as "OO-LD via a standard processor";
it is a standard processor plus a documented 1.1 shim.

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
this, because it is not a JSON Schema operation. Validators evaluate `allOf`
conjunctively and never merge. OO-LD specifies the merge explicitly (JSON Merge
Patch, RFC 7396, narrow-only), so this stays ours, behind `MergeStrategy`.

### Validation: deferred, and `justinrainbow` will not do ❌

The vendored `justinrainbow/json-schema` is **5.3.1, which ships only
draft-03 and draft-04 metaschemas** (`dist/schema/`). OO-LD *requires* JSON
Schema 2020-12, specifically for `$ref` alongside sibling keywords, which
draft-04 ignores, and for `unevaluatedProperties`. So justinrainbow is unusable
for this pipeline.

The 2020-12 option in PHP is **`opis/json-schema` ^2.3**. It is *not* in core's
`vendor/`, so adopting it requires adding `extensions/MwJson/composer.json` to
the wiki's `composer.local.json` merge-plugin include list. Not added yet:
validation is not on the critical path for the migration, and pulling in an
unused dependency now would be premature. Add it with the validation feature.

## JSON Merge Patch (RFC 7396)

~30 lines, no dependency worth taking. Implemented as `MergePatchStrategy`
alongside `LegacyLuaMergeStrategy` so the OO-LD switch is a strategy swap.

## JSONPath: `galbar/jsonpath` ^2.1 ✅ standard lib

For the Overlay `target` expressions in the slot-patch feature. Already in
`vendor/` via WSSlots, and the engine behind its `#slotdata`, so patches and
`#slotdata` will agree on what a path means. Confirm it covers the RFC 9535
subset actually used (notably filter expressions) before committing.
