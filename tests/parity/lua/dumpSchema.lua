--[[
Differential-test generator for Module:MwJson's schema-resolution functions:
p.expandJsonRef, p.getCategories and p.walkJsonSchema.

Runs the real Lua source against an in-memory set of fixture pages, with
p.loadJson stubbed to read from that set instead of the wiki, and prints the
results as JSON on stdout.

The output is committed as tests/phpunit/Unit/fixtures/lua-schema.json and
replayed against the PHP port by LuaSchemaFixtureTest. The same fixture pages
are declared on the PHP side, so both implementations see identical input.

Regenerate with:

    docker exec <mediawiki-container> lua \
        /var/www/html/w/extensions/MwJson/tests/parity/lua/dumpSchema.lua \
        > tests/phpunit/Unit/fixtures/lua-schema.json
--]]

local dir = ( arg and arg[0] and arg[0]:match( '(.*)/' ) ) or '.'
local support = dofile( dir .. '/support.lua' )

-- ---------------------------------------------------------------------------
-- Fixture wiki. Keep in step with LuaSchemaFixtureTest::PAGES.
--
-- Shaped after the real OSL core schemas: a JsonSchema: page held in the main
-- slot, Category: pages holding theirs in the jsonschema slot and chaining via
-- allOf raw-action refs, plus header_template slots as plain wikitext.
-- ---------------------------------------------------------------------------
local pages = {
	-- p.loadJson defaults its title to "JsonSchema:Entity" when called without
	-- one (marked "--for testing" in the source), and expandJsonRef reaches
	-- that path for any $ref whose path has no "wiki/" segment. Present here so
	-- the fixture records that quirk instead of hiding it behind a missing page.
	['JsonSchema:Entity'] = {
		main = { title = 'FALLBACK Entity schema', type = 'object' },
	},
	['JsonSchema:Label'] = {
		main = {
			title = 'Label',
			type = 'object',
			properties = {
				text = { type = 'string', propertyOrder = 10 },
				lang = { type = 'string', propertyOrder = 20 },
			},
		},
	},
	['Category:Entity'] = {
		jsonschema = {
			title = 'Entity',
			['@context'] = { label = 'Property:HasLabel' },
			properties = {
				uuid = { type = 'string', propertyOrder = 10 },
				label = { type = 'array', propertyOrder = 20 },
				comment = { type = 'string', propertyOrder = 2000 },
				internal = { type = 'string' },
			},
			required = { 'uuid' },
		},
		header_template = '<div>Entity {{{label|}}}</div>',
	},
	['Category:Item'] = {
		jsonschema = {
			title = 'Item',
			allOf = { { ['$ref'] = '/wiki/Category:Entity?action=raw&slot=jsonschema' } },
			properties = {
				name = { type = 'string', propertyOrder = 5 },
				-- Redeclares an inherited property with no order of its own,
				-- which must keep the ancestor's ranked position.
				label = { type = 'array', title = 'Label override' },
			},
			required = { 'name' },
		},
		header_template = '<div>Item</div>',
	},
	['Category:Tool'] = {
		jsonschema = {
			title = 'Tool',
			allOf = { { ['$ref'] = '/wiki/Category:Item?action=raw&slot=jsonschema' } },
			properties = {
				serial = { type = 'string', propertyOrder = 0 },
				retired = { type = 'string', propertyOrder = -5 },
			},
		},
		-- No header_template slot, so the walker must record nil for it.
	},
	['Category:Diamond'] = {
		jsonschema = {
			title = 'Diamond',
			allOf = {
				{ ['$ref'] = '/wiki/Category:Item?action=raw&slot=jsonschema' },
				{ ['$ref'] = '/wiki/Category:Tool?action=raw&slot=jsonschema' },
			},
		},
	},
	['Category:Conflict'] = {
		jsonschema = {
			title = 'Conflict',
			allOf = {
				{ ['$ref'] = '/wiki/JsonSchema:Label?action=raw', title = 'sibling wins' },
			},
		},
	},
}

