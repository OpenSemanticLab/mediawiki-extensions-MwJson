/*@nomin*/

mwjson.schema = class {
    constructor(args) {
        var defaultConfig = {
			mode: "default", // options: default, query
			lang: "en",
            // see https://flatpickr.js.org/formatting/#time-formatting-tokens
            format: {
                "date": "Y-m-d",
                "time": "H:i",
                "datetime-local": "Y-m-d H:i",
            },
            use_cache: true, // use local store schema cache
            target: null, // the target entity
            flatten: false, // flatten the schema to allow a table editor
		};
		this.config = mwjson.util.mergeDeep(defaultConfig, args.config);
        this.debug = mwjson.util.defaultArg(args.debug, false);
        var jsonschema = args.jsonschema || {};

        if (mwjson.util.isString(jsonschema)) jsonschema = JSON.parse(jsonschema);
        jsonschema.id = jsonschema.id || 'root';
        this._jsonschema = jsonschema;
        this._context = {};
        this.subschemas_uuids = [];
        this.data_source_maps = [];
        this.required_reverse_property_values = {};
        this.default_reverse_property_values = {};

        if (this.config.use_cache) {
            this.cache = new mwjson.Cache("schema", {debug: false});
            this.cache.fetchHashes();
            this.cache.cleanup(); // this will prevent infinite grow
        }

        // custom resolver to catch different notation of relative urls
        // see https://apitools.dev/json-schema-ref-parser/docs/plugins/resolvers.html
        // Temporary solution until new syntax is established
        // testcases
        /*
            /wiki/Category:Item?action=raw&slot=jsonschema
            ./Category:Item?action=raw&slot=jsonschema
            ./index.php?title=Category:Item&action=raw&slot=jsonschema
            /wiki/Category:Item
            ./Category:Item
            ./index.php?title=Category:Item
            https://test.com/wiki/Category:Item?action=raw&slot=jsonschema
            https://test.com/Category:Item?action=raw&slot=jsonschema
            https://test.com/w/index.php?title=Category:Item&action=raw&slot=jsonschema
            https://test3.com/wiki/Category:Item //external domain, will not be handled
            https://test.com/Category:Item
            https://test.com/index.php?title=Category:Item
            ../Category/OSW5044076ed688412391116162b574f017.slot_jsonschema.json //new syntax, will not be handled
        */
        let server = mw.config.get("wgServer")
        server = server.split("//")[server.split("//").length-1];
        server=server.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape for use in regex, e. g. '.' => '\.'
        let regex = new RegExp("^(?<domain>.*" + server + ")?(?<base>[^:]*)\/(.*title=)?(?<title>[^?&.]*?)(?<params>[?&].*)?$");
        this.title_regex = regex;
        this.resolver = {
            order: 1,
            canRead: regex,
            read: (file, callback, $refs) => {
                let url = file.url;
                //console.log("Fetch: ", url);
                let query = new mw.Uri(file.url).query;
                let match = regex.exec(file.url);
                let title = null;
                if (match && match.groups && match.groups.title) {
                    url = match.groups.title;
                    if ("title" in query) {
                        delete query["title"];
                    }
                    // generate a guaranteed valid url to the target page and append query params (except 'title')
                    url = mw.util.getUrl( match.groups.title, query );
                    title = match.groups.title;

                }
                if (this.config.use_cache && title) {
                    //console.log("Fetch from cache: ", match.groups.title);
                    this.cache.get(title).then((item) => callback(null, item.value ? item.value : "{}"));
                }
                else fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            callback(new Error("HTTP error " + response.status));
                        }
                        else {
                            return response.text();
                        }
                    })
                    .then(text => {
                        if (!text || text === "") text = "{}"; // fallback to empty schema
                        callback(null, text);
                    })
            }
        }
    }

    static selftest() {
        console.log("mwjson.schema selftest");
        var jsonschema = {
            "@context": {
                test: "Property:TestProperty",
                number_max: "Property:HasNumber",
                date_min: "Property:HasDate"
            },
            allOf: {$ref: "./Category:TestCategory"},
            properties: {
                test: { title: "Test", type: "string" },
                number_max: { title: "Number", type: "string", format: "number", options: { role: { query: { filter: "max" } } } },
                date_min: { title: "Date", type: "string", format: "date", options: { role: { query: { filter: "min" } } } },
            }
        };
        var jsondata = { test: "TestValue", number_max: 5, date_min: "01.01.2023" };
        var schema = new mwjson.schema({jsonschema: jsonschema});
        console.log(schema.getCategories());
        console.log(schema.getSemanticProperties({ jsondata: jsondata }));
        console.log(schema.getSemanticQuery({ jsondata: jsondata }));
    }

    getSchema() {
        return this._jsonschema;
    }

    setSchema(jsonschema) {
        this._jsonschema = jsonschema;
    }

    getContext(config) {
        var _config = {
            include_extern: true, //skos, schema.org, etc.
            include_intern: true, //wiki Properities
            include_custom: false, //wiki Properities
        }
        config = mwjson.util.mergeDeep(_config, config);
        var res = {};
        var context = this._context;
        for (const key in context) {
            var ignore = false;
            if (config.include_custom === false && key.endsWith("*")) {
                ignore = true;
                console.log("Ignore", key);
            }
            //ToDo: implement other cases
            if (!ignore) res[key] = context[key];
        }
        return res;
    }

    bundle() {
        //const deferred = $.Deferred();
        this.log("start bundle");
        const promise = new Promise((resolve, reject) => {

            if (this.getSchema()) {
                $RefParser.bundle(this.getSchema(), {resolve: {wiki: this.resolver}}, (error, schema) => {
                    if (error) {
                        console.error(error);
                        reject(error);
                    }
                    else {
                        //this.log("dereference schema")
                        //this.log(schema);
                        //ToDo: Fetch translations from property definitions: [[Property:SomeProperty]]|?HasLabel@en|?HasDescription@en, see https://github.com/json-schema-org/json-schema-spec/issues/53
                        //Fallback: Fetch i18n from title* and description*, see https://github.com/json-schema-org/json-schema-vocabularies/issues/10
                        this.setSchema(schema);
                        this.log("finish bundle");
                        resolve();
                    }
                });
            }
            else resolve();
        });
        return promise;
        //else deferred.resolve();
        //return deferred.promise();
    }

    _preprocess(params) {
        var schema = params.schema;
        var level = params.level ? params.level : 0;
		const translateables = ["title", "description", "enum_titles", "default", "inputAttributes"]; //ToDo: Just all <key>* keywords?
        var  visited_properties = params.visited_properties ? params.visited_properties : [];

        if (schema.allOf) {
            // apply allOf refs, while storing visited properties to detect overrides
			for (const subschema of Array.isArray(schema.allOf) ? schema.allOf : [schema.allOf]) {
				this._preprocess({schema: subschema, level: level + 1, visited_properties: visited_properties});
			}
		}
        if (schema.oneOf) {
            // apply oneOf refs, while discarding visited properties since the actual applied schema is unknown
			for (const subschema of Array.isArray(schema.oneOf) ? schema.oneOf : [schema.oneOf]) {
				this._preprocess({schema: subschema, level: level + 1}); 
			}
		}
        if (schema.anyOf) {
            // apply anyOf refs, while discarding visited properties since the actual applied schema is unknown
			for (const subschema of Array.isArray(schema.anyOf) ? schema.anyOf : [schema.anyOf]) {
				this._preprocess({schema: subschema, level: level + 1});
			}
		}

        if (schema.definitions) {
            // follow partial schemas in #/definitions
			for (const property of Object.keys(schema.definitions)) {
				this._preprocess({schema: schema.definitions[property], level: level + 1, visited_properties: visited_properties});
			}
		}
        if (schema.$defs) {
            // follow partial schemas in #/$defs
			for (const property of Object.keys(schema.$defs)) {
				this._preprocess({schema: schema.$defs[property], level: level + 1, visited_properties: visited_properties});
			}
		}
        // fix https://github.com/APIDevTools/json-schema-ref-parser/issues/356
        if (schema['$ref'] && mwjson.util.isString(schema['$ref'])) schema['$ref'] = schema['$ref'].replaceAll("%24defs", "$defs")

        //include all required properties within defaultProperties. see https://github.com/json-editor/json-editor/issues/1275
        if (schema.required) {
            if (!schema.defaultProperties) schema.defaultProperties = [];
             // insert required before existing defaultProperties since order in defaultProperties also defines UI order when propertyOrder is not set
            schema.defaultProperties.unshift(...schema.required);
            schema.defaultProperties = [...new Set(schema.defaultProperties)]; // remove duplicates
        }

        // translate attributes on schema level ("title", "description")
        for (const attr of translateables) {
            if (schema[attr+"*"]) {
                if (schema[attr+"*"][this.config.lang]) schema[attr] = schema[attr+"*"][this.config.lang];
            }
            if (schema.options) { //options
                if (schema.options[attr+"*"])
                    if (schema.options[attr+"*"][this.config.lang]) 
                        schema.options[attr] = schema.options[attr+"*"][this.config.lang];
            }
        }

        // handle string literal arrays
        if (schema.type === "array" && schema.format === "table" && schema.items?.type === "string") {
            //schema.options = mwjson.util.mergeDeep(schema.options, {"compact": true, "array_controls_top": false}); // display only item title
            schema.items.title = schema.items.title ? schema.items.title : schema.title; // use parent title if not set 
        }

        // handle select input elements
        if (schema.type === "array" && schema.uniqueItems === true && schema.items?.enum) {
            schema.format = "selectize"; // auto-set currently supported select input lib
        }

        // handle time, date and datetime-local format
        let format = schema.format;
        // https://json-schema.org/understanding-json-schema/reference/string#dates-and-times
        if (format === "date" || format === "time" || format === "datetime" || format === "datetime-local") {
            // note: json-schema specifies date-time, json-editor uses datetime-local
            if (format === "datetime" || format === "date-time") format = schema.format = "datetime-local";
            //set default values, see: https://github.com/flatpickr/flatpickr/issues/279
            let storeFormats = {"date": "Y-m-d", "time": "H:i", "datetime-local": "Z"};
            let displayFormats = this.config.format;
            schema.options = schema.options || {};
            schema.options.flatpickr = schema.options.flatpickr || {};
            schema.options.flatpickr.dateFormat = schema.options.flatpickr.dateFormat || storeFormats[format];

            //set altInput option if not explicite disabled
            if (!(schema.options.flatpickr.altInput === false)) {
                schema.options.flatpickr.altInput = true;
                schema.options.flatpickr.altFormat = schema.options.flatpickr.altFormat || displayFormats[format];
            }
        }

        if (schema["x-oold-reverse-properties"]) {
            for (const property of Object.keys(schema["x-oold-reverse-properties"])) {
                var property_schema = schema["x-oold-reverse-properties"][property];
                if (property_schema.type === "object" || property_schema.items?.type === "object") {
                    console.error("x-oold-reverse-properties must not be of type object or array of objects")
                    continue;
                }
                if (!schema.properties) schema.properties = {}
                schema.properties["_x-oold-reverse_" + property] = property_schema
            }
        }
        if (schema["x-oold-reverse-required"]) {
            for (const property of schema["x-oold-required"]) {
                if (!schema.required) schema.required = [];
                schema.required.push("_x-oold-reverse_" + property);
            }
        }
        if (schema["x-oold-reverse-defaultProperties"]) {
            for (const property of schema["x-oold-reverse-defaultProperties"]) {
                if (!schema.defaultProperties) schema.defaultProperties = [];
                schema.defaultProperties.push("_x-oold-reverse_" + property);
            }
        }

        // translate attributes on property level ("title", "description", "enum_titles", "default", "inputAttributes")
		if (schema.properties) {
			for (const property of Object.keys(schema.properties)) {

                // handle properties of type object and oneOf/anyOf on property level
                this._preprocess({schema: schema.properties[property]});

                // handle array items
                if (schema.properties[property].items) { //} && schema.properties[property].items.properties) {
                    this._preprocess({schema: schema.properties[property].items});
                }


                /* order properties aligned to allOf nesting level
                level  | schema   | propertyOrder   | adapted propertyOrder
                    1	Specific	-10	                -10
                    1	Specific	990	                998990
                    1	Specific	1000	            999000
                    1	Specific	1010	            1003010
                    2	Middle	    -11	                -11
                    2	Middle	    990	                996990
                    2	Middle	    1000	            997000
                    2	Middle	    1010	            1005010
                    3	Base	    -12	                -12
                    3	Base	    990	                994990
                    3	Base	    1000	            995000
                    3	Base	    1010	            1007010
                */
                if (!schema.properties[property].propertyOrder && !visited_properties.includes(property)) {
                    schema.properties[property].propertyOrder = 1000; // set only if property was not defined before
                }
                if (schema.properties[property].propertyOrder < 0) 
                    //absolute value - is currently not ranked correctly
                    schema.properties[property].propertyOrder = schema.properties[property].propertyOrder; 
                else if (schema.properties[property].propertyOrder <= 1000) 
                    //insert on top, rank higher levels before lower levels: default value is 1000, so we shift -2*1000 per level
                    schema.properties[property].propertyOrder = (1000*1000 - level*2000) + schema.properties[property].propertyOrder;
                else if (schema.properties[property].propertyOrder > 1000) 
                    //insert on buttom, rank higher levels after lower levels: default value is 1000, so we shift 2*1000 per level
                    schema.properties[property].propertyOrder = (1000*1000 + level*2000) + schema.properties[property].propertyOrder;

                // filter properties according to mode, e. g. remove non-query properties in query mode
				if (this.config.mode !== "default") {
					if (schema.properties[property].options) {
						if (schema.properties[property].options.conditional_visible && schema.properties[property].options.conditional_visible.modes) {
							if (!schema.properties[property].options.conditional_visible.modes.includes(this.config.mode)) schema.properties[property].options.hidden = true;
							else schema.properties[property].options.hidden = false;
						}
						else schema.properties[property].options.hidden = true;
					}
					else schema.properties[property].options = {hidden: true};
                    if (this.config.mode === "query" && schema.properties[property].options.hidden) {
                        //remove hidden fields completely
                        delete schema.properties[property];

                        // remove it also from required and defaultProperties
                        if (schema.required) {
                            schema.required = schema.required.filter(function(e) { return e !== property });
                            if (schema.required.length == 0) delete schema.required;
                        }
                        if (schema.defaultProperties) {
                            schema.defaultProperties = schema.defaultProperties.filter(function(e) { return e !== property });
                            if (schema.defaultProperties.length == 0) delete schema.defaultProperties;
                        }
                    }
				}
                // remove query properties in default mode
                if (this.config.mode === "default") {
                    if (schema.properties[property].options) {
						if (schema.properties[property].options.conditional_visible && schema.properties[property].options.conditional_visible.modes) {
							if (!schema.properties[property].options.conditional_visible.modes.includes(this.config.mode)) {
                                delete schema.properties[property];
        
                                // remove it also from required and defaultProperties
                                if (schema.required)
                                    schema.required = schema.required.filter(function(e) { return e !== property });
                                if (schema.defaultProperties)
                                    schema.defaultProperties = schema.defaultProperties.filter(function(e) { return e !== property });
                            }
						}
					} 
                }
                visited_properties.push(property);
			}
		}
        if (schema['@context']) {
            // merge nested context over general context
            if (mwjson.util.isArray(schema['@context'])) for (const c of schema['@context']) if (!mwjson.util.isString(c)) this._context = mwjson.util.mergeDeep(this._context, c);
            else if (!mwjson.util.isString(schema['@context'])) this._context = mwjson.util.mergeDeep(this._context, schema['@context']);
        }
        if (schema.uuid) this.subschemas_uuids.push(schema.uuid);
        if (schema.data_source_maps) this.data_source_maps = this.data_source_maps.concat(schema.data_source_maps);
		return schema;
	}

    preprocess() {
        this.log("preprocess start");
        const promise = new Promise((resolve, reject) => {
            this.setSchema(this._preprocess({schema: this.getSchema()}));
            this.log("preprocess finish");
            this.populateReverse().then(() => resolve());
            
            if (this.config.flatten) {
                // replace all $ref with the actual schema
                let schema = this.getSchema();
                schema = mwjson.util.resolveSchema(schema);
                schema = mwjson.util.flattenSchema(schema, undefined, {array_length: 1, array_index_notation: ".0"});
                this.setSchema(schema);
            }
        });
        return promise;
    }

    _interateSchema(params) {
        var schema = params.schema;
        var level = params.level ? params.level : 0;
        //var schema_path = params.schema_path ? params.schema_path : "";
        var data_path = params.data_path ? params.data_path : [];
        var  visited_properties = params.visited_properties ? params.visited_properties : [];

        if (schema.allOf) {
            // apply allOf refs, while storing visited properties to detect overrides
			for (const subschema of Array.isArray(schema.allOf) ? schema.allOf : [schema.allOf]) {
				this._interateSchema({schema: subschema, level: level + 1, visited_properties: visited_properties, callback: params.callback});
			}
		}
        if (schema.oneOf) {
            // apply oneOf refs, while discarding visited properties since the actual applied schema is unknown
			for (const subschema of Array.isArray(schema.oneOf) ? schema.oneOf : [schema.oneOf]) {
				this._interateSchema({schema: subschema, level: level + 1, callback: params.callback}); 
			}
		}
        if (schema.anyOf) {
            // apply anyOf refs, while discarding visited properties since the actual applied schema is unknown
			for (const subschema of Array.isArray(schema.anyOf) ? schema.anyOf : [schema.anyOf]) {
				this._interateSchema({schema: subschema, level: level + 1, callback: params.callback});
			}
		}

        // interate properties
		if (schema.properties) {
			for (const property of Object.keys(schema.properties)) {
                var local_data_path = mwjson.util.deepCopy(data_path);
                local_data_path.push(property);
                // handle properties of type object and oneOf/anyOf on property level
                this._interateSchema({schema: schema.properties[property], callback: params.callback, data_path: local_data_path});

                // handle array items
                if (schema.properties[property].items) { //} && schema.properties[property].items.properties) {
                    var local_data_path_item = mwjson.util.deepCopy(local_data_path);
                    local_data_path_item.push("*");
                    this._interateSchema({schema: schema.properties[property].items, callback: params.callback, data_path: local_data_path_item});
                }

                if (params.callback?.onProperty) params.callback.onProperty({property_key: property, object_definition: schema, property_definition: schema.properties[property], data_path: local_data_path});
                visited_properties.push(property);
			}
		}

		return schema;
	}

    populateReverse() {
        //this.log("populateReverse start");
        const promise = new Promise((resolve, reject) => {
            let schema = this.getSchema()
            let context = this._context;
            let fetch_promises = []
            this._interateSchema({schema: schema, callback: {
                onProperty: (params) => {
                    //console.log(params);
                    //let pc = context?.[params.property_key];
                    //if (pc["@reverse"]) {
                    //}
                    if (this.config.target && params.property_key.startsWith("_x-oold-reverse_") && context) {
                        let org_key = params.property_key.replace("_x-oold-reverse_", "");
                        for (const ck of Object.keys(context)) {
                            if (ck.replaceAll("*", "") === org_key && context[ck]["@reverse"]?.startsWith("Property:")) {
                                const reverse_lookup_property = context[ck]["@reverse"];
                                let query = mw.config.get("wgScriptPath") + "/api.php?action=ask&format=json&query=";
                                query += "[[" + reverse_lookup_property.replace("Property:", "") + "::" + this.config.target + "]]";
                                let fetch_promise = new Promise((resolve, reject) => {
                                    fetch(query)
                                    .then(response => response.json())
                                    .then(data => {
                                        if (data?.query?.results) {
                                            for (const result_key of Object.keys(data.query.results)) {
                                                let result = data.query.results[result_key];
                                                if (params.property_definition.type === "string") {
                                                    if (!params.property_definition.default) params.property_definition.default = result.fulltext;
                                                    else {
                                                        console.warn("Reverse property '" + params.property_key + "' already has a default value but more incomming relations were found.");
                                                        break;
                                                    }
                                                }
                                                else if (params.property_definition.type === "array" && params.property_definition.items?.type === "string") {
                                                    if (!params.property_definition.default) params.property_definition.default = [];
                                                    params.property_definition.default.push(result.fulltext);
                                                }
                                                else {
                                                    console.warn("Invalid type for reverse property '" + params.property_key + "'");
                                                    break;
                                                }
                                                //let reverse_default = params.object_definition["x-oold-reverse-defaultProperties"] || [];
                                                if ((params.object_definition["x-oold-reverse-required"] || []).includes(org_key))
                                                    this.required_reverse_property_values[params.property_key] = params.property_definition.default;
                                                if ((params.object_definition["x-oold-reverse-defaultProperties"] || []).includes(org_key))
                                                    this.default_reverse_property_values[params.property_key] = params.property_definition.default;
                                                //this.log("populateReverse add" + result.displaytitle);
                                            }
                                            //if (params.property_definition.default?.length && )
                                        }
                                        resolve();
                                    })
                                });
                                fetch_promises.push(fetch_promise)
                            }
                        }
                        //params.property_definition["XXTest"] = "test";
                        //if (!params.property_definition.default) params.property_definition.default = [];
                        //params.property_definition.default.push("Item:OSW364f8de07a054fe682f60fa1939e16b9")
                    }
                }
            }})

            Promise.allSettled(fetch_promises).then(() => {
                this.log("populateReverse finish");
                resolve();
            });
        });
        return promise;
    }

    storeAndRemoveReverse(jsondata) {
        //this.log("storeAndRemoveReverse start");
        const promise = new Promise((resolve, reject) => {
            let schema = this.getSchema()
            let context = this._context;
            let fetch_promises = []
            this._interateSchema({schema: schema, callback: {
                onProperty: (params) => {
                    if (this.config.target && params.property_key.startsWith("_x-oold-reverse_") && context) {
                        let org_key = params.property_key.replace("_x-oold-reverse_", "");
                        for (const ck of Object.keys(context)) {
                            if (ck.replaceAll("*", "") === org_key && context[ck]["@reverse"]?.startsWith("Property:")) {
                                const reverse_lookup_property = context[ck]["@reverse"];
                                const old_values = params.property_definition.default ? params.property_definition.default : [];
                                const new_values = jsondata[params.property_key] ? jsondata[params.property_key] : [];
                                let added = [];
                                let removed = [];
                                for (const v of [...old_values, ...new_values]) {
                                    if (!old_values.includes(v)) added.push(v)
                                    if (!new_values.includes(v)) removed.push(v)
                                }
                                const changed = [...added, ...removed];
                                if (changed.length) {
                                    this.log("Added ", added, " Removed: ", removed);
                                    let fetch_promise = new Promise((resolve, reject) => {
                                        //we cannot use range here, since it may point to a oneOf pattern
                                        //const schema_title = params.property_definition.items ? params.property_definition.items.range : params.property_definition.range;
                                        //instead we fetch the actual applied schema per entity
                                        let schema_cache = {};
                                        let page_schemas = {};
                                        mwjson.api.getPages(changed).then((pages) => {
                                            let edit_promises = [];
                                            let schema_promises = [];
                                            for (let page of pages) {
                                                let page_jsondata = page.slots["jsondata"];
                                                if (mwjson.util.isString(page_jsondata)) page_jsondata = JSON.parse(page_jsondata);

                                                if (!page_jsondata["type"]) {
                                                    console.warn("No type specified - cannot auto-edit entity");
                                                    continue;
                                                }
                                                let jsonschema = {allOf: []};
                                                if (mwjson.util.isString(page_jsondata["type"])) page_jsondata["type"] = [page_jsondata["type"]];
                                                for (const title of page_jsondata["type"]) {
                                                    let schema_url = mwjson.util.getAbsolutePageUrl("Special:SlotResolver", true) + "/" + title.replace(":", "/");
                                                    schema_url += title.startsWith("JsonSchema:") ? ".slot_main.json" : ".slot_jsonschema.json";
                                                    jsonschema.allOf.push({"$ref": schema_url});
                                                }
                                                const schema_hash = JSON.stringify(jsonschema);
                                                let schema_promise = new Promise((resolve, reject) => {
                                                    new Promise((resolve, reject) => {
                                                        if (schema_cache[schema_hash]) {
                                                            console.log("Schema cache match");
                                                            resolve(schema_cache[schema_hash]);
                                                        }
                                                        else {
                                                            let schema = new mwjson.schema({jsonschema: jsonschema})
                                                            schema.bundle()
                                                            .then(() => schema.preprocess())
                                                            .then(() => { schema_cache[schema_hash] = schema; resolve(schema_cache[schema_hash]); })
                                                            .catch((err) => { console.error(err); reject(err); });
                                                        }
                                                    }).then((schema) => {
                                                        page_schemas[page.title] = schema;
                                                        resolve();
                                                    });
                                                });
                                                schema_promises.push(schema_promise);
                                            }
                                            Promise.allSettled(schema_promises).then(() => {
                                                for (let page of pages) {
                                                    //const target_key = "organization";
                                                    let page_jsondata = page.slots["jsondata"];
                                                    if (mwjson.util.isString(page_jsondata)) page_jsondata = JSON.parse(page_jsondata);

                                                    const schema = page_schemas[page.title]
                                                    if (!schema) {
                                                        console.warn("No schema for page '" + page.title + "' found.");
                                                        continue;
                                                    }
                                                    let target_key = null;
                                                    //reverse_lookup_property
                                                    for (const ck of Object.keys(schema._context)) {
                                                        if (schema._context[ck] === reverse_lookup_property || schema._context[ck]["@id"] === reverse_lookup_property)
                                                            target_key = ck.replaceAll("*", "");
                                                    }
                                                    if (!target_key) {
                                                        console.warn("Target key from reverse lookup '" + reverse_lookup_property + "' not found.");
                                                        continue;
                                                    }
                                                    let property_definition = null;
                                                    schema._interateSchema({schema: schema.getSchema(), callback: {
                                                        onProperty: (params) => {
                                                            if (params.property_key === target_key) property_definition = params.property_definition;
                                                        }
                                                    }});
                                                    if (!property_definition) {
                                                        console.warn("Property definition of target key '" + target_key + "' not found.", schema);
                                                        continue;
                                                    }
                                                    if (added.includes(page.title)) {
                                                        let current_value = page_jsondata[target_key];
                                                        if (property_definition["type"] == "string") current_value = this.config.target;
                                                        if (property_definition["type"] == "array") current_value = [...current_value ? current_value : [], ...[this.config.target]];
                                                        page_jsondata[target_key] = current_value;
                                                    }
                                                    if (removed.includes(page.title)) {
                                                        let current_value = page_jsondata[target_key];
                                                        if (current_value) {
                                                            if (mwjson.util.isString(current_value)) delete page_jsondata[target_key];
                                                            if (mwjson.util.isArray(current_value)) {
                                                                current_value = current_value.filter(e => e !== this.config.target);
                                                                page_jsondata[target_key] = current_value;
                                                            }
                                                        }
                                                    }
                                                    page.slots["jsondata"] = page_jsondata;
                                                    edit_promises.push(mwjson.api.editSlots(page, "reverse edit"));
                                                    
                                                }
                                                Promise.allSettled(edit_promises).then(() => resolve());
                                            });
                                        });
                                    });
                                    fetch_promises.push(fetch_promise);
                                };
                                // this.log("Delete key '" + params.property_key + "' from jsondata");
                                if (jsondata[params.property_key]) delete jsondata[params.property_key];
                            }
                        }
                    }
                }
            }})

            Promise.allSettled(fetch_promises).then(() => {
                // this.log("storeAndRemoveReverse finish");
                resolve(jsondata);
            });
        });
        return promise;
    }

    getCategories(args = {}) {
        var jsonschema = mwjson.util.defaultArg(this.getSchema(), {});
        var includeNamespace = mwjson.util.defaultArg(args.includeNamespace, false);

        var categories = [];
        var allOf = jsonschema['allOf'];
        if (mwjson.util.isDefined(allOf)) {
            if (!mwjson.util.isArray(allOf)) allOf = [allOf]; // "allOf": {"$ref": "/wiki/Category:Test?action=raw"}
            for (const e of allOf) {
                for (const [p, v] of Object.entries(e)) { // "allOf": [{"$ref": "/wiki/Category:Test?action=raw"}]
                    if (p === '$ref') {
                        console.log("Test");
                        let match = this.title_regex.exec(v);
                        if (match && match.groups && match.groups.title) {
                            var category = match.groups.title;  // e.g. "Category:Test"
                            if (!includeNamespace) { category = category.replaceAll("Category:", "") };
                            categories.push(category);
                        }
                    }
                }
            }
        }

        return { categories: categories };
    }

    _buildContext(args) {
        var schema = mwjson.util.defaultArg(args.jsonschema, {});
        var context = mwjson.util.defaultArg(schema['@context'], {});
        if (mwjson.util.isObject(context)) return {context:context};
        var result = {};
        var index = 0;
        for (var subcontext of context) {
            if (mwjson.util.isString(subcontext)){
                result["" + index] = subcontext;
                index++;
            } 
            else result = mwjson.util.mergeDeep(result, subcontext)
        }
        return {context:result}
    }

    //maps jsondata values to semantic properties by using the @context attribute within the schema
    //test: console.log(p.getSemanticProperties({jsonschema={["@context"]={test="property:TestProperty"}}, jsondata={test="TestValue"}}))
    _getSemanticProperties(args) {
        var jsondata = mwjson.util.defaultArg(args.jsondata, {});
        var schema = mwjson.util.defaultArg(args.schema, {});

        var debug = mwjson.util.defaultArg(args.debug, true);

        args.properties = args.properties || {}; //semantic properties
        args.property_data = args.property_data || {};
        var context = this._buildContext({jsonschema: schema}).context;

        if (schema.allOf) {
			if (Array.isArray(schema.allOf)) {
				for (const subschema of schema.allOf) {
                    args.schema = subschema;
					//mwjson.util.mergeDeep(this._getSemanticProperties(args), { properties: properties, definitions: property_data });
                    this._getSemanticProperties(args)
				}
			}
			else {
                args.schema = schema.allOf;
                //mwjson.util.mergeDeep(this._getSemanticProperties(args), { properties: properties, definitions: property_data });
                this._getSemanticProperties(args)
			}
		}

        if (mwjson.util.isDefined(context)) {

            var schema_properties = mwjson.util.defaultArg(schema.properties, {});
            if (debug) {
                for (const [k, v] of Object.entries(context)) {
                    this.log("" + k + " maps to " + v);
                    if (mwjson.util.isNumber(k)) this.log("imports " + v)
                    else if (mwjson.util.isObject(v)) this.log("" + k + " maps to " + v["@id"]) 
                    else this.log("" + k + " maps to " + v)
                }
            }
            for (const [k, v] of Object.entries(jsondata)) {
                if (mwjson.util.isDefined(context[k])) {
                    if (debug) { this.log(context[k]) };

                    var property_definition = [];
                    if (mwjson.util.isObject(context[k])) property_definition = context[k]["@id"].split(':');
                    else property_definition = context[k].split(':');

                    if (property_definition[0] === 'Property') {
                        var property_name = property_definition[1];
                        args.properties[property_name] = v;
                        if (debug) { this.log("set " + property_name + " = " + v); }
                        var schema_property = mwjson.util.defaultArg(schema_properties[k], {});
                        //todo also load smw property type on demand
                        args.property_data[k] = { schema_data: schema_property, property: property_name, value: v };
                    }
                }
            }
        }

        return { properties: args.properties, definitions: args.property_data };
    }

    getSemanticProperties(args) {
        args = args || {};
        args.schema = this.getSchema();
        return this._getSemanticProperties(args);
    }

    getPropertyDefinition(property_name) {
        const jsonschema = this.getSchema();
        var res =  jsonpath.query(this.getSchema(), "$..properties." + property_name);
        if (mwjson.util.isArray(res) && res.length === 1) res = res[0]; //unwrap array - wrap option may not work as expected: https://github.com/JSONPath-Plus/JSONPath/issues/72
        return res;
    }

    getSemanticQuery(args) {
        var jsondata = mwjson.util.defaultArg(args.jsondata, {})
        //var schema = mwjson.util.defaultArg(args.jsonschema, {})
        var res = "";
        var where = "";
        var or_where = "";
        var select = "";
        var or_select = "";

        if (jsondata.type) { //handle categories: "type": ["Category:SomeCategory"] => [[Category:SomeCategory]]
            for (const t of jsondata.type) where = where + "\n[[" + t + "]]";
        };
        or_where += where;

        var semantic_properties = this.getSemanticProperties(args);
        //this.log(semantic_properties)
        for (const [k, def] of Object.entries(semantic_properties.definitions)) {
            // see also: https://www.semantic-mediawiki.org/wiki/Help:Search_operators
            var filter = mwjson.util.defaultArgPath(def.schema_data, ['options', 'role', 'query', 'filter'], 'eq');
            var value = def.value;
            if (def.schema_data.type === 'integer' || 
                def.schema_data.type === 'number' ||
                (def.schema_data.type === 'string' && def.schema_data.format && (def.schema_data.format === 'number' || def.schema_data.format.startsWith('date')))) {
                if (filter === 'min') value = ">" + value;
                else if (filter === 'max') value = "<" + value;
                else value = value; //exact match
            }
            else if (def.schema_data.type === 'string' && def.schema_data.format !== 'autocomplete') {
                value = "~*" + value + "*";
            }
            where = where + "\n[[" + def.property + "::" + value + "]]";
            or_where = or_where + "\n[[Has_subobject." + def.property + "::" + value + "]]"; //property chain with build-in property "Has subobject" to include matching subobjects. ToDo: do this only for subobjects within the schema
            select = select + "\n|?" + def.property;
            or_select = or_select + "\n|?Has_subobject." + def.property;
            if (mwjson.util.isDefined(def.schema_data.title)) { select = select + "=" + def.schema_data.title }
        }
        where = where + "OR" + or_where;
        select = select + or_select;

        var options = "";
        options += "|default=No results";
        options += "|format=datatable"; //requires smw modules
        options += "|theme=bootstrap";
        options += "|limit=1000";

        if (where !== "") { res = "{{#ask:" + res + where + select + options + "}}" }

        return { wikitext: res };
    }

    static getAutocompleteQuery(subschema) {
        if (subschema.query) { //legacy (deprecated)
            console.log("Warning: schema.query is deprecated. Use schema.options.autocomplete.query")
            return subschema.query; 
        }

        // ToDo: move to jsoneditor options
        const defaultFilter = "[[HasNormalizedLabel::like:*{{{_user_input_normalized_tokenized}}}*]]";
        const defaultProperties = {
            "label": "HasLabel",
            "image": "HasImage",
            "description": "HasDescription",
            "type": "HasType.Display_title_of" // ToDo: Change to HasType.HasLabel - currently leads to SMW exceptions, see https://github.com/SemanticMediaWiki/SemanticMediaWiki/issues/5713
        }
        const defaultOptions = {
            "limit": "10"
        }
        var res = "";
        if (subschema.options?.autocomplete?.query_filter_property) {
            res += "[[" + subschema.options.autocomplete.query_filter_property + "::like:*{{{_user_input}}}*]]"
        }
        if (subschema.options?.autocomplete?.query) {
            res += subschema.options.autocomplete.query;
        }
        else if (
            (subschema.range && mwjson.util.isString(subschema.range))
            || (subschema.subclassof_range && mwjson.util.isString(subschema.subclassof_range))
            ) { // ToDo: handle multiple entries connected with OR or AND
            if (subschema.subclassof_range) {
                //if (subschema.range) res += "[[SubClassOf.HasMetaCategory::" + subschema.range + "]]" + "OR[[SubClassOf.SubClassOf.HasMetaCategory::" + subschema.range + "]]"
                //else 
                res += "[[SubClassOf::" + subschema.subclassof_range + "]]" 
                + "OR[[SubClassOf.SubClassOf::" + subschema.subclassof_range + "]]"
                + "OR[[SubClassOf.SubClassOf.SubClassOf::" + subschema.subclassof_range + "]]"
                + "OR[[SubClassOf.SubClassOf.SubClassOf::" + subschema.subclassof_range + "]]"
                + "OR[[SubClassOf.SubClassOf.SubClassOf.SubClassOf::" + subschema.subclassof_range + "]]"
                + "OR[[SubClassOf.SubClassOf.SubClassOf.SubClassOf.SubClassOf::" + subschema.subclassof_range + "]]"
            }
            else res += "[[" + subschema.range + "]]"
        }
        else if (subschema.options?.autocomplete?.category) {
            res += "[[" + subschema.options.autocomplete.category + "]]"
        }
        else if (subschema.options?.autocomplete?.property) res += "[[" + subschema.options.autocomplete.property + ":+]]"

        if (!res.includes("_user_input")) res = res.replace(/(?<!\|)\|(?!\|)/, defaultFilter + "|"); // inject before first property selector or param (match the first non-doubled '|') [[A]]|?... => [[A]][[...like...]]|?...
        if (!res.includes("_user_input")) res += defaultFilter; // no property selector or param found: just append it
        res = res.replaceAll(/\]\s*OR\s*\[/g, "]"+defaultFilter + "OR["); // inject on every OR condition: [[A]]OR[[B]][[...like...]]=>[[A]][[...like...]]OR[[B]][[...like...]]

        for (const key of Object.keys(defaultProperties)) {
            if (!res.match(RegExp("\\|\\s*\\?\\s*[^=]+\\s*=\\s*" + key))) res += "|?" + defaultProperties[key] + "=" + key; // add e. g. '|?Display_title_of=label' if not present
        }
        for (const key of Object.keys(defaultOptions)) {
            if (!res.match(RegExp("\\|\\s*\\s*[^=]+\\s*=\\s*" + key))) res += "|" + key + "=" + defaultOptions[key]; // add e. g. '|?limit=10' if not present
        }

        if (res === "") res = defaultFilter;
        return res;
    }
    static getAutocompletePreviewTemplate(subschema) {
        if (subschema.previewWikiTextTemplate) { //legacy (deprecated)
            console.log("Warning: schema.previewWikiTextTemplate is deprecated. Use schema.options.autocomplete.render_template")
            return {type: ["handlebars", "wikitext"], value: subschema.previewWikiTextTemplate}; 
        }
        else if (subschema.options) {
            if (subschema.options.autocomplete) {
                if (subschema.options.autocomplete.render_template) return subschema.options.autocomplete.render_template;
            }
        }
        return {type: ["handlebars"], value: "" +
        '<div class="mw-parser-output" {{#if result.printouts.image.[0].fulltext}}style="min-height: 66px;"{{/if}}>' +
        '{{#if result.printouts.image.[0].fulltext}}<div class="floatright">' +
        '<img style="height:66px" src="' + mw.config.get("wgScriptPath") + '/index.php?title=Special:Redirect/file/{{result.printouts.image.[0].fulltext}}&width=100&height=50"></img></div>{{/if}}' +
        "<strong>{{result.printouts.label.[0]}}<a href='./{{result.fulltext}}' class='external' target='_blank' ></a></strong>" + 
        "{{#if result.printouts.type.[0]}} ({{result.printouts.type.[0]}}){{/if}}" + 
        "{{#if result.printouts.description.[0]}}<br><em>{{result.printouts.description.[0]}}</em>{{/if}}</div>"
        };
    }
    static getAutocompleteLabelTemplate(subschema) {
        if (subschema.labelTemplate) { //legacy (deprecated)
            console.log("Warning: schema.labelTemplate is deprecated. Use schema.options.autocomplete.label_template")
            return {type: ["handlebars"], value: subschema.labelTemplate}; 
        }
        else if (subschema.options) {
            if (subschema.options.autocomplete) {
                if (subschema.options.autocomplete.label_template) return subschema.options.autocomplete.label_template;
            }
        }
        return {type: ["handlebars"], value: "" +
        "{{#if result.printouts.label.[0]}}{{result.printouts.label.[0]}}" + 
        "{{else if result.displaytitle}}{{result.displaytitle}}" +
        "{{else}}{{result.fulltext}}{{/if}}"};
    }
    static getAutocompleteStoreTemplate(subschema) {
        if (subschema.options) {
            if (subschema.options.autocomplete) {
                if (subschema.options.autocomplete.store_template) return subschema.options.autocomplete.store_template;
            }
        }
    }
    static getAutocompleteResultProperty(subschema) {
        if (subschema.listProperty) { //legacy (deprecated)
            console.log("Warning: schema.listProperty is deprecated. Use schema.options.autocomplete.result_property")
            return {type: ["handlebars"], value: subschema.labelTemplate}; 
        }
        else if (subschema.options) {
            if (subschema.options.autocomplete) {
                if (subschema.options.autocomplete.label_template) return subschema.options.autocomplete.label_template;
            }
        }
    }

    log(arg) {
        if (this.debug) console.log(arg);
    }

}

//mwjson.schema.selftest();