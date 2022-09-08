mwjson.util = class {
	constructor() {
	}
	
	static getShortUid() {
		return (performance.now().toString(36) + Math.random().toString(36)).replace(/\./g, "");
	}

	static valueIfExists(value, default_value = "") {
		if (value) return value;
		else return default_value;
	}

	static stripNamespace(title) {
		return title.split(":")[title.split(":").length - 1]
	}
}
