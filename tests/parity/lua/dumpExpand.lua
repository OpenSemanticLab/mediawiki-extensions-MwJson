--[[
Differential-test generator for Module:MwJson's p.expandEmbeddedTemplates().

Runs the real Lua against a fixture schema and data set, with the parser frame
stubbed so that every crossing of the wikitext boundary is visible in the
output: frame:preprocess becomes PRE[...], frame:newChild{args=...}:preprocess
becomes CHILD[text|args] and frame:expandTemplate becomes TPL[title|args]. The
PHP side installs a stub producing identical markers, so the fixture pins not
only the expanded values but exactly when and with what the parser is called.

Output is committed as tests/phpunit/Unit/fixtures/lua-expand.json and replayed
by LuaExpandFixtureTest.

    docker exec <container> lua \
        /var/www/html/w/extensions/MwJson/tests/parity/lua/dumpExpand.lua \
        > tests/phpunit/Unit/fixtures/lua-expand.json
--]]

local dir = ( arg and arg[0] and arg[0]:match( '(.*)/' ) ) or '.'
local support = dofile( dir .. '/support.lua' )

support.installStubs( nil, dir .. '/../../../docs/legacy-lua' )

--- Deterministic rendering of a frame argument table, so the marker strings are
--- reproducible; Lua's pairs() order is not.
local function showArgs( args )
	local keys = {}
	for k in pairs( args or {} ) do keys[#keys + 1] = tostring( k ) end
	table.sort( keys )
	local parts = {}
	for _, k in ipairs( keys ) do
		local v = args[k]
		if v == nil then v = args[tonumber( k )] end
		parts[#parts + 1] = k .. '=' .. tostring( v )
	end
	return table.concat( parts, ',' )
end

local frame = {}
frame.preprocess = function( self, text ) return 'PRE[' .. tostring( text ) .. ']' end
frame.newChild = function( self, opts )
	local args = opts.args
	return {
		preprocess = function( _, text )
			return 'CHILD[' .. tostring( text ) .. '|' .. showArgs( args ) .. ']'
		end,
	}
end
frame.expandTemplate = function( self, opts )
	return 'TPL[' .. tostring( opts.title ) .. '|' .. showArgs( opts.args ) .. ']'
end
mw.getCurrentFrame = function() return frame end

local p = support.loadMwJson( dir )
local rec = support.newRecorder( 'tests/parity/lua/dumpExpand.lua' )

--- @param schema table
--- @param data table
--- @param mode string|nil
--- @param stringify boolean|nil
local function run( name, schema, data, mode, stringify )
	rec.record( 'expandEmbeddedTemplates', name, {
		support.encode( schema ),
		support.encode( data ),
		support.encode( mode ),
		support.encode( stringify or false ),
	}, p.expandEmbeddedTemplates( {
		frame = frame,
		jsonschema = p.copy( schema ),
		jsondata = p.copy( data ),
		mode = mode,
		stringify_arrays = stringify or false,
	} ).res )
end

local mustache = function( value, extra )
	local t = { type = 'mustache', value = value }
	for k, v in pairs( extra or {} ) do t[k] = v end
	return t
end

-- A scalar property rendered by its own template ---------------------------
run( 'scalar property',
	{ properties = { name = { eval_template = mustache( '<b>{{name}}</b>' ) } } },
	{ name = 'Widget' } )

-- The whole value reaches the template, so a section can iterate an array ---
run( 'array property rendered as a whole',
	{ properties = { type = { eval_template = mustache( '{{#type}}[[{{.}}]] {{/type}}' ) } } },
	{ type = { 'Category:A', 'Category:B' } } )

run( 'root_key false passes the value directly',
	{ properties = { label = { eval_template = mustache( '{{#.}}{{text}} {{/.}}', { root_key = false } ) } } },
	{ label = { { text = 'one' }, { text = 'two' } } } )

-- Escaping, which is where Lustache and PHP engines disagree ---------------
run( 'escaped output',
	{ properties = { unit = { eval_template = mustache( '{{unit}}' ) } } },
	{ unit = "1 Gy/s & 'x' <b>" } )

run( 'unescaped output',
	{ properties = { unit = { eval_template = mustache( '{{{unit}}}' ) } } },
	{ unit = "1 Gy/s & 'x' <b>" } )

-- mustache-wikitext crosses the parser boundary ----------------------------
run( 'mustache-wikitext is preprocessed',
	{ properties = { name = { eval_template = { type = 'mustache-wikitext', value = '{{Link|{{name}}}}' } } } },
	{ name = 'Widget' } )

-- Mode selection -----------------------------------------------------------
local twoModes = { properties = { name = { eval_template = {
	{ type = 'mustache', value = 'STORE:{{name}}', mode = 'store' },
	{ type = 'mustache', value = 'RENDER:{{name}}', mode = 'render' },
} } } }
run( 'mode store', twoModes, { name = 'Widget' }, 'store' )
run( 'mode render', twoModes, { name = 'Widget' }, 'render' )
run( 'mode with no match falls through to none', twoModes, { name = 'Widget' }, 'other' )

run( 'a mode-agnostic entry listed last overrides a matching one',
	{ properties = { name = { eval_template = {
		{ type = 'mustache', value = 'RENDER:{{name}}', mode = 'render' },
		{ type = 'mustache', value = 'DEFAULT:{{name}}' },
	} } } },
	{ name = 'Widget' }, 'render' )

run( 'a mode-agnostic entry listed first is overridden',
	{ properties = { name = { eval_template = {
		{ type = 'mustache', value = 'DEFAULT:{{name}}' },
		{ type = 'mustache', value = 'RENDER:{{name}}', mode = 'render' },
	} } } },
	{ name = 'Widget' }, 'render' )

-- Structure ----------------------------------------------------------------
run( 'nested object property',
	{ properties = { quantity = { properties = {
		unit = { eval_template = mustache( '[[{{unit}}]]' ) },
	} } } },
	{ quantity = { value = 5, unit = 'Item:Metre' } } )

run( 'list of scalars with an item template',
	{ properties = { keywords = { items = { eval_template = mustache( '[[{{.}}]]' ) } } } },
	{ keywords = { 'Term:A', 'Term:B' } } )

run( 'list of objects',
	{ properties = { statements = { items = { properties = {
		object = { eval_template = mustache( '[[{{object}}]]' ) },
	} } } } },
	{ statements = { { object = 'Item:A' }, { object = 'Item:B' } } } )

run( 'stringify arrays',
	{ properties = { keywords = { items = { eval_template = mustache( '[[{{.}}]]' ) } } } },
	{ keywords = { 'Term:A', 'Term:B' } }, nil, true )

run( 'stringify arrays without an item template',
	{ properties = { keywords = {} } },
	{ keywords = { 'Term:A', 'Term:B' } }, nil, true )

-- Wikitext templates on a nested object ------------------------------------
run( 'wikitext template with an inline value',
	{ properties = { quantity = { eval_template = { type = 'wikitext', value = '{{{value}}} {{{unit}}}' } } } },
	{ quantity = { value = '5', unit = 'm' } } )

run( 'wikitext template naming a page',
	{ properties = { quantity = { eval_template = { type = 'wikitext', page = 'Quantity' } } } },
	{ quantity = { value = '5', unit = 'm' } } )

run( 'wikitext template is skipped when the node still holds structure',
	{ properties = { quantity = { eval_template = { type = 'wikitext', value = '{{{value}}}' } } } },
	{ quantity = { value = '5', nested = { a = 1 } } } )

-- Passthrough --------------------------------------------------------------
run( 'no templates at all',
	{ properties = { name = { type = 'string' } } },
	{ name = 'Widget', other = 'kept', list = { 1, 2 } } )

run( 'empty data', { properties = {} }, {} )

run( 'property absent from the schema is untouched',
	{ properties = {} },
	{ surprise = { nested = 'value' } } )

rec.write()
