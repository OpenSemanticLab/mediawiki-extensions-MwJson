/*@nomin*/

//hotfix: manual load css
mw.loader.load( 'https://cdn.jsdelivr.net/npm/@tarekraafat/autocomplete.js@10.2.7/dist/css/autoComplete.min.css', 'text/css' );

mwjson.editor = class {
	constructor() {
	}

	static createAutocompleteInput(config)
	{
		//console.log("create autocomplete for div " + div_id);

		const config_defaults = {
			query: input => `[[Display_title_of::like:*${input}*]][[!~*QUERY*]]|?Display_title_of=HasDisplayName|?HasDescription`,
			minInputLen : 0,
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
			onSubmit: result => {}
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
							$("#" + props.id).append( $( data.parse.text['*']) );
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
