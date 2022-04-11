mwjson.parser = class {
	constructor() {

	}
	
	static init() {
		const deferred = $.Deferred();
		if (!('ready' in mwjson.parser) || !mwjson.parser.ready) {
			window.CeL = { initializer: function() { CeL.run('application.net.wiki', function(){
				console.log("CeL ready");
				mwjson.parser.ready = true;
				deferred.resolve();
			}); }};
			$.getScript( "https://kanasimi.github.io/CeJS/ce.js" );
		}
		return deferred.promise(); 
	}
	
	static getTemplateNameWithNamespace(page, template) {
	    var text = page.content;
	    var regex = new RegExp("([a-zA-Z]+):" + template.replace(/\//g,'\\/'));
	    var res = text.match(regex);
	    if (res) return res[1] + ":" + template;
	    else return template;
	}


	static parseTemplateStructureRecursionFlat(page, template, debug = false) {
	    if (template.name === undefined) {
		if (debug) console.log("text " +  template);
			return template.toString();
	    }
	    else if (debug) {
			console.log("template " +  template.page_title); 
			//for (const key in template){ console.log("key " + key + " value " + template[key]);}
	    }
	    var result = {};
		var root = {};
		for (const key in template.parameters){
			if (typeof template.parameters[key] === 'string') {
			    root[key] = template.parameters[key];
			    if (debug) console.log("key " +  key + " = " + root[key] + " (string)");
			}
			else {
				if (template.parameters[key].type === 'transclusion') {
					root[key] = mwjson.parser.parseTemplateStructureRecursionFlat(page, template.parameters[key], debug);
					if (debug) console.log("key " +  key + " = " + root[key] + " (transclusion / single template)");
				}
				if (template.parameters[key].type === 'plain') {
				    if (debug) console.log("key " +  key + " (plain / template list)");
					var params = [];
					var i_template = 0;
					var i = 0;
					while(template.parameters[key][i_template]) {
						//skip empty entries
						if (Array.isArray(template.parameters[key][i_template])) {
							//root[key][i] = parseTemplateStructureRecursionFlat(template.parameters[key][i_template]);
							var res = mwjson.parser.parseTemplateStructureRecursionFlat(page, template.parameters[key][i_template], debug);
							//if (debug) console.log("res " +  i + " = " + stringifyObject(res));
							//if (debug) console.log(res);
							params.push(JSON.parse(JSON.stringify(res))); //clone obj
							i += 1;
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
		console.log("parsePage");
		console.log(CeL);
		const parsed = CeL.wiki.parser(page.content);
		parsed.each('template', function(token, index, parent) { });
		var data = [];
		var i = 0;
		var string_res = "";
		while(parsed[i])
		{
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
		page.contentParsed = data;
		return page;
	}

	static setWikitextFromContent(page)
	{
		var wt = "";
		for (var key in page['content'])
		{
			var content_element = page['content'][key];
			if (typeof content_element == "object") wt += mwjson.parser.getWikitextFromWikipageTemplateKeyDict(content_element);
			else if (typeof content_element == "string") wt += content_element;
			else node.warn("Error: content element is not dict or string: " + content_element);
		}
		page['original_content'] = page['content'];
		page['content'] = wt;
		return wt;
	}  

	static getWikitextFromWikipageTemplateKeyDict(d, debug = false)
	{
		var wt = "";
		for (var key in d)
		{
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
			else if (typeof value == "object")
			{
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
}
