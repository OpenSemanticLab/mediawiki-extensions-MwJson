/*@nomin*/

mwjson.editor = class {
	constructor(config) {
		var defaultConfig = {
			target_slot: null, // handled by caller
			target_namespace: 'Item',
			target_exists: false,
			mode: "default", // options: default, query
			copy: false, // editor is used to create a copy of an exiting entry => copy_ignore schema option is applied
			submit_enabled: true, //if true, add save button
			allow_submit_with_errors: undefined, //allow submitting forms even if schema validation fails (see option wgMwJsonAllowSubmitInvalide)
			lang: mw.config.get('wgUserLanguage'),
			format: {}, // e.g. datetime format
			user_id: mw.config.get('wgUserName'),
			id: 'json-editor-' + mwjson.util.getShortUid(),
			onsubmit: (json) => this.onsubmit(json),
			onchange: (json) => {},
			onEditInline: null, //callback to edit a connected entity directly from the current entity edit form
			onCreateInline: null, //callback to create a new connected entity directly from the current entity edit form
			getSubjectId: (params) => { //callback to determine the currently edited subjects @id
				//params.jsondata : Current json content of the editor
				//params.editor : The mwjson editor instance
				return params.editor.config.target_namespace + ":" + mwjson.util.OswId(params.jsondata.uuid);
			}
		};
		// https://json-schema.org/understanding-json-schema/reference/string#dates-and-times
		// https://flatpickr.js.org/formatting/
		// https://www.mediawiki.org/wiki/Manual:$wgDefaultUserOptions
		let langDatetimeFormats = {
			"en": {"date": "F d, Y", "time": "G:i K", "datetime-local": "F d, Y G:i K"},
			"de": {"date": "d.m.Y", "time": "H:i", "datetime-local": "d.m.Y H:i"},
		}
		let datetimeFormats = {
			"default": langDatetimeFormats[config.lang ? config.lang : defaultConfig.lang],//No preference
			"mdy": {"date": "F d, Y", "time": "G:i K", "datetime-local": "F d, Y G:i K"}, //16:12, January 15, 2011
			"dmy": {"date": "d.m.Y", "time": "H:i", "datetime-local": "d.m.Y H:i"}, //16:12, 15 January 2011
			"ymd": {"date": "Y/m/d", "time": "H:i", "datetime-local": "Y/m/d H:i"}, //16:12, 2011 January 15
			"ISO 8601": {"date": "Y-m-d", "time": "H:i", "datetime-local": "Z"}, //2011-01-15T16:12:34
		}
		defaultConfig.format = datetimeFormats[mw.user.options.get("date")];
		this.config = mwjson.util.mergeDeep(defaultConfig, config);
		this.flags = {
			'initial-data-load': false, // true while initial applying config.data => Used for copy-feature
			'change-after-load': false, // true after editor (and data) loaded until first on-change handler has run => Unused
		};
		this.addCss();
		if (this.config.container) {
			this.container = this.config.container;
			this.config.popup = false;
		}
		else {
			this.createPopupDialog(this.config.popupConfig);
			this.container = document.getElementById(this.config.id);
			this.config.popup = true;
		}

		this.jsonschema = new mwjson.schema({jsonschema: this.config.schema, config: {mode: this.config.mode, lang: this.config.lang, format: this.config.format, target: this.config.target}, debug: true});
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
		// set allow_submit_with_errors if still undefined
		if (this.config.allow_submit_with_errors !== true && this.config.allow_submit_with_errors != false) {
			if (mw.config.get('wgMwJsonAllowSubmitInvalide') === "always") this.config.allow_submit_with_errors = true;
			if (mw.config.get('wgMwJsonAllowSubmitInvalide') === "option") this.config.allow_submit_with_errors = this.schema?.options?.allow_submit_with_errors || false;
			if (mw.config.get('wgMwJsonAllowSubmitInvalide') === "never") this.config.allow_submit_with_errors = false;
		}

		//JSONEditor.defaults.language = "de";
		this.config.JSONEditorConfig = this.config.JSONEditorConfig || {};
		
		// object_background: "bg-dark",
		var defaultJSONEditorConfig = {
			theme: 'bootstrap5',
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
			case_sensitive_property_search: false,
			form_name_root: this.jsonschema.getSchema().id,
			//custom settings
			user_language: this.config.lang,
		}
		this.config.JSONEditorConfig = mwjson.util.mergeDeep(defaultJSONEditorConfig, this.config.JSONEditorConfig);
		this.config.JSONEditorConfig.schema = this.jsonschema.getSchema(),
		console.log(this.config.JSONEditorConfig);

		//create editor
		this.jsoneditor = new JSONEditor(this.container, this.config.JSONEditorConfig);
		this.jsoneditor.mwjson_editor = this; //store back ref
		console.log(this.config.data);

		// listen for loaded
		this.jsoneditor.on('ready', () => {
			console.log("Editor loaded");
			this.flags["change-after-load"] = true;
			console.log(this.jsoneditor);
			if (this.config.data) {
				// inject reverse properties
				for (const [key, value] of Object.entries(this.jsonschema.required_reverse_property_values ? this.jsonschema.required_reverse_property_values : {})) 
					this.config.data[key] = value;
				for (const [key, value] of Object.entries(this.jsonschema.default_reverse_property_values ? this.jsonschema.default_reverse_property_values : {})) 
					this.config.data[key] = value;
				this.flags["initial-data-load"] = true;
				this.jsoneditor.setValue(this.config.data);
				if (this.config.copy) {
					this.applyCopyIgnoreOption(this.jsoneditor.root);
					this.config.data = this.jsoneditor.getValue();
				}
				this.flags["initial-data-load"] = false;
			}
			if (this.config.target && this.config.target_slot) mwjson.api.getPage(this.config.target).then((page) => {
				console.log("MwJson_editor.js load page with target slot", this.config.target_slot, " and content models ", page.content_model);
				//return;
				if (page.content_model[this.config.target_slot] === 'wikitext') {
					mwjson.parser.parsePage(page);
					this.targetPage = page;
					//load data from page if exist
					if (this.targetPage.content !== "") {
						console.log("Load data:", this.targetPage.dict);
						var schemaJson = mwjson.parser.wikiJson2SchemaJson(this.targetPage.dict);
						console.log(schemaJson);
						this.jsoneditor.setValue(schemaJson);
					}
				}
				if (page.content_model[this.config.target_slot] === 'json') {
					console.log(page.slots[this.config.target_slot]);
					let data = page.slots[this.config.target_slot] ? page.slots[this.config.target_slot] : {};
					// inject reverse properties
					for (const [key, value] of Object.entries(this.jsonschema.required_reverse_property_values ? this.jsonschema.required_reverse_property_values : {})) 
						this.config.data[key] = value;
					for (const [key, value] of Object.entries(this.jsonschema.default_reverse_property_values ? this.jsonschema.default_reverse_property_values : {})) 
						this.config.data[key] = value;
					this.jsoneditor.setValue(data);
				}
			})
			this.updateSubjectId();
		});

		// listen for changes
		this.jsoneditor.on('change', () => {
			console.log("Editor changed");
			console.log(this.jsoneditor.schema);
			//console.log(this.jsoneditor.getValue());
			//console.log(this.jsoneditor.editors);

			this.updateSubjectId();

			var labeled_inputs = [];
			var label_requests = [];

			var all_editors = [];
			for (var subeditor_path of Object.keys(this.jsoneditor.editors)) {
				var e = this.jsoneditor.editors[subeditor_path]
				if (e) {
					all_editors.push(e)
					if (e.editors) all_editors = all_editors.concat(e.editors); // actual multiple editors due to oneOf schema
				}
			}

			for (var subeditor of all_editors) {

				var input = subeditor.input
				var $input = $(input);

				if (subeditor.schema?.dynamic_template) {
					var jseditor_editor = subeditor;
					var watched_values = subeditor.watched_values;
					this.formatDynamicTemplate(jseditor_editor, watched_values);
				}
				// add globals (does not work here since watched_values is evaluated before)
				/*if (subeditor.watched_values) {
					subeditor.watched_values["_current_subject_"] = this.config.target;
				}*/

				//collect autocomplete field values to fetch labels
				if (subeditor.format === 'autocomplete') {// && this.flags["change-after-load"]) {
					//console.log("Autocomplete Editor:", subeditor);
					//console.log("Unhandled: ", subeditor.unhandled_input, input.value, input.value_id, input.value_label, subeditor.value);
					if (!subeditor.fbind) {
						// override getter and setter to handle label different from value
						subeditor.getValue = (function() {
								//console.log("Editor-Get ", this.key, ": ", this.input.value_id ? this.input.value_id : this.value )
								return this.input.value_id ? this.input.value_id : this.value 
							}
						).bind(subeditor);
						subeditor.setValue = (function(value, initial, fromTemplate, label) {
								//console.log("Editor-Set ", this.key, ": ", value )
								this.value = value;
								this.input.value = label;
								this.input.value_id = value;
								this.input.value_label = label;
								this.onChange(true);
							}
						).bind(subeditor);
						subeditor.fbind = true;
					}

					if (subeditor.unhandled_input && input.value && input.value !== "") {
						//field was not filled yet.
						//user has entered a value in the field but did not select a result from the suggestion list
						//reset the state of the input to empty
						subeditor.unhandled_input = false;
						mwjson.util.setJsonEditorAutocompleteField(subeditor, null, null); // clear the field
						//mwjson.util.setJsonEditorAutocompleteField(subeditor, input.value_id ? input.value_id : null, input.value_label ? input.value_label : null); // restore previous value
					}
					else if (subeditor.unhandled_input && input.value === "") {
						//field was already filled yet.
						//user has removed the value from field so it's now empty
						//reset the state of the input to empty
						subeditor.unhandled_input = false;
						mwjson.util.setJsonEditorAutocompleteField(subeditor, null, null);
					}

					if (subeditor.getValue() && subeditor.getValue() !== "" && !input.value_label){
						labeled_inputs.push({editor: subeditor, input: input, value_id: input.value_id ? input.value_id : subeditor.value});
						label_requests.push(input.value_id ? input.value_id : subeditor.value);
					}

					var categories = subeditor.schema?.range;
					if (!categories) categories = subeditor.schema?.options?.autocomplete?.category; //legacy
					var super_categories = subeditor.schema?.subclassof_range; //indicates to create a new category of type range (MetaCategory) as subcategory of subclassof_range

					// create button to create an instance of the target category inline of not explicite disabled
					if (!(subeditor.schema?.options?.autocomplete?.create_inline === false) && (categories || super_categories) && !subeditor.inline_create_build && this.config.onCreateInline && this.config.onEditInline){
						subeditor.inline_create_build = true;

						// in order to add a button beside the autocomplete input field we have to rearrange the elements
						var $autocomplete_div = $input.parent();
						var $form_group = $input.parent().parent();
						var $form_group_label = $input.parent().parent().find("label");
						var $container = $(`<div style="display: flex;"></div>`)
						var $create_inline_button = $(`<div class="col-md-4">
							<button type="button" class="inline-clear-btn btn btn-secondary"></button>
							<button type="button" class="inline-edit-btn btn btn-primary"></button>
							<button type="button" class="inline-clone-btn btn btn-primary"></button>
						</div>`);
						if ($form_group_label.length) {
							$container.insertAfter($form_group_label); // normal layout
							$autocomplete_div.addClass("col-md-8");
						}
						else $form_group.append($container); // table layout
						$container.append($autocomplete_div.detach());
						$container.append($create_inline_button);

						$create_inline_button.find(".inline-clear-btn").on("click", (function (subeditor, e) { 
							mwjson.util.setJsonEditorAutocompleteField(subeditor, null, null); 
						}).bind(this, subeditor));
						$create_inline_button.find(".inline-edit-btn").on("click", (function (subeditor, e) {
							//console.log("Click ", subeditor);
							subeditor.unhandled_input = false;
							var categories = subeditor.schema?.range ? subeditor.schema?.range : subeditor.schema?.options?.autocomplete?.category;
							if (categories && !Array.isArray(categories)) categories = [categories];
							var super_categories = subeditor.schema?.subclassof_range;
							if (super_categories && !Array.isArray(super_categories)) super_categories = [super_categories];
							// note: unhandled_input === true indicates there is some user input in the field but no element from the suggestion list was picked
							// so subeditor.value would be the search string and no valid page name
							if (subeditor.input.value_id && !subeditor.unhandled_input) {
								this.config.onEditInline({page_title: subeditor.input.value_id}).then((page) => {
									mwjson.util.setJsonEditorAutocompleteField(subeditor, page.title, null);
								});
							}
							else {
								this.config.onCreateInline({categories: categories, super_categories: super_categories}).then((page) => {
									mwjson.util.setJsonEditorAutocompleteField(subeditor, page.title, null);
								});
							}
						}).bind(this, subeditor));
						$create_inline_button.find(".inline-clone-btn").on("click", (function (subeditor, e) {
							subeditor.unhandled_input = false;
							if (subeditor.input.value_id && !subeditor.unhandled_input) {
								this.config.onEditInline({page_title: subeditor.input.value_id, mode: 'copy'}).then((page) => {
									mwjson.util.setJsonEditorAutocompleteField(subeditor, page.title, null);
								});
							}
						}).bind(this, subeditor));
					}
				}

				// create button to create an instance of a WikiFile inline of not explicite disabled
				if (subeditor.schema?.format === 'url' && subeditor.schema?.options?.upload) {
					if (!(subeditor.schema?.options?.upload?.create_inline === false) && !subeditor.inline_create_build && this.config.onCreateInline && this.config.onEditInline) {
						subeditor.inline_create_build = true;
						// in order to add a button beside the upload input field we have to rearrange the elements
						var $container = $input.parent().find(".input-group");
						$input.parent().find(".json-editor-btn-upload").removeClass('json-editor-btn-upload');

						var $create_inline_button = $(`<button type="button" class="inline-edit-btn btn btn-secondary"></button>`);
						$container.append($create_inline_button);
						$create_inline_button.on("click", (function (subeditor, e) {
							//console.log("Click ", subeditor);
							var categories = subeditor.schema?.range ? subeditor.schema?.range : "Category:OSW11a53cdfbdc24524bf8ac435cbf65d9d"; // WikiFile default
							if (!Array.isArray(categories)) categories = [categories];
							if (subeditor.getValue() && subeditor.getValue() !== "") {
								this.config.onEditInline({page_title: subeditor.getValue()}).then((page) => {
									subeditor.setValue(page.title);
								});
							}
							else {
								this.config.onCreateInline({categories: categories}).then((page) => {
									subeditor.setValue(page.title);
								});
							}
						}).bind(this, subeditor));
					}
					let input = subeditor.fileDisplay; //input element that displays the file name
					// (!input.value || input.value === "No file selected.") would be another option,
					// but 'No file selected.' currently hardcoded and may change in the future
					// see: https://github.com/json-editor/json-editor/blob/2c119b1422637af90f30fc51fb5c5e5496eedaac/src/editors/upload.js#L65
					if (subeditor.getValue() && subeditor.getValue() !== "" && !input.value_label){
						labeled_inputs.push({editor: subeditor, input: input, value_id: subeditor.getValue()});
						label_requests.push(subeditor.getValue());
					}
				}

				// change label of inline create btn depending on the fields state
				if (
					(subeditor.schema?.format === "autocomplete" && !(subeditor.schema?.options?.autocomplete?.create_inline === false) && (categories || super_categories) && this.config.onCreateInline && this.config.onEditInline)
					|| (!(subeditor.schema?.options?.upload?.create_inline === false) && subeditor.schema?.format === 'url' && subeditor.schema?.options?.upload && this.config.onCreateInline && this.config.onEditInline)
					){
					var label = mw.message("mwjson-editor-create-inline-label").text() + " " + `
						<span class="fa-stack fa-1x" style="font-size: 0.8em; width: 1.5em;">
						<i class="far fa-clone fa-stack-2x"></i>
						<i class="far fa-plus fa-stack-1x" style="left: 0.45rem; bottom: 0.29rem;"></i>
						</span>
					`;
					var tooltip = mw.message("mwjson-editor-create-inline-tooltip").text();
					if (subeditor.getValue() && !subeditor.unhandled_input) {
						label = mw.message("mwjson-editor-edit-inline-label").text() + " " + '<i class="icon icon-edit"></i>';
						tooltip = mw.message("mwjson-editor-edit-inline-tooltip").text();
						$input.parent().parent().find(".inline-clone-btn").show();
					}
					else {
						$input.parent().parent().find(".inline-clone-btn").hide();
					}
					$input.parent().parent().find(".inline-edit-btn").html(label);
					$input.parent().parent().find(".inline-edit-btn").attr('title', tooltip);

					var clear_label = mw.message("mwjson-editor-clear-inline-label").text() + " " + '<i class="icon icon-cross"></i>';
					var clear_tooltip = mw.message("mwjson-editor-clear-inline-tooltip").text();
					$input.parent().parent().find(".inline-clear-btn").html(clear_label);
					$input.parent().parent().find(".inline-clear-btn").attr('title', clear_tooltip);

					var clone_label = mw.message("mwjson-editor-clone-inline-label").text() + " " + '<i class="far fa-solid fa-clone"></i>';
					var clone_tooltip = mw.message("mwjson-editor-clone-inline-tooltip").text();
					$input.parent().parent().find(".inline-clone-btn").html(clone_label);
					$input.parent().parent().find(".inline-clone-btn").attr('title', clone_tooltip);
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
								this.setValue(jsonString);
								this.change();
							}).bind(subeditor) //arrow function binding to loop var subeditor does not work 
						}
						subeditor.jsoneditors = new JSONEditors(container, options);
						subeditor.jsoneditors.set(JSON.parse(subeditor.input.value));
					}
				}
			}

			//fetch labels
			if (label_requests.length) mwjson.api.getLabels(label_requests, this.jsoneditor.options.user_language).then((label_dict) => {
				for (const labeled_input of labeled_inputs) {
					if (label_dict[labeled_input.value_id] && label_dict[labeled_input.value_id] !== "") {
						// only set label if display title was found
						//console.log("Set label " + label_dict[labeled_input.value_id] + " for " + labeled_input.input.value);
						labeled_input.input.value_id = labeled_input.value_id;
						labeled_input.input.value_label = label_dict[labeled_input.value_id];
						labeled_input.input.value = labeled_input.input.value_label;
					}
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

			console.log(this.jsoneditor.getValue());
		});

		var resetAutocompleteEditors = () => {
			var all_editors = [];
			for (var subeditor_path of Object.keys(this.jsoneditor.editors)) {
				var e = this.jsoneditor.editors[subeditor_path]
				if (e) {
					all_editors.push(e)
					if (e.editors) all_editors = all_editors.concat(e.editors); // actual multiple editors due to oneOf schema
				}
			}

			for (var subeditor of all_editors) {
				if (subeditor.format === 'autocomplete') {
					//subeditor.input.value_label = null;
					//subeditor.input.value_id = null;
					//subeditor.change();
					mwjson.util.setJsonEditorAutocompleteField(subeditor, subeditor.getValue(), null);
				}
			}
		}

		// listen for array changes
		this.jsoneditor.on('moveRow', editor => {
			// since the input elements stay in place but the editors are rewired
			// we need to reset the input elements 
			resetAutocompleteEditors();
		});
		this.jsoneditor.on('deleteRow', value => {
			// since the input elements stay in place but the editors are rewired
			// we need to reset the input elements 
			resetAutocompleteEditors()
		});

		// problem: is called both when row is added or created
		// removing ignored properties conflicts with defaultProperties
		this.jsoneditor.on('addRow', editor => {
			//console.log('addRow', editor);
			if (!this.flags["initial-data-load"]) this.applyCopyIgnoreOption(editor);
		});

		this.jsoneditor.on('copyRow', value => {
			// not implemented (yet) by json-editor
			//console.log('copyRow', value);
		});
	}

	// remove properties named in options.copy_ignore but keep empty values for required and defaultProperties
	applyCopyIgnoreOption(editor) {
		let ignored_properties = [];
		if (editor.schema?.options?.copy_ignore) ignored_properties = ignored_properties.concat(editor.schema?.options?.copy_ignore);
		if (editor.parent?.schema?.options?.array_copy_ignore) ignored_properties = ignored_properties.concat(editor.parent?.schema?.options?.array_copy_ignore);
		let value = mwjson.util.deepCopy(editor.getValue());
		let changed = false;
		for (let p of ignored_properties) {
			let keep = (editor.schema?.required?.includes(p) || editor.schema?.defaultProperties?.includes(p))
			let default_value = null
			if (Object.hasOwn(value, p)) {
				if (value[p] && typeof value[p] === 'string') default_value = "";
				//if (value[p]) keep ? value[p] = default_value : delete value[p];
				if (value[p] && keep) { 
					//console.log("default", default_value); 
					value[p] = default_value; }
				if (value[p] && !keep) { 
					//console.log("delete"); 
					delete value[p]; }
				//console.log("Remove", p, keep, "=>", value);
				changed = true
			}
			//value[p] = default_value
		}
		//console.log(JSON.stringify(value));
		if (changed) editor.setValue(value);
	}

	updateSubjectId() {
		var jsondata = this.jsoneditor.getValue();
		var subject_id = this.config.getSubjectId({jsondata: jsondata, editor: this});
		if (subject_id != this.config.target) console.log("Set subject id to ", subject_id);
		this.config.target_namespace = subject_id.split(":")[0];
		this.config.target = subject_id;
	}

	// adds suppport for backend supplied variables like {{_global_index_}}
	async formatDynamicTemplate(jseditor_editor, watched_values) {
		if (!jseditor_editor.schema.dynamic_template) return;
		let fetch_user = false;
		if (jseditor_editor.schema.dynamic_template.includes("_current_user_")) fetch_user = true;
		if (jseditor_editor.schema?.options?.data_maps && JSON.stringify(jseditor_editor.schema?.options?.data_maps).includes("_current_user_")) fetch_user = true;
		if (fetch_user) {
			let user_page_or_item = jseditor_editor.jsoneditor.mwjson_editor.config.user_id;
			let query_url = mw.config.get("wgScriptPath") + `/api.php?action=ask&format=json&query=[[User:${user_page_or_item}]]`;
			let result = await (await fetch(query_url)).json();
			if (result?.query?.results) {
				// the result page title respects redirects,
				// e.g. Item:... is returned if User:... redirects to Item:...
				for (let page_title in result.query.results) user_page_or_item = page_title;
			}
			watched_values["_current_user_"] = user_page_or_item;
		}
		watched_values["_current_subject_"] = jseditor_editor.jsoneditor.mwjson_editor.config.target;
		var index = jseditor_editor.parent?.key;
		watched_values["i1"] = index ? index * 1 + 1 : 0;
		watched_values["_array_index_"] = index ? index * 1 + 1 : 0;
		watched_values["i01"] = index ? index * 1 + 1 : 0;

		//todo: use jseditor_editor.formname // root[<key>]
		let set_value = this.config.data;
		let set = true;
		if (this.config.data) {
			// set-state based on the loaded value of the editor
			let path = jseditor_editor.path.split('.'); // e.g. "root.samples.1.id"
			path.shift(); //remove first element ('root')
			for (let e of path) {
				//test for integer, see https://stackoverflow.com/questions/10834796/validate-that-a-string-is-a-positive-integer
				if (0 === e % (!isNaN(parseFloat(e)) && 0 < ~~e)) set_value = set_value[parseInt(e, 10)]; // array index
				else set_value = set_value[e]; // object key
				if (!set_value || set_value === "") {
					set = false;
					break; // path does not exist or is empty
				}
			}
		}
		else set = false;
		//console.log("Set ", jseditor_editor.key, " ", jseditor_editor.formname, " ", set);
		// dynamic_template.override config:
		// 'always': update the field on every change => default for hidden and readonly fields
		// 'empty': update the field only when unset or empty => default for user editable fields
		// 'unsafed': update until the value was stored in the backend => default for templates with _global_index_
		let override = jseditor_editor.schema?.options?.dynamic_template?.override;
		if (!override) {
			if (jseditor_editor.schema.dynamic_template.includes("{{_global_index_}}")) override = 'unsafed';
			else if (jseditor_editor.schema?.options?.hidden || jseditor_editor.schema?.readonly) override = 'always';
			else override = 'empty'; // set override_empty true if not hidden and not read-only
		}
		// set-state based on the current value of the editor
		if (override === 'empty') set = (jseditor_editor.getValue() && jseditor_editor.getValue() !== "")
		if (!set || override === 'always') {
			//retrieve the existing property value with the highest value for the unique number
			var context = {
				property: "HasId",
				number_pattern: "0000",
				increment: 1,
				debug: false,

			};
			context = mwjson.util.mergeDeep(context, jseditor_editor.schema?.options?.global_index);
			if (!jseditor_editor.schema?.dynamic_template) return;
			if (jseditor_editor.schema?.options?.data_maps) {
				for (const map of jseditor_editor.schema.options.data_maps) {
					let query_url = Handlebars.compile(map.query)(watched_values);
					query_url = mw.config.get("wgScriptPath") + `/api.php?action=ask&format=json&query=` + query_url;
					let result = await (await fetch(query_url)).json();

					var value = mwjson.extData.getValue(result, map.source_path, "jsonpath");
					if (map.template) value = Handlebars.compile(map.template)(value);
					if (map.storage_path) watched_values[map.storage_path] = value; //ToDo: support nested
					if (map.target_path) {
						var target_editor = Handlebars.compile(map.target_path)(watched_values);
						//for (const key in jseditor_editor.watched_values) target_editor = target_editor.replace('$(' + key + ')', jseditor_editor.watched[key]);
						if (jseditor_editor.jsoneditor.editors[target_editor]) {
							jseditor_editor.jsoneditor.editors[target_editor].setValue(value);
						}
					}
				}
			}
			let fetch_global_index = false;
			if (jseditor_editor.schema.dynamic_template.includes("{{{_global_index_}}}")) {
				fetch_global_index = true;
				context.value = Handlebars.compile(jseditor_editor.schema.dynamic_template.replace("{{{_global_index_}}}", "%_global_index_%"))(watched_values);
			}
			else if (jseditor_editor.schema.dynamic_template.includes("{{_global_index_}}")) {
				fetch_global_index = true;
				context.value = Handlebars.compile(jseditor_editor.schema.dynamic_template.replace("{{_global_index_}}", "%_global_index_%"))(watched_values);
			}
			if (fetch_global_index) {
				var query = mw.config.get("wgScriptPath") + `/api.php?action=ask&query=[[${context.property}::~${context.value.replace("%_global_index_%", "*")}]]|?${context.property}|sort=${context.property}|order=desc|limit=1&format=json`;
				let data = await (await fetch(query)).json();
				var number_start = context.increment;
				context.unique_number_string = "" + number_start;
				for (var key in data.query.results) {

					if (data.query.results[key].printouts[context.property][0] !== undefined) {
						context.highestExistingValue = data.query.results[key].printouts[context.property][0];
						if (context.debug) console.log("highestExistingValue:" + context.highestExistingValue);
						var regex = new RegExp(context.value.replace("%_global_index_%", "([0-9]*)"), "g");
						context.unique_number_string = regex.exec(context.highestExistingValue)[1];
						context.unique_number_string = "" + (parseInt(context.unique_number_string) + context.increment);
					}
				}
				if (context.unique_number_string === "NaN") context.unique_number_string = "";
				context.unique_number_string = (context.number_pattern + context.unique_number_string).substr(-context.number_pattern.length);
				watched_values["_global_index_"] = context.unique_number_string
			}
			context.value = Handlebars.compile(jseditor_editor.schema.dynamic_template)(watched_values);
			//console.log("Set value", context)
			set_value = context.value;
			jseditor_editor.setValue(set_value)
		}
		else {
			//do not re-set the previous value here to enable user changes
			//if (set_value && set_value !== "") jseditor_editor.setValue(set_value);
		}
		return set_value; // return the value for template: dynamic_template
	}

	createUI() {
		if (this.config.submit_enabled && (!this.config.popup || this.config.mode === 'query')) {
			var btn_label = mw.message("mwjson-editor-submit-save").text();
			if (this.config.mode === 'query') btn_label = mw.message("mwjson-editor-submit-query").text();
			const btn_id = this.config.id + "_save-form";
			$(this.container).append($("<button type='Button' class='btn btn-primary btn-block' id='" + btn_id + "'>" + btn_label + "</button>"));
			$("#" + btn_id).click(() => {
				console.log("Query");
				this._onsubmit();
			});
		}

		if (this.jsonschema.data_source_maps.length && this.config.mode === 'default') {
			//console.log(this.jsonschema.data_source_maps);
			for (const [index, data_source_map] of this.jsonschema.data_source_maps.entries()) {
				if (!data_source_map.label) data_source_map.label = data_source_map.source.substring(0, 20) + "...";
				var btn_label = mw.message("mwjson-editor-fetch-external-data", data_source_map.label).text();
				if (data_source_map.required) {
					var required_prop_names = "";
					for (const required_prop of data_source_map.required)
						required_prop_names += (this.jsonschema.getPropertyDefinition(required_prop).title ? this.jsonschema.getPropertyDefinition(required_prop).title : required_prop) +  ", ";
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

		var all_editors = [];
		for (var subeditor_path of Object.keys(this.jsoneditor.editors)) {
			var e = this.jsoneditor.editors[subeditor_path]
			if (e) {
				all_editors.push(e)
				if (e.editors) all_editors = all_editors.concat(e.editors); // actual multiple editors due to oneOf schema
			}
		}

		for (var subeditor of all_editors) {
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

	_onsubmit(params = {}) {
		let meta = params.meta;
		let json = params.json || this.jsoneditor.getValue()
		document.activeElement.blur(); //ensure input is defocused to update final jsondata
		const promise = new Promise((resolve, reject) => {
			this.getSyntaxErrors().then((errors) => {
				if (!json) json = this.jsoneditor.getValue();
				const validation_errors = this.jsoneditor.validate();
				if (errors.length || validation_errors.length) {
					let msg = mw.message("mwjson-editor-fields-contain-error").text() + ":<br><ul>";
					for (const err of validation_errors) {
						var error_path = err.path;
						try {
							const keys = err.path.split('.'); // root
							var path = keys.shift();
							var labelPath = "";
							for (const key of keys) {
								path += "." + key;
								if (labelPath !== "") labelPath += " > ";
								var pathElement = key;
								const e = this.jsoneditor.editors[path];
								const i = Number.parseInt(key)
								if (!Number.isNaN(i)) pathElement = "Element " + (i+1).toString();
								else if (e && e.schema && e.schema.title) {
									pathElement = e.schema.title
								}
								labelPath += pathElement;
							}
							error_path = labelPath;
						} catch (error) {
							console.error("Error while generating label path: ", error);
						}
						msg += "<li>" + error_path + ": " + err.message + "</li>";
					}
					msg += "</ul>";
					if (this.config.allow_submit_with_errors) {
						msg += "<br>" + mw.message("mwjson-editor-save-anyway").text();
						mwjson.editor.prototype.confirm(msg).then((confirmed) => {
							if (confirmed) {
								if (this.config.mode !== 'query') mw.notify(mw.message("mwjson-editor-do-not-close-window").text(), { title: mw.message("mwjson-editor-saving").text() + "...", type: 'warn' });
								// strip reverse properties here
								this.jsonschema.storeAndRemoveReverse(json).then((json) => {
									const submit_promise = this.config.onsubmit(json, meta);
									if (submit_promise) submit_promise.then(() => {
										resolve();
										if (this.config.mode !== 'query') mw.notify(mw.message("mwjson-editor-saved").text(), { type: 'success' });
									}).catch();
									else {
										resolve();
										if (this.config.mode !== 'query') mw.notify(mw.message("mwjson-editor-saved").text(), { type: 'success' });
									}
								});
							} else {
								reject();
							}
						});
					}
					else {
						msg += "<br><br>" + mw.message("mwjson-editor-fix-all-errors").text();
						mwjson.editor.prototype.alert(msg).then(() => {
							reject();
						});
					}
				}
				else {
					if (this.config.mode !== 'query') mw.notify(mw.message("mwjson-editor-do-not-close-window").text(), { title: mw.message("mwjson-editor-saving").text() + "...", type: 'warn' });
					// ToDo: strip reverse properties here
					this.jsonschema.storeAndRemoveReverse(json).then((json) => {
						const submit_promise = this.config.onsubmit(json, meta);
						console.log(submit_promise);
						if (submit_promise) submit_promise.then(() => {
							resolve();
							if (this.config.mode !== 'query') mw.notify(mw.message("mwjson-editor-saved").text(), { type: 'success' });
						}).catch();
						else {
							resolve();
							if (this.config.mode !== 'query') mw.notify(mw.message("mwjson-editor-saved").text(), { type: 'success' });
						}
					});
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
					window.location.href = mw.util.getUrl(page.title);
				});
			}).catch();
		});
		return promise;
	}

	onsubmitQuery(json, meta) {
		const $result_container = $('#' + this.config.result_container_id);
		$result_container.html("");
		var wikitext = this.jsonschema.getSemanticQuery({jsondata: json}).wikitext;
		console.log("wikitext", wikitext);
		//var renderUrl = mw.config.get("wgScriptPath") + '/api.php?action=parse&format=json&text=';
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
			'ext.mwjson.editor.ace',
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
			//mw.loader.load('https://cdn.jsdelivr.net/npm/select2@4.0.6-rc.1/dist/css/select2.min.css', 'text/css');
			//mw.loader.load('https://cdn.jsdelivr.net/npm/choices.js@latest/public/assets/styles/choices.min.css', 'text/css');
			//mw.loader.load('https://cdn.jsdelivr.net/npm/selectize@latest/dist/css/selectize.min.css', 'text/css'); //needed?
			//mw.loader.load('https://cdn.jsdelivr.net/npm/selectize@latest/dist/css/selectize.default.min.css', 'text/css'); 
			mw.loader.load(mw.config.get("wgScriptPath") + "/extensions/MwJson/modules/ext.MwJson.editor/selectize.default.min.css", 'text/css'); 
			mwjson.parser.init();
			$.when(
				//$.getScript("https://cdn.jsdelivr.net/npm/@json-editor/json-editor@latest/dist/jsoneditor.js"),
				//$.getScript("https://unpkg.com/imask"),
				//$.getScript("https://cdn.jsdelivr.net/npm/ace-builds@latest/src-noconflict/ace.min.js"),
				//$.getScript("https://cdn.jsdelivr.net/npm/select2@4.0.6-rc.1/dist/js/select2.min.js"), //styling issues
				//$.getScript("https://cdn.jsdelivr.net/npm/choices.js@latest/public/assets/scripts/choices.min.js"), //styling issues
				//$.getScript("https://cdn.jsdelivr.net/npm/selectize@latest/dist/js/standalone/selectize.min.js"),
				// loading via resource loader throws error: "$.fn is undefined"
				$.getScript(mw.config.get("wgScriptPath") + "/extensions/MwJson/modules/ext.MwJson.editor/selectize.min.js"),
				mw.loader.using(mw_modules), 
				//mw.loader.using('ext.wikiEditor'),
				//$.getScript(mw.config.get("wgScriptPath") + "/extensions/MwJson/modules/ext.MwJson.editor/json-schema-ref-parser.js"),
				$.Deferred(function (deferred) {
					$(deferred.resolve);
				})
			).done(function () {

				for (var key of Object.keys(JSONEditor.defaults.languages.en)) {
					//replace with mediawiki i18n
					var msg = mw.message("json-editor-" + key);
					if (msg.exists())
						JSONEditor.defaults.languages.en[key] = msg.text().replaceAll('((', '{{').replaceAll('))', '}}');
					else console.warn("i18n message not defined: " + "'json-editor-" + key + "'");
				}
				mwjson.editor.setCallbacks();
				mwjson.editor.setDefaultOptions();
				//console.log("JsonEditor initialized");
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
		ace.config.set("basePath", mw.config.get("wgScriptPath") + "/extensions/MwJson/modules/ext.MwJson.editor.ace");
		ace.config.set("workerPath", mw.config.get("wgScriptPath") + "/extensions/MwJson/modules/ext.MwJson.editor.ace");
		ace.config.setModuleUrl('ace/mode/json_worker', mw.config.get("wgScriptPath") + "/extensions/MwJson/modules/ext.MwJson.editor.ace/worker-json.js");
		// see https://github.com/json-editor/json-editor/blob/master/README_ADDON.md#upload
		// ToDo: add translations
		window.JSONEditor.defaults.options.upload = {
			title: 	"Browse", // string, Title of the Browse button, default: "Browse"
			auto_upload: true, // boolean, Trigger file upload button automatically, default: false
			allow_reupload: true, // boolean, Allow reupload of file (overrides the readonly state), default: false
			hide_input: false, // boolean, Hide the Browse button and name display (Only works if 'enable_drag_drop' is true), default: false
			enable_drag_drop: true, // boolean, Enable Drag&Drop uploading., default: false
			drop_zone_top: false, // boolean, Position of dropzone. true=before button input, false=after button input, default: false
			drop_zone_text: "Drag & Drop", // string, Text displayed in dropzone box, default: "Drag & Drop file here"
			//alt_drop_zone: "", // string, Alternate DropZone DOM Selector (Can be created inside another property) 	
			//mime_type: false, // string/array, If set, restrict upload to mime type(s) 	
			max_upload_size: 0, // integer, Maximum file size allowed. 0 = no limit, default: 0
			upload_handler: "fileUpload", // function, Callback function for handling uploads to server 	
			icon: "upload", // undocumented, but missing if not set
		};
	}

	static setCallbacks() {
		window.JSONEditor.defaults.callbacks = {
			'now': (jseditor_editor, e) => {
				var t = new Date()
				t.setDate(t.getDate())
				return t.toISOString().split('T')[0] + 'T00:00'
			},
			"template": {
				"dynamic_template": (jseditor_editor, watched_values) => {
					return jseditor_editor.jsoneditor.mwjson_editor.formatDynamicTemplate(jseditor_editor, watched_values);
				},
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
					jseditor_editor.unhandled_input = true; // mark started user input
					if (jseditor_editor.watched_values) console.log("Watched: " + jseditor_editor.watched_values);
					var query = mwjson.schema.getAutocompleteQuery(jseditor_editor.schema, input);
					
					for (const key in jseditor_editor.watched_values) {
						if (jseditor_editor.watched[key]) {
							query = query.replaceAll('{{$(' + key + ')}}', '{{' + jseditor_editor.watched[key].replace("root.","") + '}}');
						}
						if (jseditor_editor.watched_values[key] === undefined) query = query.replace('$(' + key + ')', encodeURIComponent('+'));
						query = query.replaceAll('$(' + key + ')', jseditor_editor.watched_values[key]);
					}

					//create a copy here since we add addition properties
					var jsondata = mwjson.util.deepCopy(jseditor_editor.jsoneditor.getValue());
					jsondata['_user_input'] = input; 
					jsondata['_user_input_lowercase'] = input.toLowerCase(); 
					jsondata['_user_input_normalized'] = mwjson.util.normalizeString(input); 
					jsondata['_user_input_normalized_tokenized'] = mwjson.util.normalizeAndTokenizeString(input); 
					jsondata['_user_lang'] = jseditor_editor.jsoneditor.options.user_language; 
					var template = Handlebars.compile(query);
					query = template(jsondata);

					// detect direct inserted UUID patterns
					const uuid_regex = /([a-f0-9]{8})(_|-| |){1}([a-f0-9]{4})(_|-| |){1}([a-f0-9]{4})(_|-| |){1}([a-f0-9]{4})(_|-| |){1}([a-f0-9]{12})/gm;
					const matches = input.match(uuid_regex);
					if (matches && matches.length) {
						let uuidQuery = ""
						for (const match of matches) uuidQuery += "[[HasUuid::" + match.replace(uuid_regex, `$1-$3-$5-$7-$9`) + "]]OR";
						uuidQuery = uuidQuery.replace(/OR+$/, ''); // trim last 'OR'
						query = query.replace(query.split('|')[0], uuidQuery); // replace filter ([[...]]) before print statements (|?...)
					}

					var result_property = mwjson.schema.getAutocompleteResultProperty(jseditor_editor.schema);
					//console.log("Search with schema: " + query);
					var url = mw.config.get("wgScriptPath") + `/api.php?action=ask&query=${query}`;
					if (!url.includes("|limit=")) url += "|limit=100";
					url += "&format=json";

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
								var resultList = []
								if (data.error) {
									jseditor_editor.unhandled_input = false;
									console.warn("Error while fetching autocomplete data: ", data.error)
								}
								else if (jseditor_editor.unhandled_input === false) {
									//aborted in the meantime
									//console.log("Autocomplete request aborted in the meantime")
								}
								else {
									resultList = Object.values(data.query.results); //use subjects as results
									if (result_property) { //use objects as results
										resultList = [];
										Object.values(data.query.results).forEach(result => {
											resultList = resultList.concat(result.printouts[result_property])
										});
										resultList = [...new Set(resultList)]; //remove duplicates
									}
									//filter list
									/*resultList = resultList.filter(result => {
										return mwjson.util.normalizeString(JSON.stringify(result)).includes(mwjson.util.normalizeString(input)); //slow but generic
									});*/
									//sort list
									resultList.sort((a, b) => input.length/b.displaytitle.length - input.length/a.displaytitle.length)
								}
								resolve(resultList);
							});
					});
				},
				renderResult_smw: (jseditor_editor, result, props) => {
					if (!result.printouts) return "";
					// normalize multilanguage printouts (e. g. description)
					result = mwjson.util.normalizeSmwMultilangResult(result, jseditor_editor.jsoneditor.options.user_language);

					var previewTemplate = mwjson.util.deepCopy(mwjson.schema.getAutocompletePreviewTemplate(jseditor_editor.schema)); //use custom value
					if (previewTemplate.type.shift() === 'handlebars') {
						if (previewTemplate.type[0] === 'wikitext') previewTemplate.value = previewTemplate.value.replaceAll("\\{", "&#123;").replaceAll("\\}", "&#125;"); //escape curly-brackets with html entities. ToDo: Do this once for the whole schema
						var template = Handlebars.compile(previewTemplate.value);
						previewTemplate.value = template({ result: result });
						if (previewTemplate.type[0] === 'wikitext') previewTemplate.value = previewTemplate.value.replaceAll("&#123;", "{").replaceAll("&#125;", "}");
					}

					if (previewTemplate.type.shift() === 'wikitext') {
					var renderUrl = mw.config.get("wgScriptPath") + '/api.php?action=parse&format=json&text=';
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
					//jseditor_editor.value = result_value;
					/*jseditor_editor.setValue(result_value);
					jseditor_editor.input.value_id = result_value;
					jseditor_editor.onChange(true);*/
					jseditor_editor.unhandled_input = false; // mark finalized user input
					mwjson.util.setJsonEditorAutocompleteField(jseditor_editor, result_value, result.printouts.label[0]);
					//jseditor_editor.input.value_label = result.printouts.label[0];
					
					if (jseditor_editor.schema?.options?.autocomplete?.field_maps) {
						for (const map of jseditor_editor.schema.options.autocomplete.field_maps) {
							var value = mwjson.extData.getValue({result: result}, map.source_path, "jsonpath");
							if (map.template) value = Handlebars.compile(map.template)(value);
							var target_editor = map.target_path;
							for (const key in jseditor_editor.watched_values) target_editor = target_editor.replace('$(' + key + ')', jseditor_editor.watched[key]);
							if (jseditor_editor.jsoneditor.editors[target_editor]) {
								let editor_type = jseditor_editor.jsoneditor.editors[target_editor].schema?.type;
								if (editor_type === "array" || editor_type === "object") value = JSON.parse(value.replaceAll(/\n/g,'\\n'));
								jseditor_editor.jsoneditor.editors[target_editor].setValue(value);
							}
						}
					}
				},
			},
			upload: {
				fileUpload: (jseditor, type, file, cbs) => {
					var mwjson_editor = jseditor.jsoneditor.mwjson_editor; //get the owning mwjson editor class instance
					const label = file.name;
					const upload_file_extension = file.name.split('.').pop().toLowerCase();					
					// Check if file type is allowed
					const allowedMimeTypes = jseditor.schema?.options?.upload?.mime_type;
					if (allowedMimeTypes) {
						const fileType = file.type;
						const allowedTypes = Array.isArray(allowedMimeTypes) ? allowedMimeTypes : [allowedMimeTypes];
						if (!allowedTypes.includes(fileType)) {
							const error = `Invalid file type: ${fileType}. Allowed types: ${allowedTypes.join(', ')}`;
							mw.notify(error, {
								title: 'Upload Error',
								type: 'error'
							});
							cbs.failure(error);
							return;
						}
					}
					// Check file size if max_upload_size is set
					const max_upload_size = jseditor.schema?.options?.upload?.max_upload_size;
					if (max_upload_size && file.size > max_upload_size) {
						const error = `File size (${file.size} bytes) exceeds maximum allowed size (${max_upload_size} bytes)`;
						mw.notify(error, {
							title: 'Upload Error',
							type: 'error'
						});
						cbs.failure(error);
						return;
					}
					
					var target = mwjson.util.OswId() + "." + upload_file_extension; //use the final file extension, e.g. 'png' in 'my.something.png'
					if (jseditor.value && jseditor.value !== "") target = jseditor.value.replace("File:", ""); // reupload
					if (jseditor.key === "file" && mwjson_editor.jsonschema.subschemas_uuids.includes("11a53cdf-bdc2-4524-bf8a-c435cbf65d9d")) { //uuid of Category:WikiFile
						mwjson_editor.config.target_namespace = "File";
						if (mwjson_editor.config.target && mwjson_editor.config.target !== "") {
							let file_extension = mwjson_editor.config.target.includes('.') ? mwjson_editor.config.target.split('.').pop().toLowerCase() : "";
							if (file_extension == "") {
								// target was already set by getSubjectId(), but file extension is missing
								file_extension = upload_file_extension;
								mwjson_editor.config.target = mwjson_editor.config.target + "." + file_extension;
							}
							else {
								//the file page already exists
								if (file_extension !== upload_file_extension) {
									let error = "File extension of uploaded file '" + upload_file_extension + "' does not match existing '" + file_extension + "'";
									cbs.failure('Upload failed:' + error);
									return;
								}
							}
							target = mwjson_editor.config.target.replace(mwjson_editor.config.target_namespace + ":", "");
							//console.log("set target to config.target: ", target);
						}
						else {
							// this file page is not yet created => set the page name
							mwjson_editor.config.target = mwjson_editor.config.target_namespace + ":" + target;
							//console.log("set config.target to target: ", mwjson_editor.config.target);
						}
						// set label from file label if not set yet
						if (jseditor.jsoneditor.editors["root.label.0.text"]) {
							if (!jseditor.jsoneditor.editors["root.label.0.text"].value || jseditor.jsoneditor.editors["root.label.0.text"].value === "") {
								jseditor.jsoneditor.editors["root.label.0.text"].setValue(label);
								jseditor.jsoneditor.editors["root.label.0.text"].change();
							}
						}
					}

					Object.defineProperty(file, 'name', {writable: true, value: target}); //name is readonly, so file.name = target does not work
					mwjson.api.getFilePage(target).done((page) => {
						//console.log("File does exists");
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
						//console.log("File does not exists");
						mwjson.api.getPage("File:" + target).done((page) => {
							page.file = file;
							page.file.contentBlob = file;
							page.file.changed = true;
							mwjson.api.updatePage(page).done((page) => {
								cbs.success('File:' + target);
								mw.hook( 'jsoneditor.file.uploaded' ).fire({exists: false, name: target, label: file.name});
							}).fail(function (error) {
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

		// register pattern formator
		// {{#patternformat pattern}}<string>{{/substring}}
		// e. g. {{#patternformat '00.00'}}{{test}}{{/patternformat}}
		// e. g. {{#patternformat '00'}}2{{/patternformat}} => 02
		// or {{patternformat pattern value}}
		// e. g. {{patternformat '0.0' test}}
		// e. g. {{patternformat '0.0000' 1.129141 }} => 1.1291
		// e. g. {{patternformat '00.0000' '1.1' }} => 01.1000
		// e. g. {{patternformat '_____' 'abc' }} => __abc
		Handlebars.registerHelper('patternformat', function (pattern, value_or_options, options) {
			let value = "";
			if (!options && !value_or_options) return value; // no pattern given
			if (!options) { // helper used as block
				options = value_or_options
				value = options.fn(this);
			}
			else value = value_or_options; // helper used as function
			if (typeof (value) == 'number') value = value.toString();

			let pre_pattern = pattern.split('.')[0] //format for int
			let post_pattern = ""
			if (pattern.includes('.')) post_pattern = pattern.split('.')[1]
			if (post_pattern !== "") {
				//format floats with rounding
				value = "" + parseFloat(value).toFixed(post_pattern.length);
				if (pre_pattern !== "") value = (pre_pattern + value.split('.')[0]).substr(-pre_pattern.length) + '.' + value.split('.')[1];
			}
			else {
				//format integers or strings with leading chars
				value = (pre_pattern + value).substr(-pre_pattern.length);
			}
			return value
		})

		// register current datetime
		// {{now}}
		// e. g. {{now}} => 2024-02-04T04:31:08.050Z 
		// consider: https://github.com/userfrosting/UserFrosting/issues/756
		Handlebars.registerHelper('_now_', function (options) {
			return new Date(Date.now()).toISOString();
		})
		// register alias
		//Handlebars.registerHelper('now', function (options) {
		//	return Handlebars.helpers.__now__.apply(options);
		//})


		// register current datetime
		// {{__uuid__}}
		// e. g. {{__uuid__}} => ad56b31f-9fe5-466a-8be7-89bce58045f1
		Handlebars.registerHelper('_uuid_', function (options) {
			//return mwjson.util.uuidv4();
			return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
				(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
			);
			//return crypto.randomUUID().toString(); //only works in safe env: localhost or https
		})

		// register date formater
		// {{__format_datetime__ <format> <date>}}
		// e. g. {{__format_datetime__ 'Y' (__now__)}} => 2024
		// consider: https://support.helpdocs.io/article/kvaf7f4kf9-handlebars-helpers-for-custom-templates
		Handlebars.registerHelper('dateformat', function (format, date, options) {
			if (!options) {
				options = format;
				format = "YYYY-MM-DD HH:MM"
			}
			//return new Date(Date.parse(date)).toISOString()
			date = new Date(Date.parse(date));
			let result = flatpickr.formatDate(date, format);
			return result;
		})

		// register math callback
		// {{calc <operand1> <operator> <operand2>}}
		// {{#calc <operand1> <operator>}}<operand2>{{/calc}}
		// e.g. {{calc (calc 1 '+' 1) '*' 10}} => 20
		// {{#calc 3 '*'}}2{{/calc}} => 6
		Handlebars.registerHelper("calc", function (lvalue, operator, rvalue, options) {
			if (!options) {
				options = rvalue;
				//rvalue = operator;
				//operator = lvalue;
				//lvalue = options.fn(this);
				rvalue = options.fn(this);
			}
			lvalue = parseFloat(lvalue);
			rvalue = parseFloat(rvalue);

			return {
				"+": lvalue + rvalue,
				"-": lvalue - rvalue,
				"*": lvalue * rvalue,
				"/": lvalue / rvalue,
				"%": lvalue % rvalue
			}[operator];
		});

		// register join function
		// remove all empty interation results and delimits them with the given separator (default: ", ")
		// {{#join literal_array }}{{.}}{{/join}}
		// {{#join object_array ", " "[" "]"}}{{#if print}}{{value}}{{/if}}{{/join}}
		Handlebars.registerHelper("join", function (context, separator, intro, outro, options) {
			if (!options) {
				options = outro; // shift arguments
				outro = "";
			}
			if (!options) {
				options = intro; // shift arguments
				intro = "";
			}
			if (!options) {
				options = separator; // shift arguments
				separator = ", "
			}
			if (!context) context = [];
			let items = [];
			for (var i = 0, j = context.length; i < j; i++) {
				items.push(options.fn(context[i]));
			}
			items = items.filter(item => item.trim() !== '') // Remove empty or whitespace-only elements
			if (!items.length) intro = outro = "";

			return intro + items.join(separator) + outro; // Join with separator, wrap with intro + outro
		});
	};
}
