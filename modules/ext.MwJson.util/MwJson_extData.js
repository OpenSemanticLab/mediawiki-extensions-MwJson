mwjson.extData = class {
    constructor() {
    }

    static getValue(data, path, mode) {
        var value = undefined;
        if (mode === 'jsonpath') value = jsonpath.query(data, path);
        else if (mode === 'xpath') {
            var value = [];
            let values = data.evaluate(path, data, null, XPathResult.ANY_TYPE, null);
            let node = undefined;
            while (node = values.iterateNext()) {
                value.push(node.textContent);
            }
        }
        if (value.length === 0) value = undefined;
        else if (value.length === 1) value = value[0];
        return value;
    }

    static mapObjectMap(obj, map, data, mode) {
        for (const [k, v] of Object.entries(map)) {
            if (mwjson.util.isString(v)) {
                var value = mwjson.extData.getValue(data, v, mode);
                if (mwjson.util.isArray(value)) value = mwjson.util.uniqueArray(value);
                obj[k] = value;
            }
            else if (mwjson.util.isObject(v)) {
                obj[k] = {};
                mwjson.extData.mapObjectMap(obj[k], v, data, mode);
            }
            else console.log("invalide map entry: ", v)
        }
    }

    static mapTemplateMap(obj, map, data, mode) {
        for (const [k, v] of Object.entries(map)) {
            if (mwjson.util.isString(v)) {
                const value = mwjson.extData.getValue(data, k, mode);
                console.log("eval ", k, " with ", value);
                const template = Handlebars.compile(v);
                obj = mwjson.util.mergeDeep(obj, JSON.parse(template(value)))
            }
            else console.log("invalide map entry: ", v)
        }
        return obj;
    }

    static fetchData(data_source_maps, jsondata) {
        const promise = new Promise((resolve, reject) => {
            var promises = [];

            for (const data_source of data_source_maps) {
                console.log(data_source);
                var url_template = Handlebars.compile(data_source.source);
                var url = url_template(jsondata);
                console.log(url);
                var contentType = undefined;
                data_source.mode = 'jsonpath';
                if (data_source.format === 'json') contentType = 'application/json';
                if (data_source.format === 'jsonld') contentType = 'application/ld+json';
                else if (data_source.format === 'xml') {
                    contentType = 'application/xml';
                    data_source.mode = 'xpath';
                }
                else if (data_source.format === 'html') {
                    contentType = 'application/html';
                    data_source.mode = 'xpath';
                }

                var headers = {};
                if (contentType) headers['Content-Type'] = contentType;

                var options = {};
                options.headers = headers;

                if (data_source.request_object_map) {
                    options.body = {};
                    mwjson.extData.mapObjectMap(options.body, data_source.request_object_map, jsondata, 'jsonpath');
                    options.body = JSON.stringify(options.body);
                    options.method = 'POST';
                }
                
                const fetch_promise = new Promise(resolve => {
                    fetch(url, options)
                        .then(response => {
                            if (data_source.format === 'xml' || data_source.format === 'html') return response.text();
                            else return response.json();
                        })
                        .then(data => {
                            if (data_source.format === 'xml') {
                                var parser = new DOMParser();
                                data = data.replace(" xmlns=\"", " whocares=\"");
                                data = parser.parseFromString(data, 'text/xml');
                            }
                            if (data_source.format === 'html') {
                                var parser = new DOMParser();
                                data = parser.parseFromString(data, 'text/html');
                            }
                            resolve({ data_source: data_source, data: data })
                        }
                        );
                });
                promises.push(fetch_promise);
            }
            Promise.allSettled(promises).then((results) => {
                console.log(results);
                for (const result of results) {
                    const data = result.value.data;
                    const data_source = result.value.data_source;
                    var ext_jsondata = {};
                    if (data_source.object_map) mwjson.extData.mapObjectMap(ext_jsondata, data_source.object_map, data, data_source.mode);
                    if (data_source.template_map) ext_jsondata = mwjson.extData.mapTemplateMap(ext_jsondata, data_source.template_map, data, data_source.mode);
                    jsondata = mwjson.util.mergeDeep(jsondata, ext_jsondata);
                }
                resolve(jsondata);
            });
        });
        return promise;
    }

    static async getAiCompletion(params) {
        let editor = params.editor;
        let jsondata = editor.jsoneditor.getValue();
        // ToDo: inline files as base64 strings
        let jsonschema = editor.jsonschema.getSchema();
        let promt = "Complete the following data while keeping existing values:\n";
        promt += JSON.stringify(jsondata, null, 2)
        //console.log(jsondata, jsonschema);

        let org_data_flatten = mwjson.util.flatten(jsondata, "root", { notation: "dot", array_index_notation: ".0" });
        let fileFetchPromises = {};
        let fileDataUrls = [];
        for (const [key, value] of Object.entries(org_data_flatten)) {
            let subeditor = editor.jsoneditor.editors[key];
            if (!subeditor) {
                continue;
            }
            if (subeditor.schema?.format === 'url' && subeditor.schema?.options?.upload) {
                if (value.startsWith("File:")) {
                    fileFetchPromises[value] = fetch(mw.util.getUrl("Special:Redirect/file/" + value));

                }
            }
        }
        if (Object.values(fileFetchPromises).length) {
            const fileResults = await Promise.all(Object.values(fileFetchPromises));
            let readPromises = [];
            function readToDataUrl(response) {
                return new Promise(async function(resolve, reject) {
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = function() { resolve(reader.result); };
                    // TODO: hook up reject to reader.onerror somehow and try it
                    reader.readAsDataURL(blob);
                });
            }
            for (const resultValue of fileResults) {
                readPromises.push(readToDataUrl(resultValue));
            }
            const readResults = await Promise.all(readPromises);
            let index = 0;
            for (const resultValue of readResults) {
                
                const key = Object.keys(fileFetchPromises)[index];
                fileDataUrls.push({"name": key, "data_url": resultValue});
                index += 1;
            }
            //console.log(fileDataUrls);
        }

        let res = await fetch(params.aiCompletionApiUrl, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            method: "POST",
            body: JSON.stringify({ promt: promt, jsonschema: jsonschema, files: fileDataUrls })
        })
        let data = await res.json()

        // this will create subeditors for all suppied data
        editor.jsoneditor.setValue(data.result);

        let data_flatten = mwjson.util.flatten(data.result, "root", { notation: "dot", array_index_notation: ".0" });
        //console.log(data_flatten)

        let autocompleteQueryPromises = {};
        let hiddenFields = []; //hidden or invalid
        for (const [key, value] of Object.entries(data_flatten)) {
            let subeditor = editor.jsoneditor.editors[key];
            if (!subeditor) {
                // editor not visible
                hiddenFields.push(key);
                //console.log("Not found", key, " in ", editor.jsoneditor.editors);
                continue;
            }
            if (subeditor.schema?.format === 'url' && subeditor.schema?.options?.upload) {
                if (!value.startsWith("File:")) hiddenFields.push(key); //probably an url => remove
            }
            if (subeditor.format === 'autocomplete') {
                //query ids for labels put into autocomplete editors
                let query = mwjson.schema.getAutocompleteQuery(subeditor.schema);
                let input = value
                jsondata = mwjson.util.deepCopy(data.result);

                ///// From MwJson_editor

                //create a copy here since we add addition properties

                jsondata['_user_input'] = input; 
                jsondata['_user_input_lowercase'] = input.toLowerCase(); 
                jsondata['_user_input_normalized'] = mwjson.util.normalizeString(input); 
                jsondata['_user_input_normalized_tokenized'] = mwjson.util.normalizeAndTokenizeString(input); 
                //jsondata['_user_lang'] = jseditor_editor.jsoneditor.options.user_language; 
                var template = Handlebars.compile(query);
                query = template(jsondata);

                // detect direct inserted UUID patterns
                const uuid_regex = /([a-f0-9]{8})(_|-| |){1}([a-f0-9]{4})(_|-| |){1}([a-f0-9]{4})(_|-| |){1}([a-f0-9]{4})(_|-| |){1}([a-f0-9]{12})/gm;
                const matches = input.match(uuid_regex);
                if (matches && matches.length) {
                    let uuidQuery = ""
                    for (const match of matches) uuidQuery += "[[HasUuid::" + match.replace(uuid_regex, `$1-$3-$5-$7-$9`) + "]]OR";
                    uuidQuery = uuidQuery.replace(/OR+$/, ''); // trim last 'OR'
                    query = query.replace(query.split('|')[0].split(';')[0], uuidQuery); // replace filter ([[...]]) before print statements (|?...)
                }

                
                var url = mw.config.get("wgScriptPath") + `/api.php?action=ask&query=${query}`;
                //if (!url.includes("|limit=")) url += "|limit=100";
                url += "&format=json";

                /////////
                autocompleteQueryPromises[key] = fetch(url);


            }
        }
        if (Object.values(autocompleteQueryPromises).length) {
            const autocompleteResults = await Promise.all(Object.values(autocompleteQueryPromises));
            let jsonPromises = []
            for (const resultValue of autocompleteResults) {
                jsonPromises.push(resultValue.json());
            }
            const jsonResults = await Promise.all(jsonPromises);
            let index = 0;
            for (const resultValue of jsonResults) {
                //console.log(resultValue);
                const matches = Object.values(resultValue.query.results);
                const key = Object.keys(autocompleteQueryPromises)[index];
                if (matches.length) {
                    //console.log("Update ", ":",  data_flatten[key],  " => ", matches[0].fulltext);
                    data_flatten[key] = matches[0].fulltext;
                }
                else delete data_flatten[key]; //no result => remove 
                // ToDo: Autocreate entity with range schema
                index += 1;
            }
        }
        for (const hiddenField of hiddenFields) delete data_flatten[hiddenField];
        //console.log(data_flatten);
        jsondata = mwjson.util.unflatten(data_flatten, { notation: "dot", array_index_notation: ".0" })["root"];
        //console.log(jsondata);
        editor.jsoneditor.setValue(jsondata);
    }

}