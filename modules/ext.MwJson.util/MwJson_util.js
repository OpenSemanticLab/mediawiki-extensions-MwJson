mwjson.util = class {
	constructor() {
	}

	static getShortUid() {
		return (performance.now().toString(36) + Math.random().toString(36)).replace(/\./g, "");
	}
 
	static uuidv4(prefixedUuid) {
		if (prefixedUuid) { //e. g. OSW83e54febeb444c7484b3c7a81b5ba2fd
			var uuid = prefixedUuid.replace(/[^a-fA-F0-9]/g, '');
			uuid = uuid.slice(-32);
			uuid = uuid.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/g, '$1-$2-$3-$4-$5');
			return uuid;
		}
		else return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
			(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
		);
	}

	static OslId(uuid) {
		console.log("OslId is deprecated. Please use mwjson.util.OswId");
		return mwjson.util.OswId(uuid);
	}

	static OswId(uuid) {
		if (!uuid) uuid = mwjson.util.uuidv4();
		return "OSW" + uuid.replaceAll("-", "");
	}

	// see https://stackoverflow.com/questions/11652681/replacing-umlauts-in-js
	static replaceUmlaute(str) {

		const umlautMap  = {
			'\u00dc': 'UE',
			'\u00c4': 'AE',
			'\u00d6': 'OE',
			'\u00fc': 'ue',
			'\u00e4': 'ae',
			'\u00f6': 'oe',
			'\u00df': 'ss',
		}

		return str
			.replace(/[\u00dc|\u00c4|\u00d6][a-z]/g, (a) => {
			const big = umlautMap [a.slice(0, 1)];
			return big.charAt(0) + big.charAt(1).toLowerCase() + a.slice(1);
			})
			.replace(new RegExp('['+Object.keys(umlautMap ).join('|')+']',"g"),
			(a) => umlautMap [a]
			);
	}

	static isPascalCase(str) {
		return str.match(/[^a-zA-Z0-9]+(.)/g) === null 
		  && str.charAt(0).toUpperCase() == str.charAt(0);
	}
	
	static isCamelCase(str) {
		return str.match(/[^a-zA-Z0-9]+(.)/g) === null 
		  && str.charAt(0).toLowerCase() == str.charAt(0);
	}

	static toPascalCase(str) {
		str = mwjson.util.replaceUmlaute(str);
		if (!mwjson.util.isPascalCase(str)) {
			str = str.charAt(0).toUpperCase() + str.slice(1);
		}
		if (!mwjson.util.isPascalCase(str)) {
			var camelCase = mwjson.util.toCamelCase(str);
			str = camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
		};
		// make sure to remove all non-alphanums
		return str.replace(/[^a-zA-Z0-9]/g, "");
	}
	
	static toCamelCase(str) {
		str = mwjson.util.replaceUmlaute(str);
		if (!mwjson.util.isCamelCase(str)) {
			str = str.charAt(0).toLowerCase() + str.slice(1);
		}
		if (!mwjson.util.isCamelCase(str)) {
			str = str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
		}
		// make sure to remove all non-alphanums
		return str.replace(/[^a-zA-Z0-9]/g, "");
	}

	// makes all chars lowercase and removes non-alphanumeric
	static normalizeString(value) {
		return value.toLowerCase().replace(/[^0-9a-z]/gi, '');
	}

	// replaces spaces with '*', makes all chars lowercase and removes non-alphanumeric except '*'
	static normalizeAndTokenizeString(value) {
		return value.toLowerCase().replaceAll(' ', '*').replace(/[^0-9a-z*]/gi, '');
	}

	static valueIfExists(value, default_value = "") {
		if (value) return value;
		else return default_value;
	}

	static stripNamespace(title) {
		if (title.includes(":")) return title.replace(title.split(":")[0] + ":", "");
		else return title;
	}

	static objectToCompressedBase64(object) {
		return LZString.compressToBase64(JSON.stringify(object));
	}

	static objectFromCompressedBase64(base64) {
		return JSON.parse(LZString.decompressFromBase64(base64));
	}

	static isObject(item) {
		return (item && typeof item === 'object' && !Array.isArray(item));
	}

	static isObjLiteral(_obj) {
		var _test = _obj;
		return (typeof _obj !== 'object' || _obj === null ?
			false :
			(
				(function () {
					while (!false) {
						if (Object.getPrototypeOf(_test = Object.getPrototypeOf(_test)) === null) {
							break;
						}
					}
					return Object.getPrototypeOf(_obj) === _test;
				})()
			)
		);
	}

	static isArray(item) {
		return Array.isArray(item);
	}

	static isString(item) {
		return (typeof item === 'string' || item instanceof String)
	}

	static isInteger(item) {
		return Number.isInteger(item);
	}

	static isNumber(item) {
		return !isNaN(item);
	}

	static deepCopy(object) {
		if (object) return JSON.parse(JSON.stringify(object))
		else return object;
	}

	//from https://stackoverflow.com/questions/201183/how-to-determine-equality-for-two-javascript-objects
	static deepEqual(x, y) {
		const ok = Object.keys, tx = typeof x, ty = typeof y;
		return x && y && tx === 'object' && tx === ty ? (
		  ok(x).length === ok(y).length &&
			ok(x).every(key => mwjson.util.deepEqual(x[key], y[key]))
		) : (x === y);
	}

	static uniqueArray(array) {
		var result = []
		for (const item of array) {
			var add = true;
			for (const added_item of result) {
				if (mwjson.util.deepEqual(added_item, item)) {
					add = false;
					continue;
				}
			}
			if (add) result.push(item);
		}
		return result;
	}

	//from https://stackoverflow.com/questions/27936772/how-to-deep-merge-instead-of-shallow-merge
	static mergeDeep(target, source) {
		if (!target) return source;
		if (!source) return target;
		let output = Object.assign({}, target);
		if (mwjson.util.isObject(target) && mwjson.util.isObject(source)) {
			Object.keys(source).forEach(key => {
				if (mwjson.util.isArray(source[key]) && mwjson.util.isArray(target[key]) ) {
					if (!(key in target))
						Object.assign(output, { [key]: source[key] });
					else
						output[key] = mwjson.util.uniqueArray(target[key].concat(...source[key]));
				} else if (mwjson.util.isObject(source[key])) {
					if (!(key in target))
						Object.assign(output, { [key]: source[key] });
					else
						output[key] = mwjson.util.mergeDeep(target[key], source[key]);
				} else {
					Object.assign(output, { [key]: source[key] });
				}
			});
		}
		return output;
	}

	// creates a flat dict from a nested object
	// notation: dot => store.book[0].title
	// notation: bracket => ['store']['book'][0]['title']
	// array_index_notation: [0] => store.book[0].title
	// array_index_notation: .[0] => store.book.[0].title
	// array_index_notation: .0 => store.book.0.title
	static flatten(jsonObj, parentPath="", options = {array_index_notation: "[0]", notation: "dot" }, result = {}) {
		if (typeof jsonObj !== 'object' || jsonObj === null) {
			result[parentPath] = jsonObj;
			return result;
		}
	
		for (let key in jsonObj) {
			if (jsonObj.hasOwnProperty(key)) {
				let newKey;
				if (options.notation === "dot") newKey = parentPath ? `${parentPath}.${key}` : key;
				if (options.notation === "bracket") newKey = parentPath ? `${parentPath}[${key}]` : key;
				if (Array.isArray(jsonObj[key])) {
					jsonObj[key].forEach((item, index) => {
						mwjson.util.flatten(item, newKey + options.array_index_notation.replace("0", index), options, result);
					});
				} else if (typeof jsonObj[key] === 'object' && jsonObj[key] !== null) {
					mwjson.util.flatten(jsonObj[key], newKey, options, result);
				} else {
					result[newKey] = jsonObj[key];
				}
			}
		}
	
		return result;
	}

	// creates a nested object from a flat dict 
	// notation: dot => store.book[0].title
	// notation: bracket => ['store']['book'][0]['title']
	// array_index_notation: [0] => store.book[0].title
	// array_index_notation: .[0] => store.book.[0].title
	// array_index_notation: .0 => store.book.0.title
	static unflatten(flatObj, options = { array_index_notation: "[0]", notation: "dot" }) {
		const result = {};

		for (let flatKey in flatObj) {
			if (flatObj.hasOwnProperty(flatKey)) {
				const value = flatObj[flatKey];
				let keys;

				if (options.notation === "dot") {
					keys = flatKey.split('.');
				} else if (options.notation === "bracket") {
					keys = flatKey.match(/[^.[\]]+/g);
				}

				//console.log(keys);

				let current = result;

				for (let i = 0; i < keys.length; i++) {
					let key = keys[i];

					// Handle array index notation
					if (!isNaN(key.replace(/\.?\[(\d+)\]/, '$1'))) {
						key = parseInt(key.replace(/\.?\[(\d+)\]/, '$1'), 10);
					}
					keys[i] = key;
				}
				for (let i = 0; i < keys.length; i++) {
					let key = keys[i];
					if (i === keys.length - 1) {
						current[key] = value;
					} else {
						if (!current[key]) {
							// Determine if the next key is an array index
							if (!isNaN(keys[i + 1])) {
								current[key] = [];
							} else {
								current[key] = {};
							}
						}
						current = current[key];
					}
				}
			}
		}

		return result;
	}

	// replace " in string values with \" for processing with handlebars json templates
	static escapeDoubleQuotes(obj) {
		if (typeof obj === 'string') {
			// Escape double quotes in string
			return obj.replace(/"/g, '\\"');
		} else if (Array.isArray(obj)) {
			// Iterate over array elements
			return obj.map(mwjson.util.escapeDoubleQuotes);
		} else if (typeof obj === 'object' && obj !== null) {
			// Iterate over object properties
			const escapedObj = {};
			for (const key in obj) {
				if (obj.hasOwnProperty(key)) {
					escapedObj[key] = mwjson.util.escapeDoubleQuotes(obj[key]);
				}
			}
			return escapedObj;
		}
		// Return the value as is for non-string, non-object types
		return obj;
	}

	static isUndefined(arg) {
		return (arg === undefined || arg === null);
	}

	static isDefined(arg) {
		return !mwjson.util.isUndefined(arg);
	}

	static defaultArg(arg, default_value) {
		if (mwjson.util.isDefined(arg)) return arg; //special case: boolean false
		else return default_value;
	}

	// returns the value of a table (dict) path or default, if the path is not defined
	static defaultArgPath(arg, path, default_value) {
		if (mwjson.util.isUndefined(arg)) return default_value;
		else if (mwjson.util.isUndefined(path)) return arg;
		else {
			var key = path.shift();
			if (mwjson.util.isUndefined(key)) return arg;  //end of path
			return mwjson.util.defaultArgPath(arg[key], path, default_value);
		}
	}

	// creates a download dialog for any text
	static downloadTextAsFile(filename, text) {
		var element = document.createElement('a');
		element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
		element.setAttribute('download', filename);
		element.style.display = 'none';
		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);
	  }

	static getAbsolutePageUrl(title, params={}, pretty=true) {
		return mw.config.get("wgServer") + mwjson.util.getRelativePageUrl(title, params, pretty);//mw.util.getUrl(title, params);
	}

	static getRelativePageUrl(title, params={}, pretty=true, path_relative=false) {
		let url = "";
		if (pretty) {
			if (path_relative) url += "./" + encodeURI(title);
			else url += mw.config.get("wgArticlePath").replace("$1", encodeURI(title));
			let first = true;
			if (url.includes("?")) first = false; //e. g. index.php?title=...
			for (const p in params) {
				if (first) {
					url += "?";
					first = false;
				}
				else {url += "&";}
				url += p + "=" + encodeURIComponent(params[p]);
			}
		}
		else {
			url += "." + mw.config.get("wgScriptPath") + "/index.php?title=";
			url += encodeURIComponent(title);
			for (const p in params) {
				url += "&" + p + "=" + encodeURIComponent(params[p]);
			}
		}
		return url;
	}

	static addBarLink(config) {
		var defaultConfig = {
			"location": "#p-cactions",
			"label": "Link"
		};
		var config = { ...defaultConfig, ...config };
		if ($(defaultConfig.location).length === 0) return; //check if tool bar exists

		var $menu_entry = $(defaultConfig.location).find('ul').children().first().clone(); //find "more" page menu and clone first entry
		if (config.id) $menu_entry.attr('id', config.id);
		else $menu_entry.removeAttr('id');
		if ($menu_entry.length === 0) return; //check if entry exists

		var $link = $menu_entry.find('a');
		if ($link.length === 0) return; //check if link exists

		$link.text(config.label);
		if (config.href) $link.attr('href', config.href);
		else $link.removeAttr('href');
		if (config.onclick) $link[0].onclick = config.onclick;
		if (config.tooltip) $link.attr('title', config.tooltip);
		else $link.removeAttr('title');
		if (config.accesskey) $link.attr('accesskey', config.accesskey);
		else $link.removeAttr('accesskey');
		$(defaultConfig.location).find('ul').append($menu_entry); //insert entry
	}

	// filters result.printouts[key].["Language code"].item[0] for the preferred lang
	// falls back to en if preferred lang not found
	// stores result in plain string array compatible with non-multilang properties
	static normalizeSmwMultilangResult(result, preferred_lang_code="en") {
		if (!result.printouts) return "";
		// normalize multilanguage printouts (e. g. description)
		for (var key in result.printouts) {
			var is_multilang = false;
			var selected_value = "";
			var default_value = "";
			for (var e of Array.isArray(result.printouts[key]) ? result.printouts[key] : [result.printouts[key]]){
				if (e.Text && e["Language code"]) {
					is_multilang = true;
					if (e["Language code"].item[0] == preferred_lang_code) selected_value = e.Text.item[0];
					if (default_value === "") default_value = e.Text.item[0]; //set the first result as default (any lang)
					if (e["Language code"].item[0] == "en") default_value = e.Text.item[0]; //... but prefere 'en' if given

				}
			}
			if (is_multilang) {
				if (selected_value !== "") result.printouts[key] = [selected_value];
				else result.printouts[key] = [default_value];
			}
		}
		return result;
	}

	static setJsonEditorAutocompleteField(editor, value_id, value_label) {
		//console.log("Set value of ", editor.key,  " to value: ", value_id, " with label: ", value_label)
		editor.setValue(value_id, false, false, value_label);
	}
}
