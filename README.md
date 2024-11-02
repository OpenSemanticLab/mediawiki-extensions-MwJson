# mediawiki-extensions-MwJson

Extension and standalone js lib to support storing and editing of structured data and meta data based on MultiContentRevisions, json, json-schema and json-ld.

See also [T324933](https://phabricator.wikimedia.org/T324933)

![grafik](https://user-images.githubusercontent.com/52674635/218385870-34be7312-00bb-4da0-ab3d-a811c01f5181.png)

## Config

```json
{
    "wgMwJsonAllowSubmitInvalide": {
        "value": "always",
        "description": "Forbid ('never'), conditional if set in schema option ('option') or always ('always') allow the user to save data failing schema validation."
    },
    "wgMwJsonAiCompletionApiUrl": {
        "value": null,
        "description": "REST-API endpoint acception {\"promt\": \"...\", \"jsonschema\": \"\"} and returning a valide schema instance."
    }
}
```

