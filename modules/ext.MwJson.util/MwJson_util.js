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
        return "OSL" + mwjson.util.uuidv4().replaceAll("-","");
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
