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

}