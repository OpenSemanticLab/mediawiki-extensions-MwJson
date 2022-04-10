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
		            assert: 'bot',
		            minor: false
		        };
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
		if (page.changed) {
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
}
