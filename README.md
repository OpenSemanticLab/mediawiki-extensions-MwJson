# mediawiki-extensions-MwJson

Extension and standalone js lib to support storing and editing of structured data and meta data based on MultiContentRevisions, json, json-schema and json-ld.

## User Perspective

### What is MwJson?
MwJson is a MediaWiki extension that enables you to:
- Store and edit structured data in JSON format
- Validate data against JSON schemas
- Organize content in different slots (header, main, footer)
- Use AI to help complete data entries
- Connect to external data sources
- Work with JSON-LD for semantic data

### Key Features for Users
1. **Data Management**
   - JSON data storage and editing
   - Schema-based validation
   - Multi-slot content organization
   - External data integration

2. **Content Organization**
   - Slot-based content structure
   - Header, main, and footer sections
   - Flexible content organization
   - Easy navigation between sections

3. **Smart Features**
   - AI-powered data completion
   - Schema validation
   - External data fetching
   - JSON-LD support

### How to Use
1. **Basic Usage**
   - Create a new page
   - Add content to different slots
   - Define JSON schemas
   - Use the editor interface

2. **Accessing Content**
   - Use `Special:SlotResolver` to view slots
   - Format: `Special:SlotResolver/<namespace>/<page>.slot_<slotname>.<extension>`

3. **Configuration**
   Add to your LocalSettings.php:
   ```php
   $wgMwJsonAllowSubmitInvalide = 'always'; // Allow saving invalid data
   $wgMwJsonAiCompletionApiUrl = null; // Set AI completion API
   $wgMwJsonRemoveEmptyOnSubmit = true; // Deep-strip empty properties from jsondata before save (default: true)
   $wgMwJsonOrderSlotRenderResults = false; // Order of sections
   $wgMwJsonWrapSlotRenderResults = false; // Wrap sections in divs
   ```

## Developer Perspective

### Architecture Overview
The extension is built with a modular architecture:

1. **Core Components**
   - `MwJson.php`: Main extension class
   - `SpecialSlotResolver.php`: Slot resolution handler
   - Integration with WSSlots for slot management
   - Integration with SemanticMediaWiki for semantic features

2. **JavaScript Modules**
   - `ext.mwjson`: Core functionality
   - `ext.mwjson.util`: Utility functions
   - `ext.mwjson.api`: API interface
   - `ext.mwjson.editor`: Editor UI
   - `ext.mwjson.parser`: Content parsing

### Technical Features
1. **Slot Management**
   - Integration with WSSlots extension
   - Custom slot organization
   - Slot-based content rendering
   - Slot validation system

2. **Data Handling**
   - JSON Schema validation
   - MultiContentRevision support
   - JSON-LD integration
   - External data fetching

3. **API System**
   ```javascript
   // Get page content
   mwjson.api.getPage('PageTitle').then(page => {
       // Handle page data
   });

   // Edit slot content
   mwjson.api.editSlot('PageTitle', 'slotName', content, 'Edit summary');

   // Get semantic properties
   mwjson.api.getSemanticProperties('PageTitle').then(properties => {
       // Handle properties
   });
   ```

### Development Setup
1. **Requirements**
   - MediaWiki >= 1.35
   - WSSlots
   - SemanticMediaWiki
   - SemanticCompoundQueries
   - CodeEditor
   - CodeMirror
   - VEForAll

2. **Installation**

   Clone the extension into the wiki's `extensions` directory:
   ```bash
   git clone https://github.com/OpenSemanticLab/mediawiki-extensions-MwJson.git extensions/MwJson
   ```

   Load it from `LocalSettings.php`, and enable the slot render transformation
   so that what a slot renders is placed in the page rather than appended to it:
   ```php
   wfLoadExtension( 'MwJson' );
   $wgMwJsonSlotRenderResultTransformation = [
       "enabled" => true,
   ];
   ```

3. **Building**
   - Install dependencies
   - Run tests
   - Build assets

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License
This extension is licensed under AGPL-3.0-or-later. See the LICENSE file for details.

## Support
For issues and feature requests, please use the GitHub issue tracker.