support.installStubs( pages )
local p = support.loadMwJson( dir )

-- Stub p.loadJson over the fixture wiki. Same return shape and the same
-- argument defaulting as the original, so the JsonSchema:Entity fallback above
-- is exercised rather than bypassed.
p.loadJson = function( args )
	local title = args.title or 'JsonSchema:Entity'
	local slot = args.slot or 'main'
	local page = pages[title]
	if page == nil then return { json = {}, debug_msg = '' } end
	local content = page[slot]
	if type( content ) ~= 'table' then return { json = {}, debug_msg = '' } end
	return { json = p.copy( content ), debug_msg = '' }
end

local rec = support.newRecorder( 'tests/parity/lua/dumpSchema.lua' )

-- p.expandJsonRef ----------------------------------------------------------
local refCases = {
	{ 'main-slot ref', { ['$ref'] = '/wiki/JsonSchema:Label?action=raw' } },
	{ 'slot-qualified ref', { ['$ref'] = '/wiki/Category:Entity?action=raw&slot=jsonschema' } },
	{ 'ref with siblings wins', { ['$ref'] = '/wiki/JsonSchema:Label?action=raw', title = 'mine' } },
	{ 'fragment ref is skipped', { ['$ref'] = '#/$defs/generated', title = 'mine' } },
	{ 'unresolvable ref', { ['$ref'] = 'not-a-wiki-url', title = 'mine' } },
	{ 'nested ref inside properties', {
		type = 'object',
		properties = { label = { items = { ['$ref'] = '/wiki/JsonSchema:Label?action=raw' } } },
	} },
	{ 'allOf flattened, earlier member wins', {
		allOf = {
			{ title = 'first', type = 'object', properties = { a = { type = 'string' } } },
			{ title = 'second', properties = { b = { type = 'string' } } },
		},
	} },
	{ 'allOf as a bare object', { allOf = { title = 'bare', type = 'object' } } },
	{ 'allOf with refs', {
		allOf = { { ['$ref'] = '/wiki/JsonSchema:Label?action=raw' } },
		title = 'own',
	} },
	{ 'empty document', {} },
	{ 'no refs at all', { type = 'object', properties = { a = { type = 'string' } } } },
}
for _, case in ipairs( refCases ) do
	local name, json = case[1], case[2]
	local args = { support.encode( json ) }
	rec.record( 'expandJsonRef', name, args, p.expandJsonRef( { json = json } ).json )
end

-- p.getCategories ----------------------------------------------------------
local categoryCases = {
	{ 'list of refs, bare', {
		allOf = {
			{ ['$ref'] = '/wiki/Category:Entity?action=raw&slot=jsonschema' },
			{ ['$ref'] = '/wiki/Category:Item?action=raw&slot=jsonschema' },
		},
	}, false, false },
	{ 'list of refs, namespaced', {
		allOf = { { ['$ref'] = '/wiki/Category:Entity?action=raw&slot=jsonschema' } },
	}, true, false },
	{ 'schemas excluded by default', {
		allOf = { { ['$ref'] = '/wiki/JsonSchema:Label?action=raw' } },
	}, true, false },
	{ 'schemas included', {
		allOf = { { ['$ref'] = '/wiki/JsonSchema:Label?action=raw' } },
	}, true, true },
	{ 'mixed', {
		allOf = {
			{ ['$ref'] = '/wiki/Category:Entity?action=raw&slot=jsonschema' },
			{ ['$ref'] = '/wiki/JsonSchema:Label?action=raw' },
		},
	}, true, true },
	{ 'ref without a query string', {
		allOf = { { ['$ref'] = '/wiki/Category:Entity' } },
	}, true, false },
	{ 'no allOf', { type = 'object' }, true, false },
	{ 'allOf member without a ref', { allOf = { { title = 'x' } } }, true, false },
}
for _, case in ipairs( categoryCases ) do
	local name, schema, ns, schemas = case[1], case[2], case[3], case[4]
	rec.record( 'getCategories', name,
		{ support.encode( schema ), support.encode( ns ), support.encode( schemas ) },
		p.getCategories( { jsonschema = schema, includeNamespace = ns, includeSchemas = schemas } ).categories )
