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
   ```bash
   cd extensions
   git clone https://github.com/OpenSemanticLab/mediawiki-extensions-MwJson.git MwJson
   cd MwJson
   ```

   In the `LocalSettings.php` file, add the config
   ```
   $wgMwJsonSlotRenderResultTransformation = [
      "enabled" => true,
   ];
   ```
   By enabling the MwJson option, this ensures slot render results are displayed correctly

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

## Configuration

```json
{
    "wgMwJsonAllowSubmitInvalide": {
        "value": "always",
        "description": "Forbid ('never'), conditional if set in schema option ('option') or always ('always') allow the user to save data failing schema validation."
    },
    "wgMwJsonAiCompletionApiUrl": {
        "value": null,
        "description": "REST-API endpoint acception {\"promt\": \"...\", \"jsonschema\": \"\"} and returning a valide schema instance."
    },
    "wgMwJsonOrderSlotRenderResults": {
        "value": false,
        "description": "Brings the render results of the slots into order 'header', 'main', 'footer', <additional slots>."
    },
    "wgMwJsonWrapSlotRenderResults": {
        "value": false,
        "description": "Wraps the render results of the slots in a div element"
    }
}
```

