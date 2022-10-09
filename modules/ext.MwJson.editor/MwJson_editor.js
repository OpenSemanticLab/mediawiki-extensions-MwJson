/*@nomin*/

mwjson.editor = class {
	constructor(container, config, schema) {
		this.container = container;
		this.config = config;
		this.schema = schema;
		this.createEditor();
	}

	createEditor() {
		//return function(err, config) {

		console.log(this);

		//create editor
		this.jsoneditor = new JSONEditor(this.container, {
			schema: this.schema,
			theme: 'bootstrap4',
			disable_collapse: true,
			disable_edit_json: true,
			disable_properties: true,
			use_default_values: false,
			required_by_default: true,
			show_errors: 'always',
			disable_array_reorder: true,
			disable_array_delete_all_rows: true,
			disable_array_delete_last_row: true,
			keep_oneof_values: false,
			no_additional_properties: true,
			form_name_root: 'form_1'
		});
		$(this.container).append($("<button class='btn btn-primary btn-block' id='save-form'>Save</button>"));
		$("#save-form").click(() => {
			console.log("Save form");
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
				$.Deferred(function (deferred) {
					$(deferred.resolve);
				})
			).done(function () {
				mwjson.editor.setCallbacks();
				console.log("JsonEditor initialized");
				deferred.resolve();
			});
		}
		else deferred.resolve(); //resolve immediately
		return deferred.promise();
	}

	static setCallbacks() {
		window.JSONEditor.defaults.callbacks = {
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
								var resultList = Object.values(data.query.results);
								//filter list
								resultList = resultList.filter(fulltext => {
									return fulltext.fulltext.toLowerCase().startsWith(input.toLowerCase());
								});

								resolve(resultList);
							});
					});
				},
				renderResult_smw: (jseditor_editor, result, props) => {
					var displayTitle = result.fulltext;
					var renderUrl = '/w/api.php?action=parse&format=json&text=';
					//if (jseditor_editor.schema.displayProperty) displayTitle = result.printouts[jseditor_editor.schema.displayProperty];
					//if (result.printouts['HasImage'][0]) renderUrl += `[[${result.printouts['HasImage'][0]['fulltext']}|right|x66px]]`;
					//renderUrl += encodeURIComponent(`</br>This is a building: [[${result.fulltext}]]. Levels: {{#ask: [[IsLocatedIn::${result.fulltext}]]|format=list}}`);
					jseditor_editor.schema.previewWikiTextTemplate = jseditor_editor.schema.previewWikiTextTemplate.replaceAll("\\{", "&#123;"); //escape curly-brackets with html entities. ToDo: Do this once for the whole schema
					jseditor_editor.schema.previewWikiTextTemplate = jseditor_editor.schema.previewWikiTextTemplate.replaceAll("\\}", "&#125;");
					var template = Handlebars.compile(jseditor_editor.schema.previewWikiTextTemplate);
					//var template = Handlebars.compile("{{result.fulltext}}");
					var templateText = template({result: result});
					templateText = templateText.replaceAll("&#123;", "{");
					templateText = templateText.replaceAll("&#125;", "}");
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
					if (jseditor_editor.schema.labelTemplate) {
						label = Handlebars.compile(jseditor_editor.schema.labelTemplate)({result: result});
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
