/*@nomin*/

mwjson.parser = class {
	constructor() {

	}

	static init() {
		const deferred = $.Deferred();
		//if (!('ready' in mwjson.parser) || !mwjson.parser.ready) {
			/*window.CeL = {
				initializer: function () {
					CeL.run('application.net.wiki', function () {
						console.log("CeL ready");
						mwjson.parser.ready = true;
						deferred.resolve();
					});
				}
			};*/
			//$.getScript("https://kanasimi.github.io/CeJS/ce.js"); 
			//$.getScript("https://kanasimi.github.io/CeJS_wiki/CeJS_wiki.js"); //use minified standalone version
		//}
		//else 
		deferred.resolve(); //resolve immediately
		return deferred.promise();
	}

	static getTemplateNameWithNamespace(page, template)
	{
		const text = page.content;
		const regex = new RegExp("([a-zA-Z]+):" + template.replace(/\//g,'\\/'));
		var res = text.match(regex);
		if (res) return res[1] + ":" + template;
		else return template;
	}

	/* Simple parser functions */
	static getParamRegex(param) { 
		return new RegExp(`\h*${param}\h*=[^\|}\r\n\t\f\v]*`); //finds param=, param=value
	}
	
	static getParamValue(text, template, param, default_return=null) {
		const paramRegex = mwjson.parser.getParamRegex(param);
		if (!text.includes(param)) return default_return;
		var result = text.match(paramRegex)[0].split("=");
		if (result.length == 1) return "";
		else return result[1];
	}
	
	static updateParamValue(value, newValues, mode='replace', sep=';') {
		var result = [];
		if (mode === 'replace') { //replace old value(s) complete with new value(s)
			result = newValues;
		}
		else if (mode === 'append' //add new value(s) if not already set
			|| mode === 'remove') { //remove new value(s) if not already set
			result = [];
			if (value !== "") result = value.split(sep);
			for (let i=0; i<newValues.length; i++) {
				if (mode === 'append' && !result.includes(newValues[i])) result.push(newValues[i]);
				else if (mode === 'remove' && result.includes(newValues[i])) result.splice(result.indexOf(newValues[i]),1);
			}
		}
		var resultStr = "";
		for (let i=0; i<result.length; i++) {
			if (i > 0) resultStr += sep;
			resultStr += result[i];
		}
		return resultStr;
	}
	
	static updatePageText(text, template, params) {
		if (!text.includes(template)) text += `{{${template}\n}}`;
		for (let i=0; i<params.length; i++) {
			const param = params[i].name;
			const value = params[i].value;
			const paramRegex = mwjson.parser.getParamRegex(param);
			if (!text.includes(param)) text = text.replace("}}", `|${param}=${value}\n}}`);
			else text = text.replace(paramRegex,`${param}=${value}`);
		}
		return text;
	}

	/* complex parser functions, require CeL parser */

	static parseTemplateStructureRecursionFlat(page, template, debug = false) {
		if (template.name === undefined) {
			if (debug) console.log("text " + template);
			return template.toString();
		}
		else if (debug) {
			console.log("template " + template.page_title);
			//for (const key in template){ console.log("key " + key + " value " + template[key]);}
		}
		var result = {};
		var root = {};
		for (const key in template.parameters) {
			if (typeof template.parameters[key] === 'string') {
				root[key] = template.parameters[key];
				if (debug) console.log("key " + key + " = " + root[key] + " (string)");
			}
			else {
				if (template.parameters[key].type === 'transclusion') {
					root[key] = [mwjson.parser.parseTemplateStructureRecursionFlat(page, template.parameters[key], debug)]; //array with len 1
					if (debug) console.log("key " + key + " = " + root[key] + " (transclusion / single template)");
				}
				if (template.parameters[key].type === 'plain') {
					if (debug) console.log("key " + key + " (plain / template list)");
					var params = [];
					var i_template = 0;
					while (template.parameters[key][i_template]) {
						//skip empty entries
						if (Array.isArray(template.parameters[key][i_template])) {
							if (template.parameters[key][i_template].type && template.parameters[key][i_template].type !== 'transclusion') { //e.g. 'list'
								if (params.length === 0) params.push("")
								params[params.length - 1] += template.parameters[key][i_template]; //append plain string
							}
							else {
								var res = mwjson.parser.parseTemplateStructureRecursionFlat(page, template.parameters[key][i_template], debug);
								//if (debug) console.log("res " +  i + " = " + stringifyObject(res));
								//if (debug) console.log(res);
								params.push(JSON.parse(JSON.stringify(res))); //clone obj
							}
						}
						else {
							if (params.length === 0) params.push("")
							params[params.length - 1] += template.parameters[key][i_template]; //append plain string
						}
						i_template += 1;
					}
					//if (debug) console.log("params " + stringifyObject(params));
					root[key] = params;
				}
			}
		}
		if (debug) console.log(root);
		result[mwjson.parser.getTemplateNameWithNamespace(page, template.name)] = root;
		return result;
	}

	static parsePage(page) {
		console.log("parsePage start");
		var containsTemplateTage = page.content.includes("<noinclude>") || page.content.includes("<includeonly>")
		if (containsTemplateTage) {
			page.content = page.content.replaceAll("<noinclude>", "<Xnoinclude>");
			page.content = page.content.replaceAll("</noinclude>", "<X/noinclude>");
			page.content = page.content.replaceAll("<includeonly>", "<Xincludeonly>");
			page.content = page.content.replaceAll("</includeonly>", "<X/includeonly>")
		}
		const parsed = CeL.wiki.parser(page.content);

		parsed.each('template', function (token, index, parent) { });
		var data = [];
		var i = 0;
		var string_res = "";
		while (parsed[i]) {
			//data[i] = {};
			//parseTemplateStructureRecursionFlat_old(data[i],parsed[i]);
			var res = mwjson.parser.parseTemplateStructureRecursionFlat(page, parsed[i], false);

			//concat all plain text
			if (typeof res === 'string') string_res += res;
			else {
				if (string_res !== "") data.push(string_res);
				string_res = "";
				data.push(res);
				//console.log(stringifyObject(res));
			}
			//data[i] = parsed[i]
			i += 1;
		}
		if (string_res !== "") data.push(string_res);
		page.dictType = "FLAT_ARRAY_TEMPLATE_KEY_DICT";
		if (containsTemplateTage) {
			var data_str = JSON.stringify(data);
			data_str = data_str.replaceAll("<Xnoinclude>", "<noinclude>");
			data_str = data_str.replaceAll("<X/noinclude>", "</noinclude>");
			data_str = data_str.replaceAll("<Xincludeonly>", "<includeonly>");
			data_str = data_str.replaceAll("<X/includeonly>", "</includeonly>");
			data = JSON.parse(data_str);
		}
		page.dict = data;
		//console.log("parsePage stop");
		return page;
	}

	static parsePageAsync(page) {
		return new Promise(resolve => {
			page = mwjson.parser.parsePage(page);
			resolve(page);
		});
	}

	static appendTemplate(p, template_name, template_params)
	{
		p.dict.push({template_name: template_params});
	}

	static appendText(p, text)
	{
		p.dict.push(text);
	}

	static updateContent(p)
	{
		var wt = "";
		for (var key in p['dict'])
		{
			var content_element = p['dict'][key];
			if (typeof content_element == "object") wt += mwjson.parser.getWikitextFromWikipageTemplateKeyDict(content_element);
			else if (typeof content_element == "string") wt += content_element;
			else console.log("Error: content element is not dict or string: " + content_element);
		}
		p.slots_changed['main'] = wt !== p.slots['main'];
		p.slots['main'] = wt;
		return wt;
	} 

	static getWikitextFromWikipageTemplateKeyDict(d, debug = false) {
		var wt = "";
		for (var key in d) {
			var value = d[key];
			if (debug) console.log("key: " + key + ", valuetype:" + (typeof value) + ", value:" + value);
			if (Array.isArray(value)) //handle first because arrays are also objects
			{
				if (debug) console.log("array");
				wt += "\n|" + key + "=";
				//var index = 0;
				for (var index = 0; index < value.length; index++) {
					//for (var element : value)
					//{
					var element = value[index];
					if (debug) console.log("index: " + index + ", elementtype:" + (typeof element) + ", element:" + element);
					if (typeof element == "object") {
						wt += mwjson.parser.getWikitextFromWikipageTemplateKeyDict(element);
					}
					else {
						if (index > 0) wt += ";";
						wt += element;
					}
					//index += 1;
				}
			}
			else if (typeof value == "object") {
				if (debug) console.log("dict");
				wt += "{{" + key;
				wt += mwjson.parser.getWikitextFromWikipageTemplateKeyDict(value);
				wt += "\n}}";
			}

			else {
				if (debug) console.log("literal");
				wt += "\n|" + key + "=" + value;
			}
		}
		return wt;
	}

	//from nodered json_page_op
	static update_object(root_object, path, newValue) {

		while (path.length > 1) {
			root_object = root_object[path.shift()];
		}
		root_object[path.shift()] = newValue;
	}

	static get_object(root_object, path) {

		while (path.length > 1) {
			root_object = root_object[path.shift()];
		}
		return root_object[path.shift()];
	}

	static get_template_index(p, template) {
		for (var p_index in p.dict) {
			var content_element = p.dict[p_index];
			for (var _template in content_element) {
				if (_template == template) {
					//console.log("Match: " + template)
					return p_index;
				}
			}
		}
	}

	static set_template_param(p, template, param_path, value) {
		if (!Array.isArray(param_path)) param_path = [param_path];
		mwjson.parser.update_object(p.dict, [mwjson.parser.get_template_index(p, template), template].concat(param_path), value);
	}

	static get_template_param(p, template, param_path) {
		if (!Array.isArray(param_path)) param_path = [param_path];
		return mwjson.parser.get_object(p.dict, [mwjson.parser.get_template_index(p, template), template].concat(param_path));
	}

	static append_to_template_param(p, template, param_path, value) {
		if (!Array.isArray(param_path)) param_path = [param_path];
		var org_value = mwjson.parser.get_object(p.dict, [mwjson.parser.get_template_index(p, template), template].concat(param_path));
		if (!Array.isArray(org_value)) org_value = [org_value];
		if (!Array.isArray(value)) value = [value];
		org_value = org_value.concat(value);
		mwjson.parser.update_object(p.dict, [mwjson.parser.get_template_index(p, template), template].concat(param_path), org_value);
	}

	static update_template_subparam_by_match(p, template, param_array_path, match, update) {
		if (!Array.isArray(param_array_path)) param_array_path = [param_array_path];
		var org_value = mwjson.parser.get_object(p.dict, [mwjson.parser.get_template_index(p, template), template].concat(param_array_path));
		//console.log(org_value);
		if (!Array.isArray(org_value)) { //flat template
			//console.log("flat template");
			for (var subparam in update) org_value[subparam] = update[subparam];
		}
		else { //template array
			//console.log("template array");
			for (var index in org_value) {
				for (var param_template in org_value[index]) {
					var allMatch = true;
					var anyMatch = false
					for (var match_param in match) {
						if (match_param in org_value[index][param_template] && org_value[index][param_template][match_param] == match[match_param]) {
							anyMatch = true;
							//console.log("Match " + match_param + " = " + match[match_param] + " at index " + index);
						}
						else {
							allMatch = false;
							//console.log("No match " + match_param + " = " + match[match_param] + " at index " + index);
						}
					}
					if (allMatch) {
						if (!update || Object.keys(update).length === 0) {
							console.log("Remove element");
							org_value.splice(index, 1); //update is empty, remove complete
						}
						else for (var subparam in update) org_value[index][param_template][subparam] = update[subparam];
					}
				}
			}
		}
		mwjson.parser.update_object(p.dict, [mwjson.parser.get_template_index(p, template), template].concat(param_array_path), org_value);
	}

	static wikiJson2SchemaJson(wikiJson, isRoot = true) {
		var schemaJson = {}
		if (mwjson.util.isObjLiteral(wikiJson[0]) === false 
		|| typeof wikiJson[1] !== 'string' 
		|| mwjson.util.isObjLiteral(wikiJson[2]) === false) {
			console.log("Error: Invalid wikiJson:", wikiJson);
			return schemaJson;
		}
		var schemaJson = {};

		schemaJson = mwjson.editor.mwjson.parser.wikiJson2SchemaJsonRecursion(wikiJson[0], wikiJson[2])
		schemaJson['osl_wikitext'] = wikiJson[1];
		return schemaJson;
	}

	static schemaJson2WikiJson(schemaJson, isRoot = true) {
		var wikiJson = [{}, "", {}]; //header, freetext, footer
		var template = "";
		var footer_template = "";
		if (Object.hasOwn(schemaJson, 'osl_template')) {
			template = schemaJson['osl_template'];
			wikiJson[0][template] = {};
		}
		else {
			console.log("Error: Mandatory property 'osl_template' not found in schemaJson", schemaJson);
			return;
		}
		if (Object.hasOwn(schemaJson, 'osl_wikitext')) wikiJson[1] = schemaJson['osl_wikitext'];
		if (Object.hasOwn(schemaJson, 'osl_footer')) {
			wikiJson[2] = mwjson.editor.mwjson.parser.schemaJson2WikiJson(schemaJson['osl_footer'], false)[0];
			footer_template = schemaJson['osl_footer']['osl_template'];
			wikiJson[2][footer_template]['extensions'] = [];
		}
		for (var key in schemaJson) {
			if (key.startsWith('_') || key.startsWith('osl_template') || key.startsWith('osl_wikitext') || key.startsWith('osl_footer')) continue;
			if (schemaJson[key] === undefined) continue;
			else if (typeof schemaJson[key] === 'string') wikiJson[0][template][key] = schemaJson[key];
			else if (typeof schemaJson[key] === 'number') wikiJson[0][template][key] = schemaJson[key];
			else if (Array.isArray(schemaJson[key])) {
				wikiJson[0][template][key] = [];
				schemaJson[key].forEach(subSchemaJson => {
					if (mwjson.util.isObjLiteral(wikiJson[0])) {
						var subWikiJson = mwjson.editor.mwjson.parser.schemaJson2WikiJson(subSchemaJson, false);
						wikiJson[0][template][key].push(subWikiJson[0]);
						if (key === "extensions") {
							wikiJson[2][footer_template]['extensions'].push(subWikiJson[2]);
						}
					}
					else wikiJson[0][template][key].push(subWikiJson); //Literal
				});
			}
			else { //object
				var subWikiJson = mwjson.editor.mwjson.parser.schemaJson2WikiJson(schemaJson[key], false);
				wikiJson[0][template][key] = [subWikiJson[0]]; //wikiJson defaults to arrays
			}
		}
		return wikiJson;
	}

	static data2template(data, isRoot = true) {
		var wikitext = "";
		if (data._template) {
			wikitext += "{{";
			wikitext += data._template;
		}
		for (var key in data) {
			if (key.startsWith('_')) continue;
			if (data._template) wikitext += "\n|" + key + "=";
			if (data[key] === undefined) continue;
			else if (typeof data[key] === 'string') wikitext += data[key];
			else if (typeof data[key] === 'number') wikitext += (data[key]);
			else if (Array.isArray(data[key])) {
				data[key].forEach(o => {
					wikitext += mwjson.editor.mwjson.parser.data2template(o, false);
					//console.log("Type of " + o + " is " + typeof o);
					if (o._template) { }
					else wikitext += ";";
				});
			}
			else wikitext += mwjson.editor.mwjson.parser.data2template(data[key], false);
			//wikitext += "\n";
		}
		if (data._template) {
			wikitext += "\n}}"
		}
		return wikitext;
	}

	static getTemplatePropertyMapping(schema) {
		var mapping = mwjson.editor.mwjson.parser.getPropertyTemplateMapping(schema);
		var inverse_mapping = {};
		for(var key in mapping){
			inverse_mapping[mapping[key]] = key;
		}
		return inverse_mapping;
	}

	static getPropertyTemplateMapping(schema) {
		//TODO: use jsonpath on schema
		var mapping = {
			"header": "OslTemplate:KB/Term",
			"footer": "OslTemplate:KB/Term/Footer"
		}
	}

	static pagedict2data(pagedict) {
		var data = {}
		var textkey = "text";
		var text_counter = 0;
		for (var key in pagedict)
		{
			var content_element = pagedict[key];
			if (typeof content_element == "object") wt += mwjson.parser.getWikitextFromWikipageTemplateKeyDict(content_element);
			else if (typeof content_element == "string") {
				text_counter += 1;
				data[textkey + text_counter] = content_element;
			}
			else console.log("Error: content element is not dict or string: " + content_element);
		}
	}

	static wikiJson2SchemaJsonRecursion(wikiJson, footerWikiJson = undefined) {
		var schemaJson = {}
		if (footerWikiJson != undefined) { 
			schemaJson['osl_footer'] = mwjson.editor.mwjson.parser.wikiJson2SchemaJsonRecursion(footerWikiJson);
			delete schemaJson['osl_footer']['extensions']; //not defined in schema
		}
		for (var key in wikiJson) {
			var value = wikiJson[key];
			if (Array.isArray(value)) //handle first because arrays are also objects
			{
				schemaJson[key] = [];
				for (var index = 0; index < value.length; index++) { //for (var element : value)
					var element = value[index];
					//if (debug) console.log("index: " + index + ", elementtype:" + (typeof element) + ", element:" + element);
					if (typeof element === "object") {
						if (key === "extensions") {
							if (footerWikiJson != undefined) { //we asume that every extension provides also a footer template
								var nextFooter = footerWikiJson[schemaJson['osl_footer']['osl_template']]['extensions'][index];
								schemaJson[key].push(mwjson.editor.mwjson.parser.wikiJson2SchemaJsonRecursion(element, nextFooter));
							}
						}
						else schemaJson[key].push(mwjson.editor.mwjson.parser.wikiJson2SchemaJsonRecursion(element));
					}
					else {
						schemaJson[key].push(element);
					}
				}

			}
			else if (typeof value === "object") {
				schemaJson = mwjson.editor.mwjson.parser.wikiJson2SchemaJsonRecursion(value, footerWikiJson);
				schemaJson['osl_template'] = key;
			}
			else {
				schemaJson[key] = value;
			}
		}

		for (key in schemaJson) {
			if (schemaJson[key] === "" && key === 'extensions') schemaJson[key] = [];
			//if (schemaJson[key] === "") delete schemaJson[key]; //schemaJson[key] = undefined; ////set properties with empty string to none
        	/*if (Array.isArray(schemaJson[key])) { //wikiJson defaults are lists, even for single or empty values
            	if (schemaJson[key].length == 0) delete schemaJson[key]
            	//else if len(schemaJson[key]) == 1: schemaJson[key] = schemaJson[key][0]
			}*/
		}

		return schemaJson;
	}
}
