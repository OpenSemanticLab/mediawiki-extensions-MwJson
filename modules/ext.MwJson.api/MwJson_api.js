/*@nomin*/

mwjson.api = class {
	constructor() {
	}

	static getPage(title) {           
		const deferred = $.Deferred();
		//$.getJSON(`/w/api.php?action=query&prop=revisions&titles=${title}&rvprop=content&formatversion=2&format=json`, function(data) {
		var api = new mw.Api();
			api.get( {
    			action: 'query',
    			prop: 'revisions',
    			titles: title,
    			rvprop: ['content'],
    			formatversion: 2,
    			format: 'json',
		} ).done( function ( data ) {
			var page = {title: title, exists: false, changed: false, content: ""};
            		if (!(data.query.pages[0].hasOwnProperty("missing") && data.query.pages[0].missing === true)) {
				page.exists = true;
				page.content = data.query.pages[0].revisions[0].content;
            		}
            		deferred.resolve(page);
		});
		return deferred.promise();
	}

	static getFilePage(name, dataType = "text") {
		const deferred = $.Deferred();
		mwjson.api.getPage("File:" + name).then( (page) => {
			page.file = {name: name, changed: false};
			if (page.exists && dataType == "text") {
				$.ajax({
					url: "/wiki/Special:Redirect/file/" + name,
					dataType: dataType,
					success: function(data) {
						page.file.exists = true;
						page.file.content = data;
						deferred.resolve(page);
					},
					error: function(data) {
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
		return api.create( title,
		    { summary: summary },
		    content
		);
	}
	
	static editPage(title, new_text, summary = "") {
		var api = new mw.Api();
		return api.edit(
		    title,
		    function ( revision ) {
		        return {
		            text: new_text,
		            summary: summary,
		            minor: false
		        };
		    }
		);
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
		new mw.Api().upload(blob, param).done(function(data) {
			mw.notify('Saved', {
				type: 'success'
			});
			deferred.resolve(data);
		}).fail(function(data) {
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
		if (!page.exists && page.title && page.content) {
			mwjson.api.createPage(page.title, page.content, summary).then( (data) => {
				page.changed = false;
				page.exists = true;
				if (hasChangedFile) {
					mwjson.api.uploadFile(page.file.contentBlob, page.file.name, summary).then( (data) => {
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
		else if (page.changed) {
			mwjson.api.editPage(page.title, page.content, summary).then( (data) => {
				page.changed = false;
				page.exists = true;
				if (hasChangedFile) {
					mwjson.api.uploadFile(page.file.contentBlob, page.file.name, summary).then( (data) => {
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
			mwjson.api.uploadFile(page.file.contentBlob, page.file.name, summary).then( (data) => {
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

	static getSemanticProperties(title, mode='html') {
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
                        if (data.query.sobj[i].subject.endsWith(title.split('#').pop().replace(' ',''))){
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