See also [T324933](https://phabricator.wikimedia.org/T324933)

![grafik](https://user-images.githubusercontent.com/52674635/218385870-34be7312-00bb-4da0-ab3d-a811c01f5181.png)

## Approved revisions

Where [ApprovedRevs](https://www.mediawiki.org/wiki/Extension:Approved_Revs) is
installed, a slot read follows the revision that is actually being served rather
than the page's current one. Without this a reader sees approved wikitext over
unapproved data, and SemanticMediaWiki is handed values from a revision it did
not store.

Two rules decide which revision a read lands on:

1. **The revision being parsed**, for the page being parsed. ApprovedRevs swaps
   the whole revision at both ends, an `Article` pinned to the approved id for a
   view and a render of the approved revision for the link updates, so the parse
   already is of the approved revision. This also fixes `?oldid=` views, which
   otherwise show current-revision data.
2. **SemanticMediaWiki's `RevisionGuard`**, for every other page: the category
   chain, `$ref` targets and patch pages. Those have no parse to draw on, so
   something has to answer for the title alone, and asking the same guard SMW
   asks means the two cannot disagree about which revision was stored.

Rule 2 needs
[SemanticApprovedRevs](https://github.com/SemanticMediaWiki/SemanticApprovedRevs)
installed to answer those hooks. Without it the guard returns the current
revision and nothing changes, so the feature is inert rather than optional: no
configuration is added, and a wiki with no approval mechanism behaves exactly as
before.

Two things deliberately do not follow the approved revision:

- **The permission gate.** `$wgMwJsonCategoryEditRights` is decided against
  stored content. A category whose current revision adds a guarded ancestor must
  guard it immediately, not once someone approves that revision.
- **`Special:SlotResolver` without `patchset`.** That serves stored content, for
  package export and for the editor reading source to edit.

Approving invalidates two caches that cannot see it otherwise. An approval moves
no revision, so `ResolvedSchemaCache`, which revalidates by comparing revision
ids, is invalidated through a check key instead; and the approved page is purged,
because SemanticMediaWiki skips an update whose revision it has already stored
and only the purge path gets past that.

## Configuration

Generated from `extension.json`; every setting the extension defines, with its default.

### `$wgMwJsonRenderer`

Default: `"lua"`

Which implementation renders the header/footer pipeline: 'lua' (legacy Module:MwJson, the default during the migration) or 'php' (the in-extension OO-LD pipeline). Module:Entity dispatches on this via mw.ext.mwjson.enabled(), so it is a live rollback switch: no page edits required to flip back.

### `$wgMwJsonResolveLinkLabels`

Default: `true`

When true, the PHP pipeline resolves a link's display label by reading the semantic store instead of expanding the Viewer/Link wiki template, which runs one SMW query per link. Access is enforced with the same read permission check the query path uses, so a reader who may not see a target gets the plain link they get today. On by default: output is byte-identical to the wiki template across the full corpus, and it removes one SMW query per link. Set false to fall back to expanding Viewer/Link.

### `$wgMwJsonRegisterSlotDependencies`

Default: `false`

When true, the pages a schema resolution reads (the category chain and every $ref target) are registered as parser-cache dependencies, so editing a category's jsonschema slot invalidates the pages below it. Off by default because enabling it makes an edit to a base category queue a refresh for every entity beneath it, which is the intended effect but is an operational event worth scheduling. Neither this port nor the Lua registers them today.

### `$wgMwJsonBypassLegacyTemplates`

Default: `false`

When true, the PHP pipeline renders the values behind recognised legacy eval_templates itself instead of running them. Those templates exist because Scribunto could not resolve the reader's language; the pipeline can, so running them is redundant work on every page. Output is unchanged. Off by default so the recogniser can be verified against a wiki's own schemas before it takes effect.

### `$wgMwJsonAllowSubmitInvalide`

Default: `"always"`

Forbid ('never'), conditional if set in schema option ('option') or always ('always') allow the user to save data failing schema validation.

### `$wgMwJsonRemoveEmptyOnSubmit`

Default: `true`

When true, mwjson.editor recursively strips empty values ('', null, undefined, [], {}) from jsondata before saving so unfilled defaultProperties and cleared optional fields do not persist. Set to false to keep the raw form value.

### `$wgMwJsonMissingSchemaPage`

Default: `"warn"`

How the schema resolver reacts when a $ref target page does not exist at all, e.g. a category missing from the inheritance chain. One of 'ignore', 'warn' or 'abort'. An empty schema is substituted unless 'abort' is set, so a single broken reference cannot make the editor impossible to open.

### `$wgMwJsonEmptySchemaSlot`

Default: `"ignore"`

How the schema resolver reacts when a $ref target page exists but carries no schema, e.g. a Property without a jsonschema slot. One of 'ignore', 'warn' or 'abort'. This is routine, hence 'ignore' by default.

### `$wgMwJsonAiCompletionApiUrl`

Default: `null`

REST-API endpoint accepting {"promt": "...", "jsonschema": ""} and returning a valide schema instance.

### `$wgMwJsonSlotRenderResultTransformation`

Default: `{"enabled": null, "wrap": true, "order": true, "skip_toc": false, "hide_toc": true}`

Brings the render results of slots into order 'header', 'main', 'footer', <additional slots>. if enabled. Optionally wraps slot content in a div (default: true). Optionally skips (default: false) or hides (default: true) the table of contents which usually is handled separately by skins.

### `$wgMwJsonCategoryEditRights`

Default: `{}`

Map of category page title to the right needed to create, edit, delete or move an instance of it, or a subclass of it. Empty by default, so nothing is guarded and the check reads no slots. A page is covered when its class chain reaches a guarded category, so declaring a subclass and instantiating that does not get around it. Enforced in MultiContentSave, which every write path goes through and which is the only point that can see the content being saved: a page being created has no stored type yet. Independent of $wgMwJsonEnablePatches, so a rule keeps holding while patches are switched off.

### `$wgMwJsonEnablePatches`

Default: `false`

When true, pages of type Category:PagePatch are consulted while reading slots, and the operations they declare are applied at read time without editing the target. Off by default: nothing is queried, read or applied while it is off. A patch only takes effect when the reader asks for one of the patch sets it declares, so turning this on changes nothing until $wgMwJsonDefaultPatchsets and a patch agree.

### `$wgMwJsonDefaultPatchsets`

Default: `["render"]`

The patch sets page rendering asks for. A patch applies when its own patchset list intersects this one. The form editor asks for 'ui' separately, so a patch can change the rendered page, the form the author edits, or both, as an explicit choice. An empty list means raw content, which is what keeps package export and other raw consumers unaffected even when patches are enabled.

### `$wgMwJsonPatchCategory`

Default: `""`

Prefixed title of the category a page must declare as its jsondata type before it is honoured as a patch, for example Category:OSWbd03ae43c1954ca889860ecf170682ef. Empty means nothing is honoured. The discovery query cannot be trusted to answer this: any user who can edit a page can add {{#set: HasPatchTarget=... }} to it, or declare the property in a category's @context, so the query finds candidates and the type decides. Subclasses of this category are deliberately not followed, since the candidate list is attacker controlled and a class walk per candidate would read slots per candidate. The category should also appear in $wgMwJsonCategoryEditRights, or anyone may write a page of that type.
