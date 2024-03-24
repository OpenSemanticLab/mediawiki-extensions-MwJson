/*@nomin*/

mwjson.schema = class {
    constructor(args) {
        var defaultConfig = {
			mode: "default", // options: default, query
			lang: "en",
            use_cache: true, // use local store schema cache
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
                    this.cache.get(title).then((item) => callback(null, item.value));
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

        // translate attributes on property level ("title", "description", "enum_titles", "default", "inputAttributes")
		if (schema.properties) {
			for (const property of Object.keys(schema.properties)) {

                // handle properties of type object and oneOf/anyOf on property level
                this._preprocess({schema: schema.properties[property]});

                // handle array items
                if (schema.properties[property].items) { //} && schema.properties[property].items.properties) {
                    this._preprocess({schema: schema.properties[property].items});
                }

                // use text values in user language if provided
				for (const attr of translateables) {
					if (schema.properties[property][attr+"*"]) { //objects
						if (schema.properties[property][attr+"*"][this.config.lang]) schema.properties[property][attr] = schema.properties[property][attr+"*"][this.config.lang];
					}
                    if (schema.properties[property].options) { //options
                        if (schema.properties[property].options[attr+"*"])
						    if (schema.properties[property].options[attr+"*"][this.config.lang]) 
                                schema.properties[property].options[attr] = schema.properties[property].options[attr+"*"][this.config.lang];
					}
                    if (schema.properties[property].properties) {  //subobject
                        this._preprocess({schema: schema.properties[property]});
                    }
                    if (schema.properties[property].items) { //} && schema.properties[property].items.properties) { //array items
                        this._preprocess({schema: schema.properties[property].items});
                        /*if (schema.properties[property].items.properties[attr+"*"]) { 
						    if (schema.properties[property].items.properties[attr+"*"][this.config.lang]) schema.properties[property].items.properties[attr] = schema.properties[property].items.properties[attr+"*"][this.config.lang];
                        }
                        if (schema.properties[property].items.options && schema.properties[property].items.options[attr+"*"]) { //options
                            if (schema.properties[property].items.options[attr+"*"][this.config.lang]) schema.properties[property].items.options[attr] = schema.properties[property].items.options[attr+"*"][this.config.lang];
                        }*/
					}

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
                
                // handle select input elements
                if (schema.properties[property].type === "array" && schema.properties[property].uniqueItems === true && schema.properties[property].items?.enum) {
                    schema.properties[property].format = "selectize"; // auto-set currently supported select input lib
                }

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
        if (schema['@context']) this._context = mwjson.util.mergeDeep(schema['@context'], this._context); // merge nested context over general context
        if (schema.uuid) this.subschemas_uuids.push(schema.uuid);
        if (schema.data_source_maps) this.data_source_maps = this.data_source_maps.concat(schema.data_source_maps);
		return schema;
	}

    preprocess() {
        this.log("proprocess start");
        const promise = new Promise((resolve, reject) => {
            this.setSchema(this._preprocess({schema: this.getSchema()}));
            this.log("proprocess finish");
            resolve();
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
            "description": "HasDescription"
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