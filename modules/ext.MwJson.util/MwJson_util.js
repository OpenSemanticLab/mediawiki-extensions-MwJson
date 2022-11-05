mwjson.util = class {
	constructor() {
	}

	static getShortUid() {
		return (performance.now().toString(36) + Math.random().toString(36)).replace(/\./g, "");
	}

	static uuidv4() {
		return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
			(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
		);
	}

	static OslId() {
		return "OSL" + mwjson.util.uuidv4().replaceAll("-", "");
	}

	static valueIfExists(value, default_value = "") {
		if (value) return value;
		else return default_value;
	}

	static stripNamespace(title) {
		return title.split(":")[title.split(":").length - 1]
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

	//from https://stackoverflow.com/questions/27936772/how-to-deep-merge-instead-of-shallow-merge
	static mergeDeep(target, source) {
		let output = Object.assign({}, target);
		if (mwjson.util.isObject(target) && mwjson.util.isObject(source)) {
			Object.keys(source).forEach(key => {
				if (mwjson.util.isObject(source[key])) {
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

	static addBarLink(config) {
		var defaultConfig = {
			"location": "#p-cactions",
			"label": "Link"
		};
		var config = { ...defaultConfig, ...config };
		console.log(config);
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
}
