/*@nomin*/

mwjson.editor = class {
	constructor(config) {
		var defaultConfig = {
			target_slot: 'main',
			target_namespace: 'Item',
			mode: "default", // options: default, query
			lang: mw.config.get('wgUserLanguage'),
			id: 'json-editor-' + mwjson.util.getShortUid(),
			onsubmit: (json) => this.onsubmit(json)
		};
		this.config = mwjson.util.mergeDeep(defaultConfig, config);
		this.flags = {'change-after-load': false};
		if (this.config.container) {
			this.container = this.config.container;
			this.config.popup = false;
		}
		else {
			this.createPopupDialog(this.config.popupConfig);
			this.container = document.getElementById(this.config.id);
			this.config.popup = true;
		}

		this.jsonschema = new mwjson.schema({jsonschema: this.config.schema, config: {mode: this.config.mode, lang: this.config.lang}, debug: true});
		this.jsonschema.bundle()
			.then(() => this.jsonschema.preprocess())
			.then(() => {
				console.log("create editor");
				this.createEditor();
			})
			.catch((err) => {
				console.error(err);
			});
		console.log("constructor done");
	}

	createEditor() {
		//return function(err, config) {

		//console.log(this);

		//JSONEditor.defaults.language = "de";
		this.config.JSONEditorConfig = this.config.JSONEditorConfig || {};
		
		var defaultJSONEditorConfig = {
			schema: this.jsonschema.getSchema(),
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
			form_name_root: this.jsonschema.getSchema().id
		}
		this.config.JSONEditorConfig = mwjson.util.mergeDeep(defaultJSONEditorConfig, this.config.JSONEditorConfig);
		console.log(this.config.JSONEditorConfig);

		//create editor
		this.jsoneditor = new JSONEditor(this.container, this.config.JSONEditorConfig);
		console.log(this.config.data);

		if (!this.config.popup) {
			$(this.container).append($("<button type='Button' class='btn btn-primary btn-block' id='save-form'>Save</button>"));
			$("#save-form").click(() => {
				this._onsubmit(this.jsoneditor.getValue());
			});
		}

		// listen for loaded
		this.jsoneditor.on('ready', () => {
			console.log("Editor loaded");
			this.flags["change-after-load"] = true;
			console.log(this.jsoneditor);
			if (this.config.data) this.jsoneditor.setValue(this.config.data);
			if (this.config.target) mwjson.api.getPage(this.config.target).then((page) => {
				//return;
				if (page.content_model[this.config.target_slot] === 'wikitext') {
					mwjson.parser.parsePage(page);
					this.targetPage = page;
					//load data from page if exist
					if (this.targetPage.content !== "") {
						console.log("Load data:", this.targetPage.dict);
						var schemaJson = mwjson.editor.mwjson.parser.wikiJson2SchemaJson(this.targetPage.dict);
						console.log(schemaJson);
						this.jsoneditor.setValue(schemaJson);
					}
				}
				if (page.content_model[this.config.target_slot] === 'json') {
					console.log(page.slots[this.config.target_slot]);
					this.jsoneditor.setValue(page.slots[this.config.target_slot]);
				}
			})
		});

		// listen for changes
		this.jsoneditor.on('change', () => {
			console.log("Editor changed");
			console.log(this.jsoneditor.schema);
			console.log(this.jsoneditor.getValue());
			//console.log(this.jsoneditor.editors);

			var labeled_inputs = [];
			var label_requests = [];

			for (var subeditor_path of Object.keys(this.jsoneditor.editors)) {
				var subeditor = this.jsoneditor.editors[subeditor_path];
				if (!subeditor) continue;

				var input = subeditor.input
				var $input = $(input);

				//collect autocomplete field values to fetch labels
				if (subeditor.format === 'autocomplete') {// && this.flags["change-after-load"]) {
					//console.log("Autocomplete Editor:", subeditor);
					//console.log("Dirty: ", subeditor.is_dirty);
					if (input.value_id && input.value_label) { //label already fetched 
						input.value = input.value_label;
						subeditor.value = input.value_id; //will be applied on the next .getValue() call
						subeditor.is_dirty = false;
					}
					else if (subeditor.value !== ""){
						labeled_inputs.push({input: input, value_id: subeditor.value});
						label_requests.push(subeditor.value);
					}
				}

				//BUG: Does not save value in original text field (only if source mode is toggled). See PageForms extension
				if (subeditor.options && subeditor.options.wikieditor === 'visualeditor') {
					if (!subeditor.visualEditor) {
						console.log("Create VisualEditor for ", input);
						$input.attr('type', 'textarea');
						$input.addClass('toolbarOnTop');
						if ( $.fn.applyVisualEditor ) subeditor.visualEditor = $input.applyVisualEditor();
						else $(document).on('VEForAllLoaded', function(e) { 
							subeditor.visualEditor = $input.applyVisualEditor(); 
						});
						//$('.ve-ui-surface-visual').addClass('form-control');
					}
					console.log("Original field value: ", subeditor.input.value);
				}
				//BUG: Text is hidden until user clicks in textarea. Does not save value in original text field.
				if (subeditor.options && subeditor.options.wikieditor === 'codemirror') {

					if (!subeditor.codeMirror) {
						console.log("Create CodeMirror for ", input);
						$input.attr('type', 'textarea');
						$input.attr('data-ve-loaded', true);

						//from https://phabricator.wikimedia.org/diffusion/ECMI/browse/master/resources/ext.CodeMirror.js$210
						var cmOptions = {
							mwConfig: mw.config.get('extCodeMirrorConfig'),
							// styleActiveLine: true, // disabled since Bug: T162204, maybe should be optional
							lineWrapping: true,
							lineNumbers: true,
							readOnly: false,
							// select mediawiki as text input mode
							mode: 'text/mediawiki',
							extraKeys: {
								Tab: false,
								'Shift-Tab': false,
								// T174514: Move the cursor at the beginning/end of the current wrapped line
								Home: 'goLineLeft',
								End: 'goLineRight'
							},
							inputStyle: 'contenteditable',
							spellcheck: true,
							viewportMargin: Infinity
						};
						var codeMirror = CodeMirror.fromTextArea(input, cmOptions);
						var $codeMirror = $(codeMirror.getWrapperElement());

						//codeMirror.scrollTo( null, $input.scrollTop(), );
						$(codeMirror.getInputField())
							// T259347: Use accesskey of the original textbox
							.attr('accesskey', $input.attr('accesskey'))
							// T194102: UniversalLanguageSelector integration is buggy, disabling it completely
							.addClass('noime');

						codeMirror.refresh();
						//mw.hook('ext.CodeMirror.switch').fire(true, $codeMirror);
						subeditor.codeMirror = codeMirror;
					}
					else {
						subeditor.codeMirror.save(); //update original input field
					}
					//$('.CodeMirror-scroll').each(function() {console.log(this); this.dispatchEvent(new Event('click')) });
					//$('.CodeMirror-wrap').each(function() {this.dispatchEvent(new Event('click')) });
				}
			}

			//fetch labels
			if (label_requests.length) mwjson.api.getLabels(label_requests).then((label_dict) => {
				for (const labeled_input of labeled_inputs) {
					console.log("Set label " + label_dict[labeled_input.value_id] + " for " + labeled_input.input.value);
					labeled_input.input.value_id = labeled_input.value_id;
					labeled_input.input.value_label = label_dict[labeled_input.value_id];
					labeled_input.input.value = labeled_input.input.value_label;
				}
			});

			this.flags["change-after-load"] = false;
		});

		// listen for array changes
		this.jsoneditor.on('addRow', editor => {
			//console.log('addRow', editor)
		});
	};

	getSyntaxErrors() {
		var errors = []
		for (var subeditor_path of Object.keys(this.jsoneditor.editors)) {
			var subeditor = this.jsoneditor.editors[subeditor_path];
			if (!subeditor) continue;
			if(subeditor.ace_editor_instance) {
				for (var error of subeditor.ace_editor_instance.getSession().getAnnotations()) {
					if (error.type == 'error') {
						error.editor_path = subeditor.path;
						error.editor_label = subeditor.label.innerText;
						errors.push(error)
					}
				}
			}
		}
		return errors;
	}

	_onsubmit(json) {
		const promise = new Promise((resolve, reject) => {
			if(this.getSyntaxErrors().length) {
				OO.ui.confirm( 
					mw.message("mwjson-editor-fields-contain-syntax-error").text() 
					+ ". " + mw.message("mwjson-editor-save-anyway").text() 
					).done( ( confirmed ) => {
					if ( confirmed ) {
						mw.notify(mw.message("mwjson-editor-do-not-close-window").text(), { title: mw.message("mwjson-editor-saving").text() + "...", type: 'warn'});
						const submit_promise = this.config.onsubmit(json);
						if (submit_promise) submit_promise.then(() => resolve()).catch();
						else resolve();
						mw.notify(mw.message("mwjson-editor-saved").text(), { type: 'success'});
					} else {
						reject();
					}
				} );
			}
			else {
				mw.notify(mw.message("mwjson-editor-do-not-close-window").text(), { title: mw.message("mwjson-editor-saving").text() + "...", type: 'warn'});
				const submit_promise = this.config.onsubmit(json);
				if (submit_promise) submit_promise.then(() => resolve()).catch();
				else resolve();
				mw.notify(mw.message("mwjson-editor-saved").text(), { type: 'success'});
			}
		});
		return promise;
	}

	onsubmit(json) {
		if (this.config.mode === 'default') return this.onsubmitPage(json);
		else if (this.config.mode === 'query') return this.onsubmitQuery(json);
	}

	onsubmitPage(json) {
		const promise = new Promise((resolve, reject) => {
			if (!this.config.target) {
				this.config.target = "";
				if (this.config.target_namespace !== "") this.config.target += this.config.target_namespace + ":";
				this.config.target += mwjson.util.OslId(json.uuid);
			}
			console.log("Save form");
			var url = window.location.href.replace(/\?.*/, '');
			url += '?target=' + encodeURIComponent(this.config.target);
			url += '&data=' + encodeURIComponent(mwjson.util.objectToCompressedBase64(json));

			console.log(JSON.stringify(json));
			mwjson.api.getPage(this.config.target).then((page) => {
				if (page.content_model[this.config.target_slot] === 'wikitext') {
					page.content = mwjson.editor.mwjson.parser.data2template(json)
					//add edit link with base64 encode data
					//page.content = "<noinclude>[" + url + " Edit Template]</noinclude>\n<br\>" + page.content;
					page.changed = true;
					//console.log(page.content);
					var wikiJson = mwjson.editor.mwjson.parser.schemaJson2WikiJson(json)
					page.dict = wikiJson;
					mwjson.parser.updateContent(page);
					console.log(wikiJson);
					console.log(page.content);
				}
				if (page.content_model[this.config.target_slot] === 'json') {
					page.slots[this.config.target_slot] = json;
					page.slots_changed[this.config.target_slot] = true;
				}
				mwjson.api.updatePage(page, "Edited with JsonEditor").then(() => {
					resolve();
					window.location.href = "/wiki/" + page.title
				});
			}).catch();
		});
		return promise;
		//mwjson.parser.parsePage(page)
		//console.log(page.dict);
		/*return;
		console.log(this.targetPage.data);
		if (Array.isArray(this.targetPage.data)) {
			this.targetPage.data.forEach((template, index) => {
				Object.assign(template, this.jsoneditor.getValue()[index]);
				wikitext = mwjson.parser.data2template(template);
				template._token.clear();
				template._token.push(wikitext);
			});
		}
		else {
			var template = this.targetPage.data;
			Object.assign(template, this.jsoneditor.getValue());
			wikitext = mwjson.parser.data2template(template);
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

	onsubmitQuery(json) {
		const $result_container = $('#' + this.config.result_container_id);
		$result_container.html("");
		var wikitext = this.jsonschema.getSemanticQuery({jsondata: json}).wikitext;
		console.log("wikitext", wikitext);
		var renderUrl = '/w/api.php?action=parse&format=json&text=';
		renderUrl += encodeURIComponent(wikitext);
		new Promise(resolve => {
			//console.log("Render-URL: " + renderUrl);
			fetch(renderUrl)
				.then(response => response.json())
				.then(data => {
					//console.log("Parsed: " + data.parse.text);
					$result_container.html($(data.parse.text['*']));
					//$result_container.find("a").attr("target", "_blank"); //make all links open in new tab
				});
		});
	}

	static init() {

		const deferred = $.Deferred();
		if (!('ready' in mwjson.editor) || !mwjson.editor.ready) {
			mw.loader.load('https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css', 'text/css');
			mwjson.parser.init();
			$.when(
				//$.getScript("https://cdn.jsdelivr.net/npm/@json-editor/json-editor@latest/dist/jsoneditor.js"),
				//$.getScript("https://unpkg.com/imask"),
				//$.getScript("https://cdn.jsdelivr.net/npm/ace-builds@latest/src-noconflict/ace.min.js"),
				mw.loader.using('ext.codeEditor.ace'), //loading ace.min.js leads to styling issues (css conflict with codeEditor?)
				mw.loader.using('ext.veforall.main'),
				mw.loader.using('ext.geshi.visualEditor'),
				mw.loader.using('ext.CodeMirror.lib'),
				mw.loader.using('ext.CodeMirror.mode.mediawiki'),
				mw.loader.using('ext.CodeMirror'),
				//mw.loader.using('ext.wikiEditor'),
				//$.getScript("/w/extensions/MwJson/modules/ext.MwJson.editor/json-schema-ref-parser.js"),
				$.Deferred(function (deferred) {
					$(deferred.resolve);
				})
			).done(function () {

				//fetch all i18n msgs
				var msg_promises = [];
				var msg_counter = 0;
				var msgs = [
					"mwjson-editor-saving",
					"mwjson-editor-fields-contain-syntax-error",
					"mwjson-editor-save-anyway",
					"mwjson-editor-do-not-close-window",
					"mwjson-editor-saved",
					"mwjson-editor-error",
					"mwjson-editor-error-occured-while-saving",
				];
				for (var key of Object.keys(JSONEditor.defaults.languages.en)) {
					msgs.push("json-editor-" + key);
					msg_counter += 1;
					if (msg_counter >= 50) { //split in packages of max 50 msgs due to api limit for standard users
						msg_promises.push(new mw.Api().loadMessagesIfMissing(msgs));
						msgs = [];
						msg_counter = 0;
					}
				}
				if (msgs.length > 0) msg_promises.push(new mw.Api().loadMessagesIfMissing(msgs)); //fetch remaining msgs

				$.when(
					mw.loader.using('ext.mwjson.editor.ace'),
					//$.getScript("https://cdn.jsdelivr.net/npm/ace-builds@latest/src-noconflict/theme-vibrant_ink.js"),  //depends on ace loaded
					//$.getScript("https://cdn.jsdelivr.net/npm/ace-builds@latest/src-noconflict/mode-json.js"),
					//$.getScript("https://cdn.jsdelivr.net/npm/ace-builds@latest/src-noconflict/mode-handlebars.js"),
					Promise.allSettled(msg_promises),
					$.Deferred(function (deferred) {
						$(deferred.resolve);
					})
				).done(function () {
					for (var key of Object.keys(JSONEditor.defaults.languages.en)) {
						//replace with mediawiki i18n
						JSONEditor.defaults.languages.en[key] = mw.message("json-editor-" + key).text().replaceAll('((', '{{').replaceAll('))', '}}');
					}
					mwjson.editor.setCallbacks();
					mwjson.editor.setDefaultOptions();
					console.log("JsonEditor initialized");
					deferred.resolve();
				});
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
		};
		window.JSONEditor.defaults.options.labelTemplate = "{{#if result.printouts.label.length}}{{result.printouts.label}}{{else if result.displaytitle}}{{result.displaytitle}}{{else}}{{result.fulltext}}{{/if}}";
		window.JSONEditor.defaults.options.previewWikiTextTemplate = "[[{{result.fulltext}}]]";
		window.JSONEditor.defaults.options.ace = {
			//"theme": "ace/theme/vibrant_ink",
			"tabSize": 4,
			"useSoftTabs": true,
			"wrap": true,
			"useWorker": true
		};
		ace.config.set("basePath", "/w/extensions/MwJson/modules/ext.MwJson.editor.ace");
		ace.config.set("workerPath", "/w/extensions/MwJson/modules/ext.MwJson.editor.ace");
		ace.config.setModuleUrl('ace/mode/json_worker', "/w/extensions/MwJson/modules/ext.MwJson.editor.ace/worker-json.js");
		window.JSONEditor.defaults.options.upload.upload_handler = "fileUpload";
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
					jseditor_editor.input.value_label = label;
					return label;
				},
				//... but store the fulltext / id
				onSubmit_smw: (jseditor_editor, result) => {
					console.log("Selected: " + result.displaytitle + " / " + result.fulltext);
					jseditor_editor.value = result.fulltext;
					jseditor_editor.input.value_id = result.fulltext;
					jseditor_editor.onChange(true);
				},
			},
			upload: {
				fileUpload: (jseditor, type, file, cbs) => {
					console.log("Upload file", file);
					var target = mwjson.util.OslId() + "." + file.name.split('.').pop();
					Object.defineProperty(file, 'name', {writable: true, value: target}); //name is readonly, so file.name = target does not work
					mwjson.api.getFilePage(target).done((page) => {
						console.log("File does exists");
						page.file = file;
						page.file.contentBlob = file;
						page.file.changed = true;
						mwjson.api.updatePage(page).done((page) => {
							console.log("Upload succesful");
							cbs.success('File:' + target);
						}).fail(function (error) {
							console.log("Upload failed:", error);
							cbs.failure('Upload failed:' + error);
						});
					}).fail(function (error) {
						console.log("File does not exists");
						mwjson.api.getPage("File:" + target).done((page) => {
							page.file = file;
							page.file.contentBlob = file;
							page.file.changed = true;
							mwjson.api.updatePage(page).done((page) => {
								console.log("Upload succesful");
								cbs.success('File:' + target);
							}).fail(function (error) {
								console.log("Upload failed:", error);
								cbs.failure('Upload failed:' + error);
							});
						});
					});
					
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
}
