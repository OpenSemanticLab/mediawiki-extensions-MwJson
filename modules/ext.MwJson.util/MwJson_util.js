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

	static objectToCompressedBase64(object) {
		return LZString.compressToBase64(JSON.stringify(object));
	}

	static objectFromCompressedBase64(base64) {
		return JSON.parse(LZString.decompressFromBase64(base64));
	}
}
