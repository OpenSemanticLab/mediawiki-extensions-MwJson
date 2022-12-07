/*@nomin*/

mwjson.editor = class {
	constructor(config) {
		var defaultConfig = {
			id: 'json-editor-' + mwjson.util.getShortUid(),
			onsubmit: (json) => this.onsubmit(json)
		};
		this.config = mwjson.util.mergeDeep(defaultConfig, config);
		if (this.config.container) {
			this.container = this.config.container;
			this.config.popup = false;
		}
		else {
			this.createPopupDialog(this.config.popupConfig);
			this.container = document.getElementById(this.config.id);
			this.config.popup = true;
		}

		this.schema = this.config.schema;
		this.createEditor();
	}

	createPopupDialog(_config) {
		_config = _config || {}
		var editor = this;
		var defaultConfig = {
			msg: {
				"dialog-title": "JSONEditor",
				"continue": "Continue", 
				"cancel": "Cancel", 
			},
			redirect: (page) => {
				var params = {"veaction": "edit"};
				if (!page.exists) params["redlink"] = 1;
				return new mw.Title( page.title ).getUrl(params);
			},
			new_window: false
		};

		_config = mwjson.util.mergeDeep(defaultConfig, _config);

		// Make a subclass of ProcessDialog 
		function Dialog(config) {
			Dialog.super.call(this, config);
		}
		OO.inheritClass(Dialog, OO.ui.ProcessDialog);

		// Specify a name for .addWindows()
		Dialog.static.name = 'CreatePageDialog';
		// Specify the static configurations: title and action set
		Dialog.static.title = _config.msg["dialog-title"];
		Dialog.static.actions = [
			{
				flags: 'primary',
				label: _config.msg['continue'],
				action: 'create'
			},
			{
				flags: 'safe',
				label: _config.msg['cancel']
			}
		];

		// Customize the initialize() function to add content and layouts: 
		Dialog.prototype.initialize = function () {
			Dialog.super.prototype.initialize.call(this);
			this.panel = new OO.ui.PanelLayout({
				padded: true,
				expanded: false
			});

			this.panel.$element.append($('<div id="' + editor.config.id + '"><div>'));
			this.$body.append(this.panel.$element);
		};

		// Specify any additional functionality required by the window (disable creating an empty URL, in this case)
		/*Dialog.prototype.onTitleInputChange = function (value) {
			this.actions.setAbilities({
				create: !!value.length
			});
		};*/

		// Specify the dialog height (or don't to use the automatically generated height).
		Dialog.prototype.getBodyHeight = function () {
			// Note that "expanded: false" must be set in the panel's configuration for this to work.
			// When working with a stack layout, you can use:
			//   return this.panels.getCurrentItem().$element.outerHeight( true );
			return this.panel.$element.outerHeight(true);
		};

		// Use getSetupProcess() to set up the window with data passed to it at the time 
		// of opening (e.g., pageTitle: '', in this example). 
		Dialog.prototype.getSetupProcess = function (data) {
			data = data || {};
			return Dialog.super.prototype.getSetupProcess.call(this, data)
				.next(function () {
					// Set up contents based on data
				}, this);
		};

		// Specify processes to handle the actions.
		Dialog.prototype.getActionProcess = function (action) {
			var dialog = this;
			if (action === 'create') {
				// Create a new process to handle the action
				return new OO.ui.Process(function () {
					dialog.close({action: action})
					if (editor.config.onsubmit) editor.config.onsubmit(editor.jsoneditor.getValue());
				}, this);
			}
			// Fallback to parent handler
			return Dialog.super.prototype.getActionProcess.call(this, action);
		};

		// Use the getTeardownProcess() method to perform actions whenever the dialog is closed. 
		// This method provides access to data passed into the window's close() method 
		// or the window manager's closeWindow() method.
		Dialog.prototype.getTeardownProcess = function (data) {
			return Dialog.super.prototype.getTeardownProcess.call(this, data)
				.first(function () {
					// Perform any cleanup as needed
					this.manager.$element.remove(); //delete dialog DOM
				}, this);
		};

		// Create and append a window manager.
		var windowManager = new OO.ui.WindowManager();
		$(document.body).append(windowManager.$element);

		// Create a new process dialog window.
		var dialog = new Dialog();

		// Add the window to window manager using the addWindows() method.
		windowManager.addWindows([dialog]);

		// Open the window!   
		windowManager.openWindow(dialog, { pageTitle: _config.title });
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

	static wikiJson2SchemaJsonRecursion(wikiJson, footerWikiJson = undefined) {
		var schemaJson = {}
		if (footerWikiJson != undefined) { 
			schemaJson['osl_footer'] = mwjson.editor.wikiJson2SchemaJsonRecursion(footerWikiJson);
			delete schemaJson['osl_footer']['extensions']; //not defined in schema
		}
		for (var key in wikiJson) {
			var value = wikiJson[key];
			if (Array.isArray(value)) //handle first because arrays are also objects
			{
				schemaJson[key] = [];
				for (var index = 0; index < value.length; index++) { //for (var element : value)
					var element = value[index];
					//if (debug) console.log("index: " + index + ", elementtype:" + (typeof element) + ", element:" + element);
					if (typeof element === "object") {
						if (key === "extensions") {
							if (footerWikiJson != undefined) { //we asume that every extension provides also a footer template
								var nextFooter = footerWikiJson[schemaJson['osl_footer']['osl_template']]['extensions'][index];
								schemaJson[key].push(mwjson.editor.wikiJson2SchemaJsonRecursion(element, nextFooter));
							}
						}
						else schemaJson[key].push(mwjson.editor.wikiJson2SchemaJsonRecursion(element));
					}
					else {
						schemaJson[key].push(element);
					}
				}

			}
			else if (typeof value === "object") {
				schemaJson = mwjson.editor.wikiJson2SchemaJsonRecursion(value, footerWikiJson);
				schemaJson['osl_template'] = key;
			}
			else {
				schemaJson[key] = value;
			}
		}

		for (key in schemaJson) {
			if (schemaJson[key] === "" && key === 'extensions') schemaJson[key] = [];
			//if (schemaJson[key] === "") delete schemaJson[key]; //schemaJson[key] = undefined; ////set properties with empty string to none
        	/*if (Array.isArray(schemaJson[key])) { //wikiJson defaults are lists, even for single or empty values
            	if (schemaJson[key].length == 0) delete schemaJson[key]
            	//else if len(schemaJson[key]) == 1: schemaJson[key] = schemaJson[key][0]
			}*/
		}

		return schemaJson;
	}

	static wikiJson2SchemaJson(wikiJson, isRoot = true) {
		var schemaJson = {}
		if (mwjson.editor.isObjLiteral(wikiJson[0]) === false 
		|| typeof wikiJson[1] !== 'string' 
		|| mwjson.editor.isObjLiteral(wikiJson[2]) === false) {
			console.log("Error: Invalid wikiJson:", wikiJson);
			return schemaJson;
		}
		var schemaJson = {};

		schemaJson = mwjson.editor.wikiJson2SchemaJsonRecursion(wikiJson[0], wikiJson[2])
		schemaJson['osl_wikitext'] = wikiJson[1];
		return schemaJson;
	}

	static schemaJson2WikiJson(schemaJson, isRoot = true) {
		var wikiJson = [{}, "", {}]; //header, freetext, footer
		var template = "";
		var footer_template = "";
		if (Object.hasOwn(schemaJson, 'osl_template')) {
			template = schemaJson['osl_template'];
			wikiJson[0][template] = {};
		}
		else {
			console.log("Error: Mandatory property 'osl_template' not found in schemaJson", schemaJson);
			return;
		}
		if (Object.hasOwn(schemaJson, 'osl_wikitext')) wikiJson[1] = schemaJson['osl_wikitext'];
		if (Object.hasOwn(schemaJson, 'osl_footer')) {
			wikiJson[2] = mwjson.editor.schemaJson2WikiJson(schemaJson['osl_footer'], false)[0];
			footer_template = schemaJson['osl_footer']['osl_template'];
			wikiJson[2][footer_template]['extensions'] = [];
		}
		for (var key in schemaJson) {
			if (key.startsWith('_') || key.startsWith('osl_template') || key.startsWith('osl_wikitext') || key.startsWith('osl_footer')) continue;
			if (schemaJson[key] === undefined) continue;
			else if (typeof schemaJson[key] === 'string') wikiJson[0][template][key] = schemaJson[key];
			else if (typeof schemaJson[key] === 'number') wikiJson[0][template][key] = schemaJson[key];
			else if (Array.isArray(schemaJson[key])) {
				wikiJson[0][template][key] = [];
				schemaJson[key].forEach(subSchemaJson => {
					if (mwjson.editor.isObjLiteral(wikiJson[0])) {
						var subWikiJson = mwjson.editor.schemaJson2WikiJson(subSchemaJson, false);
						wikiJson[0][template][key].push(subWikiJson[0]);
						if (key === "extensions") {
							wikiJson[2][footer_template]['extensions'].push(subWikiJson[2]);
						}
					}
					else wikiJson[0][template][key].push(subWikiJson); //Literal
				});
			}
			else { //object
				var subWikiJson = mwjson.editor.schemaJson2WikiJson(schemaJson[key], false);
				wikiJson[0][template][key] = [subWikiJson[0]]; //wikiJson defaults to arrays
			}
		}
		return wikiJson;
	}

	static data2template(data, isRoot = true) {
		var wikitext = "";
		if (data._template) {
			wikitext += "{{";
			wikitext += data._template;
		}
		for (var key in data) {
			if (key.startsWith('_')) continue;
			if (data._template) wikitext += "\n|" + key + "=";
			if (data[key] === undefined) continue;
			else if (typeof data[key] === 'string') wikitext += data[key];
			else if (typeof data[key] === 'number') wikitext += (data[key]);
			else if (Array.isArray(data[key])) {
				data[key].forEach(o => {
					wikitext += mwjson.editor.data2template(o, false);
					//console.log("Type of " + o + " is " + typeof o);
					if (o._template) { }
					else wikitext += ";";
				});
			}
			else wikitext += mwjson.editor.data2template(data[key], false);
			//wikitext += "\n";
		}
		if (data._template) {
			wikitext += "\n}}"
		}
		return wikitext;
	}

	static getTemplatePropertyMapping(schema) {
		var mapping = mwjson.editor.getPropertyTemplateMapping(schema);
		var inverse_mapping = {};
		for(var key in mapping){
			inverse_mapping[mapping[key]] = key;
		}
		return inverse_mapping;
	}

	static getPropertyTemplateMapping(schema) {
		//TODO: use jsonpath on schema
		var mapping = {
			"header": "OslTemplate:KB/Term",
			"footer": "OslTemplate:KB/Term/Footer"
		}
	}

	static pagedict2data(pagedict) {
		var data = {}
		var textkey = "text";
		var text_counter = 0;
		for (var key in pagedict)
		{
			var content_element = pagedict[key];
			if (typeof content_element == "object") wt += mwjson.parser.getWikitextFromWikipageTemplateKeyDict(content_element);
			else if (typeof content_element == "string") {
				text_counter += 1;
				data[textkey + text_counter] = content_element;
			}
			else console.log("Error: content element is not dict or string: " + content_element);
		}
	}

	createEditor() {
		//return function(err, config) {

		//console.log(this);

		//JSONEditor.defaults.language = "de";
		this.config.JSONEditorConfig = this.config.JSONEditorConfig || {};
		var defaultJSONEditorConfig = {
			schema: this.schema,
			theme: 'bootstrap4',
			ajax: true,
			ajax_cache_responses: false,
			disable_collapse: false,
			disable_edit_json: true,
			disable_properties: true,
			use_default_values: true,
			required_by_default: false,
			display_required_only: false,
			show_opt_in: true,
			show_errors: 'always',
			disable_array_reorder: false,
			disable_array_delete_all_rows: false,
			disable_array_delete_last_row: false,
			keep_oneof_values: false,
			no_additional_properties: true,
			form_name_root: 'form' //set to schema id?
		}
		this.config.JSONEditorConfig = mwjson.util.mergeDeep(defaultJSONEditorConfig, this.config.JSONEditorConfig);
		console.log(this.config.JSONEditorConfig);

		//create editor
		this.jsoneditor = new JSONEditor(this.container, this.config.JSONEditorConfig);
		console.log(this.config.data);

		if (!this.config.popup) {
			$(this.container).append($("<button type='Button' class='btn btn-primary btn-block' id='save-form'>Save</button>"));
			$("#save-form").click(() => {
				this.config.onsubmit(this.jsoneditor.getValue());
			});
		}

		// listen for loaded
		this.jsoneditor.on('ready', () => {
			console.log("Editor loaded");
			if (this.config.data) this.jsoneditor.setValue(this.config.data);
			if (this.config.target) mwjson.api.getPage(this.config.target).then((page) => {
				//return;
				mwjson.parser.parsePage(page);
				this.targetPage = page;
				//load data from page if exist
				if (this.targetPage.content !== "") {
					console.log("Load data:", this.targetPage.dict);
					var schemaJson = mwjson.editor.wikiJson2SchemaJson(this.targetPage.dict);
					console.log(schemaJson);
					this.jsoneditor.setValue(schemaJson);
				}
				console.log("Queries:");
			})
		});

		// listen for changes
		this.jsoneditor.on('change', () => {
			console.log("Editor changed");
			console.log(this.jsoneditor.schema);
			console.log(this.jsoneditor.getValue());
		});
		//};

		// listen for array changes
		this.jsoneditor.on('addRow', editor => {
			//console.log('addRow', editor)
		});
	};

	onsubmit(json) {
		if (!this.config.target) this.config.target = "LabProcess:" + mwjson.util.OslId()
		console.log("Save form");
		var url = window.location.href.replace(/\?.*/, '');
		url += '?target=' + encodeURIComponent(this.config.target);
		url += '&data=' + encodeURIComponent(mwjson.util.objectToCompressedBase64(json));

		console.log(JSON.stringify(json));
		mwjson.api.getPage(this.config.target).then((page) => {
			page.content = mwjson.editor.data2template(json)
			//add edit link with base64 encode data
			//page.content = "<noinclude>[" + url + " Edit Template]</noinclude>\n<br\>" + page.content;
			page.changed = true;
			//console.log(page.content);
			var wikiJson = mwjson.editor.schemaJson2WikiJson(json)
			page.dict = wikiJson;
			mwjson.parser.updateContent(page);
			console.log(wikiJson);
			console.log(page.content);
			mwjson.api.updatePage(page, "Edited with JsonEditor").then(() => {
				window.location.href = "/wiki/" + page.title
			});
		});
		//mwjson.parser.parsePage(page)
		//console.log(page.dict);
		/*return;
		console.log(this.targetPage.data);
		if (Array.isArray(this.targetPage.data)) {
			this.targetPage.data.forEach((template, index) => {
				Object.assign(template, this.jsoneditor.getValue()[index]);
				wikitext = data2template(template);
				template._token.clear();
				template._token.push(wikitext);
			});
		}
		else {
			var template = this.targetPage.data;
			Object.assign(template, this.jsoneditor.getValue());
			wikitext = data2template(template);
			template._token.clear();
			template._token.push(wikitext);
		}
		this.targetPage.content = this.targetPage.parsedContent.toString();
		console.log(this.targetPage.content);
		var params = {
			action: 'edit',
			title: this.targetPage.name,
			text: this.targetPage.content,
			format: 'json'
		};
		this.api.postWithToken('csrf', params).done(function (data) {
			console.log('Saved!');
		});*/
	}

	static init() {

		var msgs = [];
		for (var key of Object.keys(JSONEditor.defaults.languages.en)) {
			msgs.push("json-editor-" + key);
		}
		
		const deferred = $.Deferred();
		if (!('ready' in mwjson.editor) || !mwjson.editor.ready) {
			mw.loader.load('https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css', 'text/css');
			mwjson.parser.init();
			$.when(
				//nothing to do
				$.getScript("https://unpkg.com/imask"),
				new mw.Api().loadMessagesIfMissing(msgs),
				$.Deferred(function (deferred) {
					$(deferred.resolve);
				})
			).done(function () {
				for (var key of Object.keys(JSONEditor.defaults.languages.en)) {
					//replace with mediawiki i18n
					JSONEditor.defaults.languages.en[key] = mw.message("json-editor-" + key).text().replaceAll('((','{{').replaceAll('))','}}');
				}
				mwjson.editor.setCallbacks();
				mwjson.editor.setDefaultOptions();
				console.log("JsonEditor initialized");
				deferred.resolve();
			});
		}
		else deferred.resolve(); //resolve immediately
		return deferred.promise();
	}

	static setDefaultOptions() {
		window.JSONEditor.defaults.options.template = 'handlebars';
		window.JSONEditor.defaults.options.autocomplete = {
			"search": "search_smw",
			"getResultValue": "getResultValue_smw",
			"renderResult": "renderResult_smw",
			"onSubmit": "onSubmit_smw",
			"autoSelect": "true"
		}
		window.JSONEditor.defaults.options.labelTemplate = "{{#if result.printouts.label.length}}{{result.printouts.label}}{{else if result.displaytitle}}{{result.displaytitle}}{{else}}{{result.fulltext}}{{/if}}";
		window.JSONEditor.defaults.options.previewWikiTextTemplate = "[[{{result.fulltext}}]]";
	}

	static setCallbacks() {
		window.JSONEditor.defaults.callbacks = {
			'now': (jseditor_editor, e) => {
				var t = new Date()
				t.setDate(t.getDate())
				return t.toISOString().split('T')[0] + 'T00:00'
			},
			"autocomplete": {
				// This is callback functions for the "autocomplete" editor
				// In the schema you refer to the callback function by key
				// Note: 1st parameter in callback is ALWAYS a reference to the current editor.
				// So you need to add a variable to the callback to hold this (like the
				// "jseditor_editor" variable in the examples below.)

				// Search function can return a promise
				// which resolves with an array of
				// results. In this case we're using
				// the SMW query API.
				search_smw: (jseditor_editor, input) => {
					if (jseditor_editor.watched_values) console.log("Watched: " + jseditor_editor.watched_values);
					console.log("Search with schema: " + jseditor_editor.schema.query);
					var url = `/w/api.php?action=ask&query=${jseditor_editor.schema.query}&format=json`;
					//replace params
					console.log("URL: " + url);
					for (const key in jseditor_editor.watched_values) {
						if (jseditor_editor.watched_values[key] === undefined) url = url.replace('$(' + key + ')', encodeURIComponent('+'));
						url = url.replace('$(' + key + ')', jseditor_editor.watched_values[key]);
					}
					return new Promise(resolve => {
						//min input len = 0
						if (input.length < 0) {
							return resolve([]);
						}
						console.log("Query-URL: " + url);
						fetch(url)
							.then(response => response.json())
							.then(data => {
								//convert result dict to list/array
								var resultList = Object.values(data.query.results); //use subjects as results
								if (jseditor_editor.schema.listProperty) { //use objects as results
									resultList = [];
									Object.values(data.query.results).forEach(result => {
										resultList = resultList.concat(result.printouts[jseditor_editor.schema.listProperty])
									});
									resultList = [...new Set(resultList)]; //remove duplicates
								}
								//filter list
								resultList = resultList.filter(result => {
									return JSON.stringify(result).toLowerCase().includes(input.toLowerCase()); //slow but generic
								});

								resolve(resultList);
							});
					});
				},
				renderResult_smw: (jseditor_editor, result, props) => {
					var renderUrl = '/w/api.php?action=parse&format=json&text=';
					var previewWikiTextTemplate = jseditor_editor.jsoneditor.options.previewWikiTextTemplate; //use global/default value
					if (jseditor_editor.schema.previewWikiTextTemplate) previewWikiTextTemplate = jseditor_editor.schema.previewWikiTextTemplate; //use custom value
					previewWikiTextTemplate = previewWikiTextTemplate.replaceAll("\\{", "&#123;").replaceAll("\\}", "&#125;"); //escape curly-brackets with html entities. ToDo: Do this once for the whole schema
					var template = Handlebars.compile(previewWikiTextTemplate);
					//var template = Handlebars.compile("{{result.fulltext}}");
					var templateText = template({ result: result });
					templateText = templateText.replaceAll("&#123;", "{").replaceAll("&#125;", "}");
					renderUrl += encodeURIComponent(templateText);
					new Promise(resolve => {
						fetch(renderUrl)
							.then(response => response.json())
							.then(data => {
								//console.log("Parsed: " + data.parse.text);
								//console.log("ID = " + props.id);
								$("#" + props.id).append($(data.parse.text['*']));
								//resolve(data.parse.text);
							});
					});
					return `
					<li ${props}>
					</li>`;
				},

				// SMW returns a format like this:
				//{"query":
				//   "results":
				//       {"PAGE":
				//           {"printouts":[],"fulltext":"PAGE","fullurl":"https://.../wiki/PAGE","namespace":0,"exists":"1","displaytitle":""}
				// ...
				// Display the label...
				getResultValue_smw: (jseditor_editor, result) => {
					var label = result.fulltext;
					if (result.displaytitle && result.displaytitle !== "") label = result.displaytitle;
					var labelTemplate = jseditor_editor.jsoneditor.options.labelTemplate; //use global/default value
					if (jseditor_editor.schema.labelTemplate) labelTemplate = jseditor_editor.schema.labelTemplate; //use custom value
					if (labelTemplate) {
						label = Handlebars.compile(labelTemplate)({ result: result });
					}
					return label;
				},
				//... but store the fulltext / id
				onSubmit_smw: (jseditor_editor, result) => {
					jseditor_editor.value = result.fulltext;
					jseditor_editor.onChange(true);
					//jseditor_editor.jsoneditor.trigger('change',jseditor_editor);
					//window.JSONEditor.trigger('change',jseditor_editor);
					console.log("Selected: " + result.displaytitle + " / " + result.fulltext);
				}
			}
		};

		//  register compare operator 
		// e.g. {{#when <operand1> 'eq' <operand2>}} {{/when}}
		// {{#when var1 'eq' var2}}equal{{else when var1 'gt' var2}}gt{{else}}lt{{/when}}
		Handlebars.registerHelper("when", (operand_1, operator, operand_2, options) => {
			let operators = {
				'eq': (l, r) => l == r,
				'==': (l, r) => l == r,
				'===': (l, r) => l === r,
				'noteq': (l, r) => l != r,
				'!=': (l, r) => l != r,
				'!==': (l, r) => l !== r,
				'gt': (l, r) => (+l) > (+r),
				'>': (l, r) => (+l) > (+r),
				'gteq': (l, r) => ((+l) > (+r)) || (l == r),
				'>=': (l, r) => ((+l) > (+r)) || (l == r),
				'lt': (l, r) => (+l) < (+r),
				'<': (l, r) => (+l) < (+r),
				'lteq': (l, r) => ((+l) < (+r)) || (l == r),
				'<=': (l, r) => ((+l) < (+r)) || (l == r),
				'or': (l, r) => l || r,
				'||': (l, r) => l || r,
				'and': (l, r) => l && r,
				'&&': (l, r) => l && r,
				'mod': (l, r) => (l % r) === 0,
				'%': (l, r) => (l % r) === 0
			}
			let result = operators[operator](operand_1, operand_2);
			if (result) return options.fn(this);
			return options.inverse(this);
		});

		console.log("Callbacks set");
	};

	/*
	Creates an autocomplete input
	*/
	static createAutocompleteInput(config) {
		//console.log("create autocomplete for div " + div_id);

		const config_defaults = {
			query: input => `[[Display_title_of::like:*${input}*]][[!~*QUERY*]]|?Display_title_of=HasDisplayName|?HasDescription`,
			minInputLen: 0,
			filter: (result, input) => {
				if (result.printouts['HasDisplayName'][0]) return result.printouts['HasDisplayName'][0].toLowerCase().includes(input.toLowerCase());
				else return result.fulltext.split(":")[result.fulltext.split(":").length - 1].toLowerCase().includes(input.toLowerCase());
			},
			renderMode: "html",
			renderResult: (result, props) => `
			<li ${props}>
				<div class="wiki-title">
					${result.printouts['HasDisplayName'][0]} (${result.fulltext})
				</div>
			</li>
			<div class="wiki-snippet">
			${result.printouts['HasDescription'][0]}
			</div>
			`,
			getResultValue: result => {
				if (result.printouts['HasDisplayName'][0]) return result.printouts['HasDisplayName'][0];
				else return result.fulltext.split(":")[result.fulltext.split(":").length - 1];
			},
			onSubmit: result => { }
		}

		config = { ...config_defaults, ...config };

		new Autocomplete('#' + config.div_id, {
			search: input => {
				const url = `/w/api.php?action=ask&query=${config.query(input)}&format=json`;
				return new Promise(resolve => {
					if (input.length < config.minInputLen) { return resolve([]); }
					fetch(url)
						.then(response => response.json())
						.then(data => {
							//convert result dict to list/array
							var resultList = Object.values(data.query.results);
							resultList = resultList.filter(result => {
								return config.filter(result, input);
							});
							resolve(resultList);
						});
				});
			},
			renderResult: (result, props) => {
				if (config.renderMode == "html") return config.renderResult(result, props);
				if (config.renderMode == "wikitext") {
					var renderUrl = '/w/api.php?action=parse&format=json&text=';
					renderUrl += encodeURIComponent(config.renderResult(result, props));
					new Promise(resolve => {
						//console.log("Render-URL: " + renderUrl);
						fetch(renderUrl)
							.then(response => response.json())
							.then(data => {
								//console.log("Parsed: " + data.parse.text);
								//console.log("ID = " + props.id);
								$("#" + props.id).append($(data.parse.text['*']));
								$("#" + props.id).find("a").attr("target", "_blank"); //make all links open in new tab
								//resolve(data.parse.text);
							});
					});
					return `
					<li ${props}>
					</li>`;
				}
			},
			getResultValue: result => config.getResultValue(result),
			onSubmit: result => {
				//console.log(result); 
				config.onSubmit(result);
			}
		});
	}

	static createCopyPageDialog(_config) {
		var defaultConfig = {"title": "", "template": mw.config.get("wgPageName"), "hide_template": true, "hide_template_preview": true};
		_config = {...defaultConfig, ..._config};
		//_config.beforeSubmit = (targetTitle) => {return mwjson.api.copyPage(_config.sourceTitle, targetTitle)};
		mwjson.editor.createPageDialog(_config);
	}

	static createSubpageDialog(_config) {
		var defaultConfig = {"superpage": mw.config.get("wgPageName"), "namespace": "", "title": ""};
		_config = {...defaultConfig, ..._config};
		mwjson.editor.createPageDialog(_config);
	}

	static createPageDialog(_config) {
		var defaultConfig = {
			"superpage": "", 
			"namespace": "", 
			"title": "", 
			"hide_title": false,
			"template": "",
			"hide_template": false, 
			"hide_template-preview": false, 
			"template_query": "",
			msg: {
				"dialog-title": "Create new page",
				"continue": "Continue", 
				"cancel": "Cancel", 
				"title-label": "Click continue to create a page with the given name", 
				"template-label": "Here you can select an optional template (any existing site).", 
				'template-preview-label': "Preview",
				"page-exists-warning": "Page does exist. Overwrite?"
			},
			redirect: (page) => {
				var params = {"veaction": "edit"};
				if (!page.exists) params["redlink"] = 1;
				return new mw.Title( page.title ).getUrl(params);
			},
			new_window: false
		};
		defaultConfig.template_autocomplete = {
			div_id : "autocomplete",
			//preview_div_id: "autocomplete-preview", //static for now
			query: input => "[[Display_title_of::like:*" + input + "*]]OR[[like:*" + input + "*]]|?Display_title_of=HasDisplayName|?HasDescription", // adding [[!~*QUERY*]] seams incompatible with OR operator
			minInputLen: 0,
			filter: (result, input) => {
				if (result.fulltext.includes("QUERY")) return false; //filter out SMW Query subobjects
				if (result.printouts['HasDisplayName'][0]) return result.printouts['HasDisplayName'][0].toLowerCase().includes(input.toLowerCase());
				else return result.fulltext.split(":")[result.fulltext.split(":").length - 1].toLowerCase().includes(input.toLowerCase());
			},
			_renderMode: "html",
			_renderResult: (result, props) => `
			<li ${props}>
				<div class="wiki-title">
					${result.printouts['HasDisplayName'][0] ? result.printouts['HasDisplayName'][0] + " (" : ""} ${result.fulltext} ${result.printouts['HasDisplayName'][0] ? ")" : ""}
				</div>
			</li>
			<div class="wiki-snippet">
			${result.printouts['HasDescription'][0] ? result.printouts['HasDescription'][0] : ""}
			</div>
			`,
			renderMode: "wikitext",
            renderResult: (result, props) => {
                var wikitext = "";
                wikitext += `[[${result.fulltext}|${mwjson.util.stripNamespace(result.fulltext)}]]`;
                if (result.printouts['HasDescription'][0]) wikitext += `</br>${result.printouts['HasDescription'][0]}`;
                return wikitext;
            },
			getResultValue: result => {
				if (result.printouts['HasDisplayName'][0]) return result.printouts['HasDisplayName'][0];
				else return result.fulltext.split(":")[result.fulltext.split(":").length - 1];
			},
			onSubmit: result => { 
				_config.template = result.fulltext;
				var renderUrl = '/w/api.php?action=parse&format=json&page=';
				renderUrl += encodeURIComponent(result.fulltext);
				new Promise(resolve => {
					//console.log("Render-URL: " + renderUrl);
					fetch(renderUrl)
						.then(response => response.json())
						.then(data => {
							//console.log("Parsed: " + data.parse.text);
							//console.log("ID = " + props.id);
							$("#" + 'autocomplete-preview').html($(data.parse.text['*']));
							$("#" + 'autocomplete-preview').find("a").attr("target", "_blank"); //make all links open in new tab
							//resolve(data.parse.text);
						});
				});
			}
		}
		_config = mwjson.util.mergeDeep(defaultConfig, _config);

		//inject a page modification before safing the new page
		if (_config.modifications) {
			_config.modify = (page) => {
				const deferred = $.Deferred(); 
				//console.log(page.dict);
				mwjson.parser.parsePageAsync(page).then((page) => {
					_config.modifications.forEach(mod => {
						if (typeof mod.value === 'function') mod.value = mod.value(_config);
						mwjson.parser.set_template_param(page, mod.template, mod.path, mod.value);
					});
					mwjson.parser.updateContent(page);
					console.log(page.dict);
					deferred.resolve(page); 
				});
				return deferred.promise();
			}
		}

		// Make a subclass of ProcessDialog 
		function Dialog(config) {
			Dialog.super.call(this, config);
		}
		OO.inheritClass(Dialog, OO.ui.ProcessDialog);

		// Specify a name for .addWindows()
		Dialog.static.name = 'CreatePageDialog';
		// Specify the static configurations: title and action set
		Dialog.static.title = _config.msg["dialog-title"];
		Dialog.static.actions = [
			{
				flags: 'primary',
				label: _config.msg['continue'],
				action: 'create'
			},
			{
				flags: 'safe',
				label: _config.msg['cancel']
			}
		];

		// Customize the initialize() function to add content and layouts: 
		Dialog.prototype.initialize = function () {
			Dialog.super.prototype.initialize.call(this);
			this.panel = new OO.ui.PanelLayout({
				padded: true,
				expanded: false
			});
			this.content = new OO.ui.FieldsetLayout();

			/*this.templateInput = new OO.ui.TextInputWidget();

			this.templateField = new OO.ui.FieldLayout(this.templateInput, {
				label: 'Chose a template',
				align: 'top'
			});*/

			//_config.template_autocomplete.onSubmit = (result) => {this.template = result.fulltext; console.log(this.template);};
			var $autocomplete = $('<span>' + _config.msg['template-label'] + '</span><div style="height: auto"><div id="autocomplete"><input class="autocomplete-input"></input><ul class="autocomplete-result-list"></ul></div></div>' );
			if (_config.hide_template) $autocomplete.hide();
			this.content.$element.append($autocomplete);
			if (!_config.hide_template_preview) this.content.$element.append('<span>' + _config.msg['template-preview-label'] + '</span><div id="autocomplete-preview" style="height: 400px; border: 1px solid #ccc; border-radius: 8px;"></div>');

			this.titleInput = new OO.ui.TextInputWidget();

			this.field = new OO.ui.FieldLayout(this.titleInput, {
				label: _config.msg['title-label'],
				align: 'top'
			});
			if (_config.hide_title) this.field.$element.hide();

			this.content.addItems([this.field]);
			this.panel.$element.append(this.content.$element);
			this.$body.append(this.panel.$element);

			mwjson.editor.createAutocompleteInput(_config.template_autocomplete);

			this.titleInput.connect(this, { 'change': 'onTitleInputChange' });
		};

		// Specify any additional functionality required by the window (disable creating an empty URL, in this case)
		Dialog.prototype.onTitleInputChange = function (value) {
			this.actions.setAbilities({
				create: !!value.length
			});
		};

		// Specify the dialog height (or don't to use the automatically generated height).
		Dialog.prototype.getBodyHeight = function () {
			// Note that "expanded: false" must be set in the panel's configuration for this to work.
			// When working with a stack layout, you can use:
			//   return this.panels.getCurrentItem().$element.outerHeight( true );
			return this.panel.$element.outerHeight(true);
		};

		// Use getSetupProcess() to set up the window with data passed to it at the time 
		// of opening (e.g., pageTitle: '', in this example). 
		Dialog.prototype.getSetupProcess = function (data) {
			data = data || {};
			return Dialog.super.prototype.getSetupProcess.call(this, data)
				.next(function () {
					// Set up contents based on data
					this.titleInput.setValue(data.pageTitle);
				}, this);
		};

		// Specify processes to handle the actions.
		Dialog.prototype.getActionProcess = function (action) {
			if (action === 'create') {
				// Create a new process to handle the action
				return new OO.ui.Process(function () {
					var title = "";
					if (_config.namespace) title += _config.namespace + ":";
					if (_config.superpage) title += _config.superpage + "/";
					title += this.titleInput.getValue();

					if (_config.template !== "" && !_config.beforeSubmit) _config.beforeSubmit = (targetTitle, template) => {return mwjson.api.copyPage(template, targetTitle, "", _config.modify)};

					if (_config.beforeSubmit) {
						_config.beforeSubmit(title, _config.template).then(() => {
							mwjson.api.getPage(title).then((page) => {
								var url = _config.redirect(page);
								if (url && url !== "") {
									if (_config.new_window) window.open(_config.redirect(page)); //new tab
									else window.location.href = _config.redirect(page); //same tab
								}
							});
						});
					}
					else {
						mwjson.api.getPage(title).then((page) => {
							var url = _config.redirect(page);
							console.log(url);
							if (url && url !== "") {
								if (_config.new_window) window.open(_config.redirect(page)); //new tab
								else window.location.href = _config.redirect(page); //same tab
							}
						});
					}

				}, this);
			}
			// Fallback to parent handler
			return Dialog.super.prototype.getActionProcess.call(this, action);
		};

		// Use the getTeardownProcess() method to perform actions whenever the dialog is closed. 
		// This method provides access to data passed into the window's close() method 
		// or the window manager's closeWindow() method.
		Dialog.prototype.getTeardownProcess = function (data) {
			return Dialog.super.prototype.getTeardownProcess.call(this, data)
				.first(function () {
					// Perform any cleanup as needed
					this.manager.$element.remove(); //delete dialog DOM
				}, this);
		};

		// Create and append a window manager.
		var windowManager = new OO.ui.WindowManager();
		$(document.body).append(windowManager.$element);

		// Create a new process dialog window.
		var dialog = new Dialog();

		// Add the window to window manager using the addWindows() method.
		windowManager.addWindows([dialog]);

		// Open the window!   
		windowManager.openWindow(dialog, { pageTitle: _config.title });
	}
}
