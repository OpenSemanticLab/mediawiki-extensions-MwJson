/*@nomin*/

mwjson.editor = class {
	constructor(container, config, schema) {
		this.container = container;
		this.config = config;
		this.schema = schema;
		this.createEditor();
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

	createEditor() {
		//return function(err, config) {

		console.log(this);

		//create editor
		this.jsoneditor = new JSONEditor(this.container, {
			schema: this.schema,
			theme: 'bootstrap4',
			ajax: true,
			ajax_cache_responses: false,
			disable_collapse: false,
			disable_edit_json: true,
			disable_properties: true,
			use_default_values: true,
			required_by_default: false,
			//show_errors: 'always',
			disable_array_reorder: false,
			disable_array_delete_all_rows: false,
			disable_array_delete_last_row: false,
			keep_oneof_values: false,
			no_additional_properties: true,
			form_name_root: 'form_1'
		});
		console.log(this.config.data);
		this.jsoneditor.on('ready', () => {if (this.config.data) this.jsoneditor.setValue(this.config.data)});
		$(this.container).append($("<button type='Button' class='btn btn-primary btn-block' id='save-form'>Save</button>"));
		$("#save-form").click(() => {
			if (!this.config.target) this.config.target = "LabProcess:" + mwjson.util.OslId()
			console.log("Save form");
			var json = this.jsoneditor.getValue();
			var url = window.location.href.replace(/\?.*/, '') ;
			url += '?target=' + encodeURIComponent(this.config.target);
			url += '&data=' + encodeURIComponent(mwjson.util.objectToCompressedBase64(json));

			console.log(JSON.stringify(json));
			mwjson.api.getPage(this.config.target).then((page) => {
				page.content = mwjson.editor.data2template(json)
				page.content = "<noinclude>[" + url + " Edit]</noinclude>\n<br\>" + page.content;
				page.changed = true;
				console.log(page.content);
				mwjson.api.updatePage(page, "Edited with JsonEditor").then(() => window.location.href = "/wiki/" + page.title);
			});
			//mwjson.parser.parsePage(page)
			//console.log(page.dict);
			return;
			//console.log(this.targetPage.data);
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
			});
		});

		// listen for loaded
		this.jsoneditor.on('ready', () => {
			console.log("Editor loaded");
			//load data from page if exist
			//if (this.targetPage.content !== "") this.jsoneditor.setValue(this.targetPage.data);
			console.log("Queries:");
		});

		// listen for changes
		this.jsoneditor.on('change', () => {
			console.log("Editor changed");
			console.log(this.jsoneditor.schema);
			console.log(this.jsoneditor.getValue());
		});
		//};
	};

	static init() {
		const deferred = $.Deferred();
		if (!('ready' in mwjson.editor) || !mwjson.editor.ready) {
			mw.loader.load('https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css', 'text/css');
			mwjson.parser.init();
			$.when(
				//nothing to do
				$.getScript("https://unpkg.com/imask"),
				$.Deferred(function (deferred) {
					$(deferred.resolve);
				})
			).done(function () {
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
				if (result.printouts['HasDisplayName'][0]) return result.printouts['HasDisplayName'][0].toLowerCase().startsWith(input.toLowerCase());
				else return result.fulltext.split(":")[result.fulltext.split(":").length - 1].toLowerCase().startsWith(input.toLowerCase());
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
}