end

-- p.walkJsonSchema ---------------------------------------------------------
-- Returns four of the five result fields; wikitext is debug-only and empty here.
local function walk( schema, categories, mode, recursive, template )
	local res = p.walkJsonSchema( {
		jsonschema = p.copy( schema ),
		categories = categories,
		mode = mode,
		recursive = recursive,
		template = template,
	} )
	return {
		schema = res.jsonschema,
		schemas = res.jsonschemas,
		templates = res.templates,
		visited = res.visited,
	}
end

local walkCases = {
	{ 'single ancestor',
		{ allOf = { { ['$ref'] = '/wiki/Category:Entity?action=raw&slot=jsonschema' } },
		  properties = { own = { type = 'string', propertyOrder = 1 } } },
		nil, 'header', true, nil },
	{ 'three-level chain',
		{ allOf = { { ['$ref'] = '/wiki/Category:Tool?action=raw&slot=jsonschema' } } },
		nil, 'header', true, nil },
	{ 'diamond visits each ancestor once',
		{ allOf = { { ['$ref'] = '/wiki/Category:Diamond?action=raw&slot=jsonschema' } } },
		nil, 'header', true, nil },
	{ 'non-recursive stops at the first level',
		{ allOf = { { ['$ref'] = '/wiki/Category:Tool?action=raw&slot=jsonschema' } } },
		nil, 'header', false, nil },
	{ 'footer mode collects footer templates',
		{ allOf = { { ['$ref'] = '/wiki/Category:Entity?action=raw&slot=jsonschema' } } },
		nil, 'footer', true, nil },
	{ 'explicit categories override allOf',
		{ properties = { own = { type = 'string' } } },
		{ 'Category:Category' }, 'header', true, nil },
	{ 'explicit categories, existing page',
		{ properties = { own = { type = 'string' } } },
		{ 'Category:Entity' }, 'header', true, nil },
	{ 'own template is recorded',
		{ properties = { own = { type = 'string' } } },
		{ 'Category:Entity' }, 'header', true, '<div>own</div>' },
	{ 'empty own schema is not appended',
		{}, { 'Category:Entity' }, 'header', true, nil },
	{ 'no categories at all',
		{ properties = { own = { type = 'string', propertyOrder = 3 } } },
		nil, 'header', true, nil },
	-- The subject's own schema is folded in twice, once as the starting value
	-- of the merge and again as "_" at the end of the chain. Under the legacy
	-- merge that duplicates scalar list members (required becomes
	-- ["own","own"]) while lists of objects merge by position and do not
	-- duplicate. Pinned because it is surprising and easy to "fix" by accident.
	{ 'own scalar lists are duplicated by the double merge',
		{ allOf = { { ['$ref'] = '/wiki/Category:Entity?action=raw&slot=jsonschema' } },
		  required = { 'own' },
		  enum = { 'a', 'b' } },
		nil, 'header', true, nil },
	{ 'json schema ancestor uses the main slot',
		{ allOf = { { ['$ref'] = '/wiki/JsonSchema:Label?action=raw' } } },
		nil, 'header', true, nil },
}
for _, case in ipairs( walkCases ) do
	local name, schema, categories, mode, recursive, template =
		case[1], case[2], case[3], case[4], case[5], case[6]
	rec.record( 'walkJsonSchema', name, {
		support.encode( schema ),
		support.encode( categories ),
		support.encode( mode ),
		support.encode( recursive ),
		support.encode( template ),
	}, walk( schema, categories, mode, recursive, template ) )
end

rec.write()
