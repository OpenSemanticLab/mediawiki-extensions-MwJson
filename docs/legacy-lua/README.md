# Legacy Lua reference sources

Snapshot of the on-wiki Scribunto modules that the PHP pipeline in
`includes/Json`, `includes/Template`, `includes/Render` and `includes/Mw`
replaces. Kept in-tree as the reference implementation for the port and as the
source of truth for the strict-parity harness in `tests/parity`.

**These files are not loaded at runtime.** They are documentation.

| File | Wiki page | Role |
|---|---|---|
| `MwJson.lua` | `Module:MwJson` | The whole pipeline: slot/JSON loading, `$ref` expansion, schema inheritance walk, `eval_template` expansion, JSON-LD `@context`, SMW property/subobject mapping, infobox + tree rendering |
| `Entity.lua` | `Module:Entity` | Dispatcher invoked from the `header`/`footer` slot of every content page (`{{#invoke:Entity\|header}}`) |
| `Lustache.lua` | `Module:Lustache` | Lua port of mustache.js, entry point |
| `Lustache_Context.lua` | `Module:Lustache/Context` | |
| `Lustache_Renderer.lua` | `Module:Lustache/Renderer` | |
| `Lustache_Scanner.lua` | `Module:Lustache/Scanner` | |
| `Media.lua` | `Module:Media` | Gallery helper, *not* part of this migration, kept for context |

Fetched from <https://stacktest.digital.isc.fraunhofer.de> (OSL dev stack
`osl-mw-dev-test-1.43`, MediaWiki 1.43.9) on 2026-07-30 via
`index.php?title=Module:<name>&action=raw`.

Upstream these pages ship as part of the PageExchange package
`world.opensemantic.core`
(<https://github.com/OpenSemanticWorld-Packages/world.opensemantic.core>);
they are removed from that package at the end of the migration.

To refresh the snapshot:

```sh
for p in MwJson Entity Lustache Lustache/Context Lustache/Renderer Lustache/Scanner Media; do
  curl -s "https://stacktest.digital.isc.fraunhofer.de/w/index.php?title=Module:${p//\//%2F}&action=raw" \
    -o "$(echo "$p" | tr / _).lua"
done
```
