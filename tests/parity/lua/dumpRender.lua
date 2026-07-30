--[[
Differential-test generator for Module:MwJson's renderers:
p.renderJson, p.renderLiteral, p.renderArrayItemSummary, p.renderInfoBox,
p.renderMultilangValue, p.getPropertyType, p.formatDate and p.wrapLinkIfNs.

Loads Scribunto's real mw.html so the infobox markup is produced by the same
builder the wiki uses, rather than by a stub that would just agree with
whatever the PHP happens to emit. The parser frame is stubbed with the same
markers as dumpExpand.lua.

Output is committed as tests/phpunit/Unit/fixtures/lua-render.json and replayed
by LuaRenderFixtureTest.

    docker exec <container> lua \
        /var/www/html/w/extensions/MwJson/tests/parity/lua/dumpRender.lua \
        > tests/phpunit/Unit/fixtures/lua-render.json
--]]

local dir = ( arg and arg[0] and arg[0]:match( '(.*)/' ) ) or '.'
local support = dofile( dir .. '/support.lua' )

support.installStubs( nil, dir .. '/../../../docs/legacy-lua' )

-- The reader's language, matching what the PHP side is constructed with.
local USER_LANG = 'de'

local frame = {}
frame.preprocess = function( self, text )
	-- getUserLang() resolves the language this way, so answer that one
	-- directly and mark anything else, which would be a call we did not expect.
	if text == '{{USERLANGUAGECODE}}' then return USER_LANG end
	return 'PRE[' .. tostring( text ) .. ']'
