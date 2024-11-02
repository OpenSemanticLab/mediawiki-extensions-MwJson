/*
  This class implements a local store cache for page slots
*/
/*mwjson = {

}
window.mwjson = mwjson;*/
mwjson.Cache = class {
    constructor(id, config = { debug: false, maxage: 1000 * 60 * 60 * 24 * 30 /* 4 weeks */ }) {
        this.id = id;
        this.data = {
            "meta": {},
            "value": {}
        };
        this.hash = {};
        this.config = config;
    }
    _store(key, value, meta = {}) {
        let data = {
            "meta": meta,
            "value": value
        };
        if (this.config.debug) console.log("Store ", key, ":", data);
        localStorage.setItem(key, JSON.stringify(data));
    }
    _load(key) {
        let data = localStorage.getItem(key);
        if (data) {
            data = JSON.parse(data);
        }
        if (this.config.debug) console.log("Load ", key, ":", data);
        return data ? data.value : data;
    }
    _put(key, value, meta = {}, store = true) {
        meta.timestamp = new Date().getTime();
        let hash = this.getHash(key);
        if (!meta.hash && hash) meta.hash = hash;
        this.setHash(key, hash);
        let item = { "value": value, "meta": meta };
        this.data.value[key] = item;
        if (this.config.debug) console.log("Put ", key, ": ");//, item);
        if (store) this.store();
    }
    put(items, store = true) {
        for (let key in items) {
            let item = items[key];
            this._put(key, item.value, item.meta, false);
        }
        if (store) this.store();
    }
    async get(keys, params = {}, load = true) {
        if (load) this.load();
        let return_single = false;
        if (typeof keys === 'string') {
            keys = [keys];
            return_single = true;
        }
        let items = {};
        let to_fetch = [];
        for (let key of keys) {
            let item = this.data.value[key];
            if (item) {
                if (params.maxage) {
                    const now = new Date();
                    // compare the expiry time of the item with the current time
                    if (now.getTime() - params.maxage > item.meta.timestamp) {
                        if (this.config.debug) console.log("Expired:", now.getTime() - params.maxage, " > ", item.meta.timestamp);
                        item = null;
                    }
                }
                if (item && item.meta.hash) {
                    let hash = this.getHash(key)
                    if (params.hash) hash = params.hash;
                    // compare the expiry time of the item with the current time
                    if (hash && item.meta.hash !== hash) {
                        if (this.config.debug) console.log("Changed");
                        item = null;
                    }
                }
            }
            if (item) {
                if (this.config.debug) console.log("From cache: " + key);
                items[key] = item;
            }
            else {
                if (this.config.debug) console.log("Fetch: " + key);
                to_fetch.push(key);
            }
        }
        let fetched_items = to_fetch.length ? await this.fetchItems(to_fetch) : {};
        this.put(fetched_items);
        for (let key of to_fetch) {
            items[key] = fetched_items[key];
        }
        if (return_single) return items[keys[0]];
        return items;
    }
    store() {
        localStorage.setItem(this.id, JSON.stringify(this.data));
    }
    load() {
        let loadedString = localStorage.getItem(this.id, JSON.stringify(this.data));
        if (loadedString) {
            this.data = JSON.parse(loadedString)
        }
    }
    // this will delete all cached entries
    clear() {
        localStorage.removeItem(this.id);
    }
    
    // this will delete all changed or outdated entries
    cleanup() {
        this.load();
        for (let key in this.data.value) {
            if (this.getHash(key) && this.data.value[key].meta?.hash)
                if (this.getHash(key) !== this.data.value[key].meta?.hash) {
                    delete this.data.value[key];
                    if (this.config.debug) console.log("Delete ", key, " from store because hash has changed");
                }
            if (this.data.value[key]?.meta?.timestamp)
                if (new Date().getTime() - this.config.maxage > this.data.value[key]?.meta?.timestamp) {
                    delete this.data.value[key];
                    if (this.config.debug) console.log("Delete ", key, " from store because maxage was reached");
                }
        }
        this.store();
    }
    setHash(key, hash) {
        this.hash[key] = hash;
        if (this.config.debug) console.log("Set hash ", key, " :", hash)
    }
    getHash(key) {
        return this.hash[key];
    }
    getKeys(load = true) {
        this.load()
        let keys = []
        for (let key in this.data.value) keys.push(key);
        return keys;
    }
    async fetchHashes() {
        let keys = this.getKeys();
        if (keys.length === 0) return;
        let titles = keys.join("|");
        let url = mw.config.get("wgScriptPath") + "/api.php?action=query&format=json&prop=revisions&rvprop=ids%7Ctimestamp%7Csha1";
        url += "&titles=" + encodeURIComponent(titles);
        if (this.config.debug) console.log("Fetch: " + url)
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (this.config.debug) console.log(data);
                for (const page_key in data.query.pages) {
                    let page = data.query.pages[page_key];
                    let key = page.title;
                    if (page.revisions) {
                        let hash = page.revisions[0].sha1;
                        this.setHash(key, hash);
                    }
                    else {
                        delete this.data.value[key];
                        if (this.config.debug) console.log("Delete ", key, " from store because it does no longer exist on the server");
                    }
                }
            }
            );
    }
    async fetchItems(keys) {
        //let keys = this.getKeys();
        let titles = keys.join("|");
        let url = mw.config.get("wgScriptPath") + "/api.php?action=query&format=json&prop=revisions&rvprop=ids|timestamp|sha1|content&rvslots=main|jsonschema";
        url += "&titles=" + encodeURIComponent(titles);

        let items = {}

        const response = await fetch(url);
        const data = await response.json();
        //if (this.config.debug) console.log(data.query.pages)
        for (const page_key in data.query.pages) {
            let page = data.query.pages[page_key];
            let key = page.title;
            if (page.missing) {
                console.error("Referenced resource missing: " + page.title + ". Please check you system setup and installed packages.");
                continue;
            }
            const revision = page.revisions[0];
            let hash = revision.sha1;
            //this.setHash(key, hash);
            let content = null;
            if (page.title.startsWith("JsonSchema:")) content = revision.slots.main["*"];
            else if (revision.slots.jsonschema) { content = revision.slots.jsonschema["*"]; }
            items[key] = {
                meta: { hash: hash },
                value: content
            };
            if (this.config.debug) console.log("Fetch", key);//items[key]);
        }
        return items;
    }

};