/*@nomin*/

mwjson.schema = class {
    constructor(args) {
        var defaultConfig = {
			mode: "default", // options: default, query
			lang: "en"
		};
		this.config = mwjson.util.mergeDeep(defaultConfig, args.config);
        this.debug = mwjson.util.defaultArg(args.debug, false);
        var jsonschema = args.jsonschema || {};

        if (mwjson.util.isString(jsonschema)) jsonschema = JSON.parse(jsonschema);
        jsonschema.id = jsonschema.id || 'root';
        this._jsonschema = jsonschema;
    }

    static selftest() {
        console.log("mwjson.schema selftest");
        var jsonschema = {
            "@context": {
                test: "property:TestProperty",
                number_max: "property:HasNumber",
                date_min: "property:HasDate"
            },
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

    bundle() {
        //const deferred = $.Deferred();
        this.log("start bundle");
        const promise = new Promise((resolve, reject) => {

            if (this.getSchema()) {
                $RefParser.bundle(this.getSchema(), (error, schema) => {
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

    _preprocess(schema) {
		const translateables = ["title", "description"];
		if (schema.properties) {
			for (const property of Object.keys(schema.properties)) {
				
				for (const attr of translateables) {
					if (schema.properties[property][attr+"*"]) {
						if (schema.properties[property][attr+"*"][this.config.lang]) schema.properties[property][attr] = schema.properties[property][attr+"*"][this.config.lang];
					}
				}
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
                        schema.required = schema.required.filter(function(e) { return e !== property });
                    }
				}
			}
		}
		if (schema.allOf) {
			if (Array.isArray(schema.allOf)) {
				for (const subschema of schema.allOf) {
					this._preprocess(subschema)
				}
			}
			else {
				this._preprocess(subschema)
			}
		}
		return schema;
	}

    preprocess() {
        this.log("proprocess start");
        const promise = new Promise((resolve, reject) => {
            this.setSchema(this._preprocess(this.getSchema()));
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
            for (const [p, v] of Object.entries(allOf)) { // "allOf": [{"$ref": "/wiki/Category:Test?action=raw"}]
                if (p === '$ref') {
                    var category = v.split("Category:")[1].split('?')[0];  // e.g. "/wiki/Category:Test?action=raw"
                    if (includeNamespace) { category = "Category:" + category };
                    categories.push(category);
                }
            }
        }

        return { categories: categories };
    }

    //maps jsondata values to semantic properties by using the @context attribute within the schema
    //test: console.log(p.getSemanticProperties({jsonschema={["@context"]={test="property:TestProperty"}}, jsondata={test="TestValue"}}))
    _getSemanticProperties(args) {
        var jsondata = mwjson.util.defaultArg(args.jsondata, {});
        var schema = mwjson.util.defaultArg(args.schema, {});

        var debug = mwjson.util.defaultArg(args.debug, false);

        args.properties = args.properties || {}; //semantic properties
        args.property_data = args.property_data || {};

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

        if (mwjson.util.isDefined(schema['@context'])) {

            var schema_properties = mwjson.util.defaultArg(schema.properties, {});
            if (debug) {
                for (const [k, v] of Object.entries(schema['@context'])) {
                    this.log("" + k + " maps to " + v);
                }
            }
            for (const [k, v] of Object.entries(jsondata)) {
                if (mwjson.util.isDefined(schema['@context'][k])) {
                    if (debug) { this.log(schema['@context'][k]) };
                    var property_definition = schema['@context'][k].split(':');
                    if (property_definition[0] === 'property') {
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

    getSemanticQuery(args) {
        //var jsondata = mwjson.util.defaultArg(args.jsondata, {})
        //var schema = mwjson.util.defaultArg(args.jsonschema, {})
        var res = "";
        var where = "";
        var select = "";
        var semantic_properties = this.getSemanticProperties(args);
        //this.log(semantic_properties)
        for (const [k, def] of Object.entries(semantic_properties.definitions)) {
            // see also: https://www.semantic-mediawiki.org/wiki/Help:Search_operators
            var filter = mwjson.util.defaultArgPath(def.schema_data, ['options', 'role', 'query', 'filter'], 'eq');
            var value = def.value;
            if (def.schema_data.type === 'string' && (def.schema_data.format === 'number' || def.schema_data.format === 'date')) {
                if (filter === 'min') value = "<" + value;
                else if (filter === 'max') value = ">" + value;
                else value = value; //exact match
            }
            else if (def.schema_data.type === 'string') {
                value = "~*" + value + "*";
            }
            where = where + "\n[[" + def.property + "::" + value + "]]";
            select = select + "\n|?" + def.property;
            if (mwjson.util.isDefined(def.schema_data.title)) { select = select + "=" + def.schema_data.title }
        }
        if (where !== "") { res = "{{#ask:" + res + where + select + "}}" }
        return { wikitext: res };
    }

    log(arg) {
        if (this.debug) console.log(arg);
    }

}

//mwjson.schema.selftest();