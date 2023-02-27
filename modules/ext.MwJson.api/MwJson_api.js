/*@nomin*/

mwjson.api = class {
	constructor() {
	}

	static getPage(title) {
		const deferred = $.Deferred();
		//$.getJSON(`/w/api.php?action=query&prop=revisions&titles=${title}&rvprop=content|contentmodel&rvslots="*"&format=json`, function(data) {
		var api = new mw.Api();
		api.get({
			action: 'query',
			prop: 'revisions',
			titles: title, //only one page
			rvprop: ['content', 'contentmodel'],
			rvlimit: 1, //only latest revision
			rvslots: "*", //all slots
			format: 'json',
		}).done(function (data) {
			var page = {
				title: title, exists: false, changed: false, content: "", 
				slots: { main: "" }, slots_changed: { main: false}, content_model: {main: "wikitext"},
				schema: {
					"title": title,
					"type": "object",
					"properties": {
						"main": { "type": "string", "format": "handlebars", "options": {"wikieditor": "novisualeditor"}} //format 'mediawiki' is supported by ace, but not yet by jsoneditor
					}
				}
			};
			for (var page_id of Object.keys(data.query.pages)) {
				var page_data = data.query.pages[page_id];
				//if (!(page_data.hasOwnProperty("missing") && page_data.missing === true)) {
				if (page_data.hasOwnProperty("missing") || page_id === -1) { //non exitings page may contain missing=""
					page.exists = false;
					page.slots_changed['main'] = true; //to create an empty page
				}
				else {
					page.exists = true;
					page.content = page_data.revisions[0].slots["main"]["*"]; //deprecated main slot content
					var page_slots = page_data.revisions[0].slots;
					for (var slot_key of Object.keys(page_slots)) {
						var slot = page_data.revisions[0].slots[slot_key];
						page.slots_changed[slot_key] = false;
						page.content_model[slot_key] = slot.contentmodel;
						if (slot.contentmodel === 'json') {
							if (slot_key == 'jsondata') {
								page.slots[slot_key] = slot["*"];
								//page.slots[slot_key] = JSON.parse(slot["*"]);
								page.schema.properties[slot_key] = { "type": "string", "format": "json" }; //Todo: Fetch schema from categories
								//page.schema.properties[slot_key] = { "$ref": "/wiki/MediaWiki:Slot-jsonschema-jsondata.json?action=raw" };
							}
							else if (slot_key == 'jsonschema') {
								page.slots[slot_key] = slot["*"];
								page.schema.properties[slot_key] = { "type": "string", "format": "json" }; //Todo: Fetch schema from categories
								/*page.slots[slot_key] = JSON.parse(slot["*"]);
								//page.schema.properties[slot_key] = { "$ref": "/wiki/MediaWiki:Slot-jsonschema-jsonschema.json?action=raw" };
								//page.schema.properties[slot_key] = { "$ref": "/w/extensions/MwJson/modules/ext.MwJson.editor/jsonschema-jsonschema.json" }; //from https://github.com/wclssdn/JSONSchemaCreator/blob/0544223fb43ebd4c8614ea97b275cae38f2c015c/dist/en.js
								page.schema.definitions = mwjson.schema.jsonschema_jsonschema_definitions;
								page.schema.properties[slot_key] = mwjson.schema.jsonschema_jsonschema_root;
								*/
							}
							else {
								page.slots[slot_key] = slot["*"];
								page.schema.properties[slot_key] = { "type": "string", "format": "json" };
							}
						}
						else {
							page.slots[slot_key] = slot["*"]; //default: text
							if (slot_key === 'main') page.schema.properties[slot_key] = { "type": "string", "format": "textarea", "options": {"wikieditor": "novisualeditor"} };
							else page.schema.properties[slot_key] = { "type": "string", "format": "handlebars", "options": {"wikieditor": ""} };
						}
					}

				}
				var site_slots = mw.config.get('wgWSSlotsDefinedSlots');
				if (site_slots) {
					for (var slot_key of Object.keys(site_slots)) {
						var slot_schema = { "type": "string", "format": "handlebars" };
						page.content_model[slot_key] = site_slots[slot_key]['content_model'];
						if (site_slots[slot_key]['content_model'] == 'json') slot_schema['format'] = 'json';
						if (!page.schema.properties[slot_key]) page.schema.properties[slot_key] = slot_schema;
						//if (slot_key === 'jsondata') page.schema.properties[slot_key] = { "$ref": "/wiki/MediaWiki:Slot-jsonschema-jsondata.json?action=raw" };
					}
				}
			}
			console.log(page);
			deferred.resolve(page);
		});
		return deferred.promise();
	}

	static getFilePage(name, dataType = "text") {
		const deferred = $.Deferred();
		mwjson.api.getPage("File:" + name).then((page) => {
			page.file = { name: name, changed: false };
			if (page.exists && dataType == "text") {
				$.ajax({
					url: "/wiki/Special:Redirect/file/" + name,
					dataType: dataType,
					success: function (data) {
						page.file.exists = true;
						page.file.content = data;
						deferred.resolve(page);
					},
					error: function (data) {
						page.file.exists = false;
						console.log("Error while fetching file: " + data);
						deferred.reject(data);
					}
				});
			}
			else {
				//deferred.reject(new Error('File does not exists'));
				deferred.resolve(page);
			}
		});
		return deferred.promise();
	}

	static createPage(title, content, summary = "") {
		var api = new mw.Api();
		return api.create(title,
			{ summary: summary },
			content
		);
	}

	static editPage(title, new_text, summary = "") {
		var api = new mw.Api();
		return api.edit(
			title,
			function (revision) {
				return {
					text: new_text,
					summary: summary,
					minor: false
				};
			}
		);
	}

	static editSlot(title, slot, content, summary = "") {
		var api = new mw.Api();
		return api.postWithToken("csrf",
			{
				action: 'editslot',
				title: title,
				slot: slot,
				text: content,
				summary: summary
			}
		);
	}

	static editSlots(page, summary = "", mode = 'action-multislot'){
		mwjson.api.autoEditSlots(page); //could not be solved by modified RevisionRecord.php. ToDo: Move to OSL extension
		if (mode === 'action-multislot') {
			var params = {
				action: 'editslots',
				title: page.title,
				summary: summary
			};
			for (var slot_key of Object.keys(page.slots)) {
				console.log("Edit slot " + slot_key);
				page.slots_changed[slot_key] = false;
				var content = page.slots[slot_key];
				if (page.content_model[slot_key] === 'json' && !(typeof content === 'string')) content = JSON.stringify(content);
				params['slot_' + slot_key] = content;
			}
			return new mw.Api().postWithToken("csrf", params);
		}
		else {
			const deferred = $.Deferred();
			var slot_list = []
			for (var slot_key of Object.keys(page.slots)) {
				if (page.slots_changed[slot_key]) slot_list.push(slot_key)
				//mwjson.api.editSlot(page.title, slot_key, page.slots[slot_key], summary); //parallel edit does not work
			}

			function do_edit() {
				const slot_key = slot_list.pop();
				if (slot_key) {
					console.log("Edit slot " + slot_key);
					page.slots_changed[slot_key] = false;
					var content = page.slots[slot_key];
					if (page.content_model[slot_key] === 'json' && !(typeof content === 'string')) content = JSON.stringify(content);
					mwjson.api.editSlot(page.title, slot_key, content, summary).done(do_edit);
				}
				else deferred.resolve(page);
			}
			do_edit();
			return deferred.promise();
		}
	}

	static autoEditSlots(page) {
		var namespace_prefix = new mw.Title(page.title).getNamespacePrefix();
		/*if (namespace_prefix === "Category:") {
			if (page.slots['header'] !== "{{#invoke:Category|header}}") {
				page.slots['header'] = "{{#invoke:Category|header}}"
				page.slots_changed['header'] = true;
			}
			if (page.slots['footer'] !== "{{#invoke:Category|footer}}") {
				page.slots['footer'] = "{{#invoke:Category|footer}}"
				page.slots_changed['footer'] = true;
			}
		}*/
		if (namespace_prefix === "Item:" || namespace_prefix === "Category:" || namespace_prefix === "Property:") {
			if (page.slots['header'] !== "{{#invoke:Entity|header}}") {
				page.slots['header'] = "{{#invoke:Entity|header}}"
				page.slots_changed['header'] = true;
			}
			if (page.slots['footer'] !== "{{#invoke:Entity|footer}}") {
				page.slots['footer'] = "{{#invoke:Entity|footer}}"
				page.slots_changed['footer'] = true;
			}
		}
		
	}

	static copyPageContent(sourcePage, targetPage){
		for (var slot_key of Object.keys(sourcePage.slots)) {
			targetPage.slots[slot_key] = sourcePage.slots[slot_key];
			targetPage.content_model[slot_key] = sourcePage.content_model[slot_key];
			targetPage.slots_changed[slot_key] = true;
		}
		targetPage.content = sourcePage.content; //legacy support
		targetPage.changed = true;
		targetPage.slots_changed['main'] = false;
	}

	static copyPage(sourceTitle, targetTitle, summary = "", modify = undefined) { //(p) => { const d = $.Deferred(); d.resolve(p); return d.promise(); }) {
		if (!modify) modify = (p) => { const d = $.Deferred(); d.resolve(p); return d.promise(); }
		const deferred = $.Deferred();
		mwjson.api.getPage(sourceTitle).then((sourcePage) => {
			mwjson.api.getPage(targetTitle).then((targetPage) => {
				if (targetPage.exists) {
					OO.ui.confirm('Page does exist. Overwrite?').done((confirmed) => {
						if (confirmed) {
							if (summary === "") summary = "Copy of [[" + sourceTitle + "]]";
							mwjson.api.copyPageContent(sourcePage, targetPage);
							targetPage.changed = true;
							modify(targetPage).then((targetPage) => {
								mwjson.api.updatePage(targetPage, summary).then(() => {
									mw.notify(sourceTitle + "\n=> " + targetTitle, {
										title: 'Copy created',
										type: 'success'
									});
									deferred.resolve();
								})
							})
						}
					});
				}
				else {
					if (summary === "") summary = "Copy of [[" + sourceTitle + "]]";
					mwjson.api.copyPageContent(sourcePage, targetPage);
					targetPage.changed = true;
					modify(targetPage).then((targetPage) => {
						mwjson.api.updatePage(targetPage, summary).then(() => {
							mw.notify(sourceTitle + "\n=> " + targetTitle, {
								title: 'Copy created',
								type: 'success'
							});
							deferred.resolve();
						})
					})
				}
			});
		});
		return deferred.promise();
	}

	static purgePage(title) {
		var api = new mw.Api();
		return api.post(
			{
				titles: title,
				action: 'purge',
				forcelinkupdate: true,
				forcerecursivelinkupdate: true
			}
		);
	}

	static uploadFile(blob, name, summary = "") {
		const deferred = $.Deferred();
		var param = {
			filename: name,
			comment: summary,
			text: "",
			format: 'json',
			ignorewarnings: 1
		};
		//todo: chunked upload of large files: https://doc.wikimedia.org/mediawiki-core/master/js/#!/api/mw.Api.plugin.upload
		new mw.Api().upload(blob, param).done(function (data) {
			mw.notify('Saved', {
				type: 'success'
			});
			deferred.resolve(data);
		}).fail(function (data) {
			if (data === 'exists' || data === 'was-deleted' || data === 'duplicate' || data == 'duplicate-archive' || data === 'page-exists') { //only warning, upload was successful anyway
				mw.notify('Saved', {
					type: 'success'
				});
				deferred.resolve(data);
			}
			else {
				mw.notify('An error occured while saving. \nPlease save your work on the local disk.', {
					title: 'Error',
					type: 'error'
				});
				deferred.reject(data);
			}
		});
		return deferred.promise();
	}

	static updatePage(page, summary = "") {
		const deferred = $.Deferred();
		const hasChangedFile = ('file' in page && page.file.changed);
		var slots_changed = false;
		for (var slot_key of Object.keys(page.slots)) { if (page.slots_changed[slot_key]) slots_changed = true; }
		if (!page.exists && page.title && (page.content || page.slots['main'])) {
			mwjson.api.createPage(page.title, page.content, summary).then((data) => {
				page.changed = false;
				page.exists = true;
				mwjson.api.editSlots(page, summary).then((data) => { //will only edit changed slots
					if (hasChangedFile) {
						mwjson.api.uploadFile(page.file.contentBlob, page.file.name, summary).then((data) => {
							page.file.changed = false;
							page.file.exists = true;
							deferred.resolve(page);
						}, (error) => {
							deferred.reject(error);
						});
					}
					else deferred.resolve(page);
				}, (error) => {
					deferred.reject(error);
				});
			}, (error) => {
				deferred.reject(error);
			});
		}
		else if (page.changed || slots_changed) {
			if (page.changed) {
				page.slots['main'] = page.content; //legacy support
				page.slots_changed['main'] = true;
				page.changed = false;
			}
			mwjson.api.editSlots(page, summary).then((data) => {
				page.changed = false;
				page.exists = true;
				if (hasChangedFile) {
					mwjson.api.uploadFile(page.file.contentBlob, page.file.name, summary).then((data) => {
						page.file.changed = false;
						page.file.exists = true;
						deferred.resolve(page);
					}, (error) => {
						deferred.reject(error);
					});
				}
				else deferred.resolve(page);
			}, (error) => {
				deferred.reject(error);
			});
		}
		else if (hasChangedFile) {
			mwjson.api.uploadFile(page.file.contentBlob, page.file.name, summary).then((data) => {
				page.file.changed = false;
				page.file.exists = true;
				deferred.resolve(page);
			}, (error) => {
				deferred.reject(error);
			});
		}
		else deferred.resolve(page);
		return deferred.promise();
	}

	static getSemanticProperties(title, mode = 'html') {
		const deferred = $.Deferred();

		var subject = title.split("#")[0];
		var subObject = "";
		if (title.split("#")[1]) {
			subObject = title.split("#")[1].replace(" ", "_");
		}
		var namespace_id = 0;
		if (subject.split(":")[1]) {
			const namespace = subject.split(":")[0];
			subject = subject.split(":")[1];
			namespace_id = mw.config.get('wgNamespaceIds')[namespace.replaceAll(" ", "_").toLowerCase()];
			//console.log(`Namespace ${namespace}, ID ${namespace_id}`);
		}

		//only html mode can retrieve inverse properties
		if (mode === 'html') {
			const query = `/w/api.php?action=smwbrowse&browse=subject&params={"subject":"${encodeURIComponent(subject)}","subobject":"${subObject}","options":{"showAll":"true"}, "ns":${namespace_id}, "type":"html"}&format=json`;
			fetch(query)
				.then(response => response.json())
				.then(data => {

					var page_properties = [];
					var $html = $(data.query);
					$html.find("div.smwb-propvalue").each(function () {
						var $prop = $(this).find("div.smwb-prophead a");
						//var propName = $prop.text();
						//var propName = $prop.attr('title').replace("Property:", "");
						var propName = "";
						if ($prop.attr('title') === "Special:Categories") propName += "Category";
						else if ($prop.attr('title') === "Special:ListRedirects") return;
						else if ($prop.attr('href')) propName += $prop.attr('href').split("Property:")[1].split("&")[0];
						else return; //empty property
						page_properties.push(propName);
						//console.log(propName);
						$(this).find("div.smwb-propval span.smwb-value").each(function () {
							var value = $(this).find("a").attr("title");
							//console.log("-> " + value);
						});
					})
					$html.find("div.smwb-ipropvalue").each(function () {
						var $prop = $(this).find("div.smwb-prophead a");
						//var propName = $prop.text();
						//var propName = $prop.attr('title').replace("Property:", "");
						var propName = "-";
						if ($prop.attr('title') === "Special:Categories") propName += "Category";
						else if ($prop.attr('title') === "Special:ListRedirects") return;
						else if ($prop.attr('href')) propName += $prop.attr('href').split("Property:")[1].split("&")[0];
						else return; //empty property
						page_properties.push(propName);
						//console.log(propName);
						$(this).find("div.smwb-propval span.smwb-ivalue").each(function () {
							var value = $(this).find("a").attr("title");
							//console.log("-> " + value);
						});
					})
					deferred.resolve(page_properties);
				},
					(error) => {
						deferred.reject(error);
					});
		}

		else {
			const query = `/w/api.php?action=smwbrowse&browse=subject&params={"subject":"${encodeURIComponent(subject)}","subobject":"${subObject}","options":{"showAll":"true"}, "ns":${namespace_id}, "type":"json"}&format=json`;
			fetch(query)
				.then(response => response.json())
				.then(data => {
					var page_properties = [];
					var properties = data.query.data; //normal page
					if (title.includes('#')) { //subobject
						for (var i = 0; i < data.query.sobj.length; i++) {
							if (data.query.sobj[i].subject.endsWith(title.split('#').pop().replace(' ', ''))) {
								properties = data.query.sobj[i].data
								break;
							}
						}
					}
					for (var i = 0; i < properties.length; i++) {
						if (!properties[i].property.startsWith("_")) { //skip system properties
							page_properties.push(properties[i].property)
						}
					}
					deferred.resolve(page_properties);
				},
					(error) => {
						deferred.reject(error);
					});
		}


		return deferred.promise();
	}

	static getLabels(titles) {
		const deferred = $.Deferred();

		var titles = [...new Set(titles)]; //filter duplicates

		var query = "/w/api.php?action=ask&query=";
		var first = true;
		for (const title of titles) {
			if (!first) query += "OR";
			query += "[[";
			if (title.startsWith("Category:")) query += ":";
			query += title + "]]";
			first = false;
		}
		query += "|?Display_title_of=label&format=json"

		fetch(query)
			.then(response => response.json())
			.then(data => {
				var label_dict = {};

				for (const title of titles) {
					var result = data.query.results[title];
					var label = title;
					if (result) 
						if (result.printouts.label)
							if (result.printouts.label[0])
								if (result.printouts.label[0].Text) { //multi lang label
									if (result.printouts.label[0].Text.item)
										if (result.printouts.label[0].Text.item[0])
											label = result.printouts.label[0].Text.item[0];
											label_dict[title] = label;
								}
								else label_dict[title] = result.printouts.label[0]
				}
				
				deferred.resolve(label_dict);
			},
			(error) => {
				deferred.reject(error);
			});

		return deferred.promise();
	}
}