end
frame.expandTemplate = function( self, opts )
	local keys = {}
	for k in pairs( opts.args or {} ) do keys[#keys + 1] = tostring( k ) end
	table.sort( keys )
	local parts = {}
	for _, k in ipairs( keys ) do parts[#parts + 1] = k .. '=' .. tostring( opts.args[k] ) end
	return 'TPL[' .. tostring( opts.title ) .. '|' .. table.concat( parts, ',' ) .. ']'
end
mw.getCurrentFrame = function() return frame end

-- Scribunto's own HTML builder, so the infobox markup is the real thing.
local lualib = '/var/www/html/w/extensions/Scribunto/includes/Engines/LuaCommon/lualib'
package.path = lualib .. '/?.lua;' .. package.path
local HtmlBuilder = dofile( lualib .. '/mw.html.lua' )
HtmlBuilder.setupInterface( {
	uniqPrefix = '\127UNIQ',
	uniqSuffix = 'QINU\127',
} )
mw.html = HtmlBuilder

local p = support.loadMwJson( dir )
local rec = support.newRecorder( 'tests/parity/lua/dumpRender.lua' )

-- p.getPropertyType --------------------------------------------------------
local typeCases = {
	{ 'context wins', { part = { ['@type'] = '@id' } }, 'part', { type = 'string' } },
	{ 'schema date format', nil, nil, { type = 'string', format = 'date' } },
	{ 'schema date-time format', nil, nil, { type = 'string', format = 'date-time' } },
	{ 'array items carry the format', nil, nil,
		{ type = 'array', items = { type = 'string', format = 'date' } } },
	{ 'plain string', nil, nil, { type = 'string' } },
	{ 'no schema at all', nil, nil, nil },
	{ 'context miss falls through to schema', { other = { ['@type'] = '@id' } }, 'part',
		{ type = 'string', format = 'date' } },
}
for _, case in ipairs( typeCases ) do
	rec.record( 'getPropertyType', case[1], {
		support.encode( case[2] ), support.encode( case[3] ), support.encode( case[4] ),
	}, p.getPropertyType( { context = case[2], key = case[3], schema = case[4] } ) )
end

-- p.formatDate -------------------------------------------------------------
local dateCases = {
	{ 'date', '2024-01-15', 'xsd:date', nil },
	{ 'date-time with a property', '2024-01-15T10:30:00', 'xsd:dateTime', 'HasCreationDate' },
	{ 'date-time without a property', '2024-01-15T10:30:00', 'xsd:dateTime', nil },
	{ 'date-time with a space separator', '2024-01-15 10:30:00', 'xsd:dateTime', nil },
	{ 'date-time with no parsable time', '2024-01-15', 'xsd:dateTime', nil },
	{ 'not a date type', 'hello', '@value', nil },
}
for _, case in ipairs( dateCases ) do
	rec.record( 'formatDate', case[1], {
		support.encode( case[2] ), support.encode( case[3] ), support.encode( case[4] ),
	}, p.formatDate( case[2], case[3], case[4] ) )
end

-- p.wrapLinkIfNs -----------------------------------------------------------
local linkCases = {
	'Item:OSW123', 'Category:Entity', 'File:x.png', 'Property:HasName',
	'Term:NotLinked', 'no colon here', 'Already [[linked]]', 'Item:', '',
	'Grosse: 5', 'http://example.org/x',
}
for _, case in ipairs( linkCases ) do
	rec.record( 'wrapLinkIfNs', case, { support.encode( case ) }, p.wrapLinkIfNs( case ) )
end

-- p.renderMultilangValue ---------------------------------------------------
local multilangCases = {
	{ 'schema title only', { title = 'Label' }, {}, 'title', '' },
	{ 'language map hits the reader language',
		{ title = 'Label', ['title*'] = { en = 'Label', de = 'Etikett' } }, {}, 'title', '' },
	{ 'language map falls back to english',
		{ title = 'Label', ['title*'] = { en = 'Label', fr = 'Etiquette' } }, {}, 'title', '' },
	{ 'jsondata list hits the reader language', {},
		{ label = { { lang = 'en', text = 'Keyword' }, { lang = 'de', text = 'Schlagwort' } } },
		'label', '' },
	{ 'default when nothing matches', {}, {}, 'title', 'fallback' },
	{ 'description key', { description = 'Some text' }, {}, 'description', '' },
}
for _, case in ipairs( multilangCases ) do
	rec.record( 'renderMultilangValue', case[1], {
		support.encode( case[2] ), support.encode( case[3] ),
		support.encode( case[4] ), support.encode( case[5] ),
	}, p.renderMultilangValue( {
		jsonschema = case[2], jsondata = case[3], key = case[4], default = case[5],
	} ) )
end

-- p.renderArrayItemSummary -------------------------------------------------
local summaryCases = {
	{ 'label and type', { label = 'Bolt', type = 'Category:Part' } },
	{ 'characteristic beats type', { label = 'Bolt', characteristic = 'Item:Steel', type = 'Category:Part' } },
	{ 'name when there is no label', { name = 'bolt_1' } },
	{ 'label that is still a multilang list', { label = { { text = 'Bolt' } }, name = 'bolt_1' } },
	{ 'nothing usable', { uuid = '123' } },
}
for _, case in ipairs( summaryCases ) do
	rec.record( 'renderArrayItemSummary', case[1], { support.encode( case[2] ) },
		p.renderArrayItemSummary( { item = case[2], index = 1 } ) )
end

-- p.renderJson -------------------------------------------------------------
local treeSchema = {
	properties = {
		name = { type = 'string', title = 'Name', propertyOrder = 10 },
		created = { type = 'string', format = 'date', title = 'Created', propertyOrder = 20 },
		keywords = { type = 'array', items = { type = 'string' }, title = 'Keywords', propertyOrder = 30 },
		hidden_field = { type = 'string', options = { hidden = true }, propertyOrder = 40 },
		length = {
			type = 'object', title = 'Length',
			properties = { value = { type = 'number' }, unit = { type = 'string' } },
			propertyOrder = 50,
		},
		parts = {
			type = 'array', title = 'Parts', propertyOrder = 60,
			items = { type = 'object', properties = {
				label = { type = 'string', title = 'Label' },
				qty = { type = 'number', title = 'Quantity' },
			} },
		},
		nested = { type = 'object', title = 'Nested', propertyOrder = 70,
			properties = { inner = { type = 'string', title = 'Inner' } } },
	},
}
local treeDefinitions = {
	name = { property = 'HasName', defined_in = { 'Category:Entity' } },
	created = { property = 'HasCreationDate', defined_in = { 'Category:Entity', 'Category:Item' } },
}
local treeCases = {
	{ 'scalars and a date', treeSchema, { name = 'Widget', created = '2024-01-15' }, false },
	{ 'list of one', treeSchema, { keywords = { 'Term:A' } }, false },
	{ 'list of several', treeSchema, { keywords = { 'Term:A', 'Term:B' } }, false },
	{ 'hidden property is skipped', treeSchema, { hidden_field = 'secret', name = 'Widget' }, false },
	{ 'empty values are skipped', treeSchema, { name = '', keywords = {}, nested = {} }, false },
	{ 'empty values shown when asked', treeSchema, { name = '' }, true },
	{ 'quantity collapses to one line', treeSchema, { length = { value = 2.5, unit = 'Item:Metre' } }, false },
	{ 'quantity without a unit', treeSchema, { length = { value = 2.5 } }, false },
	{ 'list of objects', treeSchema,
		{ parts = { { label = 'One', qty = 1 }, { label = 'Two', qty = 2 } } }, false },
	{ 'nested object', treeSchema, { nested = { inner = 'value' } }, false },
	-- A nested property whose key matches a top-level one that has
	-- definitions recorded. p.renderJson drops property_definitions on the way
	-- down, so the nested tooltip must carry no "Definition:" line.
	{ 'nested key colliding with a defined top-level key', {
		properties = { nested = { type = 'object', title = 'Nested',
			properties = { name = { type = 'string', title = 'Inner name' } } } },
	}, { nested = { name = 'inner value' } }, false },
	{ 'list items colliding with a defined top-level key', {
		properties = { parts = { type = 'array', title = 'Parts',
			items = { type = 'object', properties = {
				name = { type = 'string', title = 'Inner name' } } } } },
	}, { parts = { { name = 'one' }, { name = 'two' } } }, false },
	{ 'semicolon separated titles', treeSchema, { name = 'Item:A;Item:B' }, false },
	{ 'semicolon in prose is not split', treeSchema, { name = 'one; two' }, false },
	{ 'booleans and numbers', treeSchema, { name = true, created = 42 }, false },
	{ 'small float formatting', treeSchema, { length = { value = 1e-06, unit = 'Item:Metre' } }, false },
	{ 'unordered keys sort by name', { properties = {} }, { zebra = 'z', apple = 'a', mango = 'm' }, false },
	{ 'key not in the schema', treeSchema, { surprise = 'value' }, false },
	{ 'empty data', treeSchema, {}, false },
}
for _, case in ipairs( treeCases ) do
	rec.record( 'renderJson', case[1], {
		support.encode( case[2] ), support.encode( case[3] ), support.encode( case[4] ),
	}, p.renderJson( {
		jsonschema = case[2],
		jsondata = p.copy( case[3] ),
		property_definitions = treeDefinitions,
		display_empty = case[4],
	} ) )
end

-- p.renderInfoBox ----------------------------------------------------------
local boxSchema = {
	title = 'Entity',
	properties = {
		name = { type = 'string', title = 'Name' },
		created = { type = 'string', format = 'date', title = 'Created' },
		types = { type = 'array', items = { type = 'string' }, title = 'Types' },
		flag = { type = 'boolean', title = 'Flag' },
		secret = { type = 'string', title = 'Secret', options = { hidden = true } },
		long = { type = 'string', title = 'Long' },
		templated = { type = 'string', title = 'Templated', eval_template = { type = 'mustache', value = 'x' } },
	},
}
local boxContext = { types = { ['@type'] = '@id' }, created = { ['@type'] = 'xsd:date' } }
local boxCases = {
	{ 'scalar row', boxSchema, boxContext, { name = 'Widget' }, {} },
	{ 'list row with links', boxSchema, boxContext, { types = { 'Category:A', 'File:b.png' } }, {} },
	{ 'date row', boxSchema, boxContext, { created = '2024-01-15' }, {} },
	{ 'boolean row', boxSchema, boxContext, { flag = true }, {} },
	{ 'hidden property is skipped', boxSchema, boxContext, { secret = 's', name = 'Widget' }, {} },
	{ 'ignored property is skipped', boxSchema, boxContext, { name = 'Widget' }, { name = true } },
	{ 'long text is truncated', boxSchema, boxContext, { long = string.rep( 'a', 150 ) }, {} },
	{ 'long text with markup is left alone', boxSchema, boxContext,
		{ long = string.rep( 'a', 150 ) .. '[[link]]' }, {} },
	{ 'templated property is not truncated', boxSchema, boxContext,
		{ templated = string.rep( 'b', 150 ) }, {} },
	{ 'nested object is skipped', boxSchema, boxContext, { name = { nested = 'x' } }, {} },
	{ 'key not in the schema is skipped', boxSchema, boxContext, { surprise = 'x' }, {} },
	{ 'no properties at all', boxSchema, boxContext, {}, {} },
}
for _, case in ipairs( boxCases ) do
	rec.record( 'renderInfoBox', case[1], {
		support.encode( case[2] ), support.encode( case[3] ),
		support.encode( case[4] ), support.encode( case[5] ),
	}, p.renderInfoBox( {
		jsonschema = case[2],
		schema_allOfMerged = case[2],
		context = case[3],
		jsondata = p.copy( case[4] ),
		property_definitions = treeDefinitions,
		ignore_properties = case[5],
	} ).wikitext )
end

rec.write()
