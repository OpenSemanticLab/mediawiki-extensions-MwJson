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
						"main": { "type": "string", "format": "handlebars", "options": {"wikieditor": ""}} //format 'mediawiki' is supported by ace, but not yet by jsoneditor
					}
				}
			};
			for (var page_id of Object.keys(data.query.pages)) {
				var page_data = data.query.pages[page_id];
				//if (!(page_data.hasOwnProperty("missing") && page_data.missing === true)) {
				if (page_data.hasOwnProperty("missing") || page_id === -1) { //non exitings page may contain missing=""
					page.exists = false;
				}
				else {
					page.exists = true;
					page.content = page_data.revisions[0].slots["main"]["*"]; //deprecated main slot content
					for (var slot_key of Object.keys(page_data.revisions[0].slots)) {
						var slot = page_data.revisions[0].slots[slot_key];
						page.slots_changed[slot_key] = false;
						page.content_model[slot_key] = slot.contentmodel;
						if (slot.contentmodel === 'json') {
							page.slots[slot_key] = JSON.parse(slot["*"]);
							page.schema.properties[slot_key] = { "type": "string", "format": "json" };
						}
						else {
							page.slots[slot_key] = slot["*"]; //default: text
							if (slot_key === 'main') page.schema.properties[slot_key] = { "type": "string", "format": "textarea", "options": {"wikieditor": "visualeditor"} };
							else page.schema.properties[slot_key] = { "type": "string", "format": "handlebars", "options": {"wikieditor": ""} };
						}
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
				deferred.reject(new Error('File does not exists'));
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

	static editSlots(page, summary = ""){
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
				if (page.content_model[slot_key] === 'json') content = JSON.stringify(content);
				mwjson.api.editSlot(page.title, slot_key, content, summary).done(do_edit);
			}
			else deferred.resolve(page);
		}
		do_edit();
		return deferred.promise();
	}

	static copyPageContent(sourcePage, targetPage){
		for (var slot_key of Object.keys(sourcePage.slots)) {
			targetPage.slots[slot_key] = sourcePage.slots[slot_key];
			targetPage.content_model[slot_key] = sourcePage.content_model[slot_key];
			targetPage.slots_changed[slot_key] = true;
		}
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
		new mw.Api().upload(blob, param).done(function (data) {
			mw.notify('Saved', {
				type: 'success'
			});
			deferred.resolve(data);
		}).fail(function (data) {
			if (data === 'exists' || data === 'was-deleted') { //only warning, upload was successful anyway
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
}
