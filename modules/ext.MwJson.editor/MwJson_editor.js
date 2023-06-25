/*@nomin*/

mwjson.editor = class {
	constructor(config) {
		var defaultConfig = {
			target_slot: 'main',
			target_namespace: 'Item',
			mode: "default", // options: default, query
			submit_enabled: true, //if true, add save button
			lang: mw.config.get('wgUserLanguage'),
			id: 'json-editor-' + mwjson.util.getShortUid(),
			onsubmit: (json) => this.onsubmit(json),
			onchange: (json) => {}
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
				this.createUI();
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
			theme: 'bootstrap4',
			iconlib: "spectre",
			remove_button_labels: true,
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
		this.config.JSONEditorConfig.schema = this.jsonschema.getSchema(),
		console.log(this.config.JSONEditorConfig);

		//create editor
		this.jsoneditor = new JSONEditor(this.container, this.config.JSONEditorConfig);
		console.log(this.config.data);

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
					this.jsoneditor.setValue(page.slots[this.config.target_slot] ? page.slots[this.config.target_slot] : {});
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
					console.log("Autocomplete Editor:", subeditor);
					console.log("Dirty: ", subeditor.is_dirty);
					if (input.value_id && input.value_label) { //label already fetched 
						input.value = input.value_label;
						subeditor.value = input.value_id; //will be applied on the next .getValue() call
						if (subeditor.is_dirty) subeditor.change(); //resets aborted user input
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

				if (subeditor.options && subeditor.options.wikieditor === 'jsoneditors') {
					if (!subeditor.jsoneditors) {
						console.log("Create JSONEditors for ", input);
						$input.hide();
						var $parent = $input.parent();
						$parent.append('<div class="jsoneditors" style="height: 500px; resize: vertical; overflow: auto;"></div>');
						var container = $parent.find(".jsoneditors")[0];
						var options = {
							mode: 'code',
							modes: ['code', 'form', 'text', 'tree', 'view', 'preview'], // allowed modes
							onChangeText: (function(jsonString){
								//input.value = jsonString;
								this.value = jsonString;
								this.change();
							}).bind(subeditor) //arrow function binding to loop var subeditor does not work 
						}
						subeditor.jsoneditors = new JSONEditors(container, options);
						subeditor.jsoneditors.set(JSON.parse(subeditor.input.value));
					}
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

			if (this.config.onchange) this.config.onchange(this.jsoneditor.getValue());

			if (this.data_jsoneditors) {
				var jsondata = this.jsoneditor.getValue();
				jsondata = mwjson.util.mergeDeep({"@context": this.jsonschema.getContext()}, jsondata)
				console.log("add context", this.jsonschema.getContext());
				this.data_jsoneditors.set(jsondata);
			}
		});

		// listen for array changes
		this.jsoneditor.on('addRow', editor => {
			//console.log('addRow', editor)
		});
	}

	createUI() {
		if (this.config.submit_enabled && (!this.config.popup || this.config.mode === 'query')) {
			var btn_label = mw.message("mwjson-editor-submit-save").text();
			if (this.config.mode === 'query') btn_label = mw.message("mwjson-editor-submit-query").text();
			const btn_id = this.config.id + "_save-form";
			$(this.container).append($("<button type='Button' class='btn btn-primary btn-block' id='" + btn_id + "'>" + btn_label + "</button>"));
			$("#" + btn_id).click(() => {
				console.log("Query");
				this._onsubmit(this.jsoneditor.getValue());
			});
		}

		if (this.jsonschema.data_source_maps.length && this.config.mode === 'default') {
			//console.log(this.jsonschema.data_source_maps);
			for (const [index, data_source_map] of this.jsonschema.data_source_maps.entries()) {
				if (!data_source_map.label) data_source_map.label = data_source_map.source.substring(0, 20) + "...";
				var btn_label = mw.message("mwjson-editor-fetch-external-data", data_source_map.label).text();
				if (data_source_map.required) {
					var required_prop_names = "";
					for (const required_prop of data_source_map.required) required_prop_names += this.jsonschema.getPropertyDefinition(required_prop).title + ", ";
					required_prop_names = required_prop_names.slice(0,-2);
					btn_label += " (" + mw.message("mwjson-editor-fetch-external-data-requires", required_prop_names).text() + ")";
				}
				$(this.container).append($("<button type='Button' class='btn btn-primary btn-block' id='fetch-external-data-" + index + "'>" + btn_label + "</button>"));
				this.jsoneditor.on('change', () => {
					var enabled = true;
					var jsondata = this.jsoneditor.getValue();
					for (const required_prop of data_source_map.required) if (!jsondata[required_prop]) enabled = false;
					$("#fetch-external-data-" + index).prop('disabled', !enabled);
				});
				$("#fetch-external-data-" + index).click(() => {
					$("#fetch-external-data-" + index).text(btn_label + ": Running...").css('background-color', 'orange');
					mwjson.extData.fetchData([data_source_map], this.jsoneditor.getValue()).then((jsondata) => {
						$("#fetch-external-data-" + index).text(btn_label + ": Done.").css('background-color', 'green');
						this.jsoneditor.setValue(jsondata);
					});
				});
			}
		}

		if (this.config.schema_editor) {
			var options = {
				mode: 'code',
				modes: ['code', 'form', 'text', 'tree', 'view', 'preview'], // allowed modes
			}
			var container = $("#" + this.config.schema_editor.container_id);
			container.addClass('mwjson-code-container')
			var editor_container = $('<div class="mwjson-code-editor-container"></div>');
			container.append(editor_container);
			this.schema_jsoneditors = new JSONEditors(editor_container[0], options);
			this.schema_jsoneditors.set(this.config.schema);
			var btn_label = "Update";
			const btn_id = this.config.id + "_load-schema";
			container.append($("<button type='Button' class='btn btn-primary btn-block' id='" + btn_id + "'>" + btn_label + "</button>"));
			$("#" + btn_id).click(() => {
				this.setSchema({schema: this.schema_jsoneditors.get()});
			});
		}
		if (this.config.data_editor) {
			var options = {
				mode: 'code',
				modes: ['code', 'form', 'text', 'tree', 'view', 'preview'], // allowed modes
				onChangeText: (jsonString) => {
					var jsondata = JSON.parse(jsonString);
					if (jsondata['@context']) delete jsondata['@context'];
					this.jsoneditor.setValue(jsondata);
				}
			}
			var container = $("#" + this.config.data_editor.container_id);
			container.addClass('mwjson-code-container')
			var editor_container = $('<div class="mwjson-code-editor-container"></div>');
			container.append(editor_container);
			this.data_jsoneditors = new JSONEditors(editor_container[0], options);
			//subeditor.jsoneditors.set(JSON.parse(subeditor.input.value));
			var btn_label = "Download";
			const btn_id = this.config.id + "_download_jsonld";
			container.append($("<a type='Button' class='btn btn-primary btn-block' id='" + btn_id + "' style='color:white'>" + btn_label + "</a>"));
			$("#" + btn_id).click(() => {
				//var jsondata = this.jsoneditor.getValue();
				//jsondata = mwjson.util.mergeDeep({"@context": this.jsonschema.getContext()}, jsondata)
				//console.log("add context", this.jsonschema.getContext());
				var jsondata = this.data_jsoneditors.get();
				mwjson.util.downloadTextAsFile("metadata.jsonld", JSON.stringify(jsondata, null, 4));
			});
		}
	}

	getSyntaxErrors() {
		const promise = new Promise((resolve, reject) => {
		var errors = []
			var validation_promises = [];
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
				if (subeditor.jsoneditors) {
					validation_promises.push(subeditor.jsoneditors.validate())
		}
			}
			if (validation_promises.length) {
				Promise.allSettled(validation_promises).then((results) => {
					for (const result of results) {
						for (var error of result.value) {
							if (error.type == 'error') {
								error.editor_path = subeditor.path;
								error.editor_label = subeditor.label.innerText;
								errors.push(error)
							}
						}
					}
					resolve(errors);
				});
			}
			else {
				resolve(errors);
			}
		});
		return promise;
	}

	setData(params) {
		this.jsoneditor.setValue(params.jsondata);
	}

	getData() {
		return this.jsoneditor.getValue();
	}

	//sets a new jsonschema and reloads the editor to apply changes
	setSchema(params) {
		this.jsoneditor.destroy();
		this.config.schema = params.schema;
		this.jsonschema = new mwjson.schema({jsonschema: this.config.schema, config: {mode: this.config.mode, lang: this.config.lang}, debug: true});
		this.jsonschema.bundle()
			.then(() => this.jsonschema.preprocess())
			.then(() => {
				console.log("reload editor");
				this.createEditor();
			})
			.catch((err) => {
				console.error(err);
			});
	}

	_onsubmit(json, meta) {
		const promise = new Promise((resolve, reject) => {
			this.getSyntaxErrors().then((errors) => {
				if(errors.length) {
				OO.ui.confirm( 
					mw.message("mwjson-editor-fields-contain-syntax-error").text() 
					+ ". " + mw.message("mwjson-editor-save-anyway").text() 
					).done( ( confirmed ) => {
					if ( confirmed ) {
						if (this.config.mode !== 'query') mw.notify(mw.message("mwjson-editor-do-not-close-window").text(), { title: mw.message("mwjson-editor-saving").text() + "...", type: 'warn'});
						const submit_promise = this.config.onsubmit(json, meta);
							if (submit_promise) submit_promise.then(() => {
								resolve();
						if (this.config.mode !== 'query') mw.notify(mw.message("mwjson-editor-saved").text(), { type: 'success'});
							}).catch();
							else {
								resolve();
								if (this.config.mode !== 'query') mw.notify(mw.message("mwjson-editor-saved").text(), { type: 'success'});
							}
					} else {
						reject();
					}
				} );
			}
			else {
				if (this.config.mode !== 'query') mw.notify(mw.message("mwjson-editor-do-not-close-window").text(), { title: mw.message("mwjson-editor-saving").text() + "...", type: 'warn'});
				const submit_promise = this.config.onsubmit(json, meta);
					console.log(submit_promise);
					if (submit_promise) submit_promise.then(() => {
						resolve();
						if (this.config.mode !== 'query') mw.notify(mw.message("mwjson-editor-saved").text(), { type: 'success'});
					}).catch();
					else {
						resolve();
				if (this.config.mode !== 'query') mw.notify(mw.message("mwjson-editor-saved").text(), { type: 'success'});
			}
				}
		});
		});
		return promise;
	}

	onsubmit(json, meta) {
		if (this.config.mode === 'default') return this.onsubmitPage(json, meta);
		else if (this.config.mode === 'query') return this.onsubmitQuery(json, meta);
	}

	onsubmitPage(json, meta) {
		meta = meta || {}
		meta.comment = meta.comment || "Edited with JsonEditor";
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
				mwjson.api.updatePage(page, meta).then(() => {
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

	onsubmitQuery(json, meta) {
		const $result_container = $('#' + this.config.result_container_id);
		$result_container.html("");
		var wikitext = this.jsonschema.getSemanticQuery({jsondata: json}).wikitext;
		console.log("wikitext", wikitext);
		//var renderUrl = '/w/api.php?action=parse&format=json&text=';
		//renderUrl += encodeURIComponent(wikitext);
		new Promise(resolve => {
			//console.log("Render-URL: " + renderUrl);
			//fetch(renderUrl)
				//.then(response => response.json())
			mwjson.api.parseWikiText({text: wikitext, display_mode: "iframe", container: $result_container[0]})
				.then(result => {
					//console.log("Parsed: " + data.parse.text);
					//$result_container.html($(result.html));
					$result_container.find("iframe").contents().find("a").attr("target", "_blank"); //make all links open in new tab - does not work on dynamic content
					//mwjson.editor.initDataTables(); 
				});
		});
	}

	static init() {

		const mw_modules = [
			'ext.codeEditor.ace', //loading ace.min.js leads to styling issues (css conflict with codeEditor?)
			'ext.veforall.main',
			'ext.geshi.visualEditor',
			'ext.CodeMirror.lib',
			'ext.CodeMirror.mode.mediawiki',
			'ext.CodeMirror',
			//'ext.wikiEditor',
			//'ext.srf.datatables.bootstrap',
			//'smw.tableprinter.datatable', 'ext.smw.table.styles',
			//'ext.srf', 'ext.srf.api', 'ext.srf.util', 'ext.srf.widgets',
			//'ext.jquery.async','ext.jquery.atwho','ext.jquery.caret','ext.jquery.jStorage','ext.jquery.md5',
			//'ext.libs.tippy',
			//'ext.smw.api',
			//'ext.smw.data','ext.smw.dataItem','ext.smw.dataValue','ext.smw.purge','ext.smw.query','ext.smw.suggester','ext.smw.tooltips',
			//'ext.smw.suggester.textInput', 'smw.entityexaminer','smw.factbox','smw.tippy'
		];

		const deferred = $.Deferred();
		if (!('ready' in mwjson.editor) || !mwjson.editor.ready) {
			//mw.loader.load('https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css', 'text/css');
			//mw.loader.load('https://cdn.jsdelivr.net/npm/spectre.css@latest/dist/spectre-icons.min.css', 'text/css');
			mwjson.parser.init();
			$.when(
				//$.getScript("https://cdn.jsdelivr.net/npm/@json-editor/json-editor@latest/dist/jsoneditor.js"),
				//$.getScript("https://unpkg.com/imask"),
				//$.getScript("https://cdn.jsdelivr.net/npm/ace-builds@latest/src-noconflict/ace.min.js"),
				mw.loader.using(mw_modules), 
				//mw.loader.using('ext.wikiEditor'),
				//$.getScript("/w/extensions/MwJson/modules/ext.MwJson.editor/json-schema-ref-parser.js"),
				$.Deferred(function (deferred) {
					$(deferred.resolve);
				})
			).done(function () {

				//fetch all i18n msgs
				var msg_promises = [];
				
				var msgs = [
					"mwjson-editor-submit-save",
					"mwjson-editor-submit-query",
					"mwjson-editor-saving",
					"mwjson-editor-fields-contain-syntax-error",
					"mwjson-editor-save-anyway",
					"mwjson-editor-do-not-close-window",
					"mwjson-editor-saved",
					"mwjson-editor-error",
					"mwjson-editor-error-occured-while-saving",
				];
				var msg_counter = msgs.length;
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
			"autoSelect": "true",
			"debounceTime": 200
		};
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
					var query = mwjson.schema.getAutocompleteQuery(jseditor_editor.schema, input);
					
					for (const key in jseditor_editor.watched_values) {
						if (jseditor_editor.watched[key]) {
							var subeditor = jseditor_editor.jsoneditor.editors[jseditor_editor.watched[key]];
							if (subeditor) {
								//jseditor_editor.jsoneditor.editors[jseditor_editor.watched[key]].change(); //force value update
								//onChange is not called yet => explicite update autocomplete fields
								if (subeditor.format === 'autocomplete' && subeditor.input.value_id && subeditor.input.value_label) {
									subeditor.input.value = subeditor.input.value_label;
									subeditor.value = subeditor.input.value_id; //will be applied on the next .getValue() call
									if (subeditor.is_dirty) subeditor.change(); //resets aborted user input
									subeditor.is_dirty = false;
								}
							}
							query = query.replace('{{$(' + key + ')}}', '{{' + jseditor_editor.watched[key].replace("root.","") + '}}');
						}
						if (jseditor_editor.watched_values[key] === undefined) query = query.replace('$(' + key + ')', encodeURIComponent('+'));
						query = query.replace('$(' + key + ')', jseditor_editor.watched_values[key]);
					}

					var jsondata = jseditor_editor.jsoneditor.getValue();
					jsondata['_user_input'] = input;
					var template = Handlebars.compile(query);
					query = template(jsondata);
					var result_property = mwjson.schema.getAutocompleteResultProperty(jseditor_editor.schema);
					console.log("Search with schema: " + query);
					var url = `/w/api.php?action=ask&query=${query}|limit=10000&format=json`;
					//replace params
					console.log("URL: " + url);

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
								if (result_property) { //use objects as results
									resultList = [];
									Object.values(data.query.results).forEach(result => {
										resultList = resultList.concat(result.printouts[result_property])
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
					var previewTemplate = mwjson.util.deepCopy(mwjson.schema.getAutocompletePreviewTemplate(jseditor_editor.schema)); //use custom value
					if (previewTemplate.type.shift() === 'handlebars') {
						if (previewTemplate.type[0] === 'wikitext') previewTemplate.value = previewTemplate.value.replaceAll("\\{", "&#123;").replaceAll("\\}", "&#125;"); //escape curly-brackets with html entities. ToDo: Do this once for the whole schema
						var template = Handlebars.compile(previewTemplate.value);
						previewTemplate.value = template({ result: result });
						if (previewTemplate.type[0] === 'wikitext') previewTemplate.value = previewTemplate.value.replaceAll("&#123;", "{").replaceAll("&#125;", "}");
					}

					if (previewTemplate.type.shift() === 'wikitext') {
					var renderUrl = '/w/api.php?action=parse&format=json&text=';
						renderUrl += encodeURIComponent(previewTemplate.value);
						previewTemplate.value = "";
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
					}
					return `
					<li ${props}>${previewTemplate.value}
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
					var labelTemplate = mwjson.util.deepCopy(mwjson.schema.getAutocompleteLabelTemplate(jseditor_editor.schema)); //use custom value
					if (labelTemplate.type.shift() === 'handlebars') {
						label = Handlebars.compile(labelTemplate.value)({ result: result });
					}
					jseditor_editor.input.value_label = label;
					return label;
				},
				//... but store the fulltext / id
				onSubmit_smw: (jseditor_editor, result) => {
					console.log("Selected: " + result.displaytitle + " / " + result.fulltext);
					var result_value = result.fulltext;
					var storeTemplate = mwjson.util.deepCopy(mwjson.schema.getAutocompleteStoreTemplate(jseditor_editor.schema)); //use custom value
					if (storeTemplate && storeTemplate.type.shift() === 'handlebars') {
						result_value = Handlebars.compile(storeTemplate.value)({ result: result });
					}
					jseditor_editor.value = result_value;
					jseditor_editor.input.value_id = result_value;
					jseditor_editor.onChange(true);
					if (jseditor_editor.schema.options.autocomplete.field_maps) {
						for (const map of jseditor_editor.schema.options.autocomplete.field_maps) {
							var value = mwjson.extData.getValue({result: result}, map.source_path, "jsonpath");
							if (map.template) value = Handlebars.compile(map.template)(value);
							var target_editor = map.target_path;
							for (const key in jseditor_editor.watched_values) target_editor = target_editor.replace('$(' + key + ')', jseditor_editor.watched[key]);
							if (jseditor_editor.jsoneditor.editors[target_editor]) {
								jseditor_editor.jsoneditor.editors[target_editor].setValue(value);
							}
						}
					}
				},
			},
			upload: {
				fileUpload: (jseditor, type, file, cbs) => {
					console.log("Upload file", file);
					const label = file.name;
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
							mw.hook( 'jsoneditor.file.uploaded' ).fire({exists: false, name: target, label: label});
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
								mw.hook( 'jsoneditor.file.uploaded' ).fire({exists: false, name: target, label: file.name});
							}).fail(function (error) {
								console.log("Upload failed:", error);
								cbs.failure('Upload failed:' + error);
							});
						});
					});
					
				}
			}
			
		};

		// register compare operator 
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
			};
			let result = operators[operator](operand_1, operand_2);
			if (result) return options.fn(this);
			return options.inverse(this);
		});

		// register replace operator 
		// e. g. {{#replace <find> <replace>}}{{string}}{{/replace}}
		Handlebars.registerHelper('replace', function( find, replace, options) {
			let string = options.fn(this);
			return string.replaceAll( find, replace );
		});

		// register split operator 	
		// {{#split <find> <index>}}<string>{{/split}}
		// e. g. {{#split "/" -1}}https://test.com/target{{/split}} => target
		Handlebars.registerHelper('split', function( find, index, options) {
			let string = options.fn(this);
			let result = string.split( find );
          	if (index < 0) return result[result.length + index];
            else return result[index];
		});

		// register split interator
		// {{#each_split <string> <find>}}...{{/each_split}}
		// e. g. {{#each_split "https://test.com/target" "/"}}{{.}},{{/each_split}} => https:,,test.com,target, 
		Handlebars.registerHelper('each_split', function( string, find, options) {
          	let data = string.split(find);
          	let result = '';
          data.forEach((item) => {
              result += options.fn(item);
          });
          return result;
		});

		// register substring operator
		// {{#substring start end}}<string>{{/substring}}
		// e. g. {{#substring 0 4}}My-test-string{{/substring}} => My-t
		// e. g. {{#substring -2 ""}}My-test-string{{/substring}} => ng
		// e. g. {{#substring 0 -2}}My-test-string{{/substring}} => My-test-stri
		Handlebars.registerHelper('substring', function( start, end, options) {
			let string = options.fn(this);
			let result = "";
          	if (end === "") result = string.slice( start);
          	else result = string.slice( start, end );
			return result;
		});

		console.log("Callbacks set");
	};
}
