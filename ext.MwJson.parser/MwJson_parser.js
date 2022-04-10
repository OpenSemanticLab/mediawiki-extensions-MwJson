mwjson.parser = class {
	constructor() {
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
			var value = d[key]
			if (debug) console.log("key: " + key + ", valuetype:" + (typeof value) + ", value:" + value);
			if (Array.isArray(value)) //handle first because arrays are also objects
			{
				if (debug) console.log("array")
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
				if (debug) console.log("dict")
				wt += "{{" + key;
				wt += mwjson.parser.getWikitextFromWikipageTemplateKeyDict(value);
				wt += "\n}}";
			}

			else {
				if (debug) console.log("literal")
				wt += "\n|" + key + "=" + value;
			}
		}
		return wt
	}
}
