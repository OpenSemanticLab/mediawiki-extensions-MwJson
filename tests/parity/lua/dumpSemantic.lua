--[[
Differential-test generator for Module:MwJson's JSON-LD and SMW mapping:
p.buildContext, p.getSemanticProperties, p.getDisplayLabel,
p.setNormalizedLabel, p.processQuantityValue and p.processStatement.

mw.smw is stubbed to record calls instead of storing, and
mw.title.getCurrentTitle is pinned, so the whole thing runs outside MediaWiki
and the recorded subobject writes can be compared against the SemanticMapping
the PHP port returns.

Output is committed as tests/phpunit/Unit/fixtures/lua-semantic.json and
replayed by LuaSemanticFixtureTest.

    docker exec <container> lua \
        /var/www/html/w/extensions/MwJson/tests/parity/lua/dumpSemantic.lua \
        > tests/phpunit/Unit/fixtures/lua-semantic.json
--]]

local dir = ( arg and arg[0] and arg[0]:match( '(.*)/' ) ) or '.'
local support = dofile( dir .. '/support.lua' )

support.installStubs( nil )

local SUBJECT = 'Item:OSWtest'

mw.title.getCurrentTitle = function()
	return { fullText = SUBJECT, nsText = 'Item' }
end

--- Records subobject writes in traversal order rather than storing them, which
--- is exactly what SemanticMapping collects on the PHP side.
local storedSubobjects = {}
mw.smw = {
	set = function( properties ) return true end,
	subobject = function( properties, id )
		storedSubobjects[#storedSubobjects + 1] = { id = id, properties = properties }
		return true
	end,
}

local p = support.loadMwJson( dir )
local rec = support.newRecorder( 'tests/parity/lua/dumpSemantic.lua' )

-- p.buildContext -----------------------------------------------------------
local contextCases = {
	{ 'flat terms', { ['@context'] = { label = 'Property:HasLabel', name = 'Property:HasName' } } },
	{ 'expanded term', { ['@context'] = { part = { ['@id'] = 'Property:HasPart', ['@type'] = '@id' } } } },
	{ 'reverse term', { ['@context'] = { parent = { ['@reverse'] = 'Property:HasPart' } } } },
	{ 'multi mapping list', { ['@context'] = { ['type*'] = { 'Property:HasType', 'Property:IsA' } } } },
	{ 'remote import is dropped', { ['@context'] = { 'https://example.org/ctx', { a = 'Property:A' } } } },
	{ 'nested context is pulled up', {
		['@context'] = { sub = { inner = 'Property:Inner' }, top = 'Property:Top' } } },
	{ 'object property gets a scoped context', {
		['@context'] = { quantity = 'Property:HasQuantity' },
		properties = { quantity = { type = 'object', ['@context'] = { unit = 'Property:HasUnit' } } },
	} },
	{ 'array of objects gets a scoped context', {
		properties = { parts = { items = { type = 'object', ['@context'] = { id = 'Property:HasId' } } } },
	} },
	{ 'scoped context on a string term is expanded', {
		['@context'] = { quantity = 'Property:HasQuantity' },
		properties = { quantity = { type = 'object', ['@context'] = { unit = 'Property:HasUnit' } } },
	} },
	{ 'no context at all', { properties = { a = { type = 'string' } } } },
}
for _, case in ipairs( contextCases ) do
	rec.record( 'buildContext', case[1], { support.encode( case[2] ) },
		p.buildContext( { jsonschema = case[2] } ).context )
end

-- p.getDisplayLabel --------------------------------------------------------
local labelCases = {
	{ 'HasLabel wins', { label = { { text = 'raw' } } }, { HasLabel = { 'Keyword@en' } } },
	{ 'HasName next', { name = 'raw' }, { HasName = { 'MachineName' } } },
	{ 'HasName as a scalar', {}, { HasName = 'MachineName' } },
	{ 'jsondata label, rendered', { label = { 'Rendered@de' } }, {} },
	{ 'jsondata label, raw object', { label = { { text = 'Raw', lang = 'en' } } }, {} },
	{ 'jsondata name', { name = 'FromName' }, {} },
	{ 'nothing at all', {}, {} },
}
for _, case in ipairs( labelCases ) do
	rec.record( 'getDisplayLabel', case[1],
		{ support.encode( case[2] ), support.encode( case[3] ) },
		p.getDisplayLabel( case[2], case[3] ) )
end

-- p.setNormalizedLabel -----------------------------------------------------
local normalizeCases = {
	{ 'labels with languages', { HasLabel = { 'Lab Note@en', 'Labor-Notiz@de' } } },
	{ 'label without a language', { HasLabel = { 'Plain Label' } } },
	{ 'label as a scalar', { HasLabel = 'Scalar Label@en' } },
	{ 'non-ascii is stripped', { HasLabel = { 'Schlüsselwort@de' } } },
	{ 'falls back to HasName', { HasName = { 'MachineName' } } },
	{ 'falls back to the display title', { ['Display title of'] = { 'Some Title' } } },
	{ 'nothing to normalise', { HasType = { 'Category:X' } } },
}
for _, case in ipairs( normalizeCases ) do
	local props = p.copy( case[2] )
	p.setNormalizedLabel( props )
	rec.record( 'setNormalizedLabel', case[1], { support.encode( case[2] ) }, props )
end

-- p.processQuantityValue ---------------------------------------------------
local quantitySchema = {
	['x-smw-quantity-property'] = 'Property:HasLengthValue',
	properties = {
		value = { type = 'number', default = 1 },
		unit = {
			enum = { 'Item:Metre', 'Item:Centimetre' },
			default = 'Item:Metre',
			options = { enum_titles = { 'm', 'cm' } },
		},
	},
}
local quantityCases = {
	{ 'value and unit', { value = 5, unit = 'Item:Centimetre' }, quantitySchema },
	{ 'unit falls back to the default', { value = 5 }, quantitySchema },
	{ 'unknown unit is skipped', { value = 5, unit = 'Item:Furlong' }, quantitySchema },
	{ 'no value is skipped', { unit = 'Item:Metre' }, quantitySchema },
	{ 'external property is skipped', { value = 5, unit = 'Item:Metre' },
		{ ['x-smw-quantity-property'] = 'schema:height', properties = quantitySchema.properties } },
	{ 'schema without enum_titles is skipped', { value = 5, unit = 'Item:Metre' },
		{ ['x-smw-quantity-property'] = 'Property:HasLengthValue',
		  properties = { value = {}, unit = { enum = { 'Item:Metre' } } } } },
	{ 'not a quantity schema at all', { value = 5 }, { properties = { value = {} } } },
}
for _, case in ipairs( quantityCases ) do
	rec.record( 'processQuantityValue', case[1],
		{ support.encode( case[2] ), support.encode( case[3] ) },
		p.processQuantityValue( { properties = {}, value_object = p.copy( case[2] ), schema = case[3] } ).properties )
end

-- p.processStatement -------------------------------------------------------
local statementCases = {
	{ 'implicit subject creates a shortcut', {},
		{ HasProperty = { 'Property:HasPart' }, HasObject = { 'Item:A', 'Item:B' } } },
	{ 'explicit subject is left alone', {},
		{ HasSubject = { 'Item:Other' }, HasProperty = { 'Property:HasPart' }, HasObject = { 'Item:A' } } },
	{ 'empty subject counts as implicit', {},
		{ HasSubject = { '' }, HasProperty = { 'Property:HasPart' }, HasObject = { 'Item:A' } } },
	{ 'no property is a no-op', {}, { HasObject = { 'Item:A' } } },
	{ 'no object is a no-op', {}, { HasProperty = { 'Property:HasPart' } } },
	{ 'appends to an existing property', { HasPart = { 'Item:Existing' } },
		{ HasProperty = { 'Property:HasPart' }, HasObject = { 'Item:A' } } },
}
for _, case in ipairs( statementCases ) do
	rec.record( 'processStatement', case[1],
		{ support.encode( case[2] ), support.encode( case[3] ) },
		p.processStatement( { subject = p.copy( case[2] ), statement = case[3] } ).subject )
end

-- p.getSemanticProperties --------------------------------------------------
-- Returns the page properties, the per-key definitions and the subobject
-- writes the traversal performed, which together are the whole SemanticMapping.
local function semantic( name, schema, jsondata )
	storedSubobjects = {}
	local res = p.getSemanticProperties( {
		jsonschema = schema,
		jsondata = p.copy( jsondata ),
		store = false,
	} )
	rec.record( 'getSemanticProperties', name,
		{ support.encode( schema ), support.encode( jsondata ) },
		{
			properties = res.properties,
			definitions = res.definitions,
			subobjects = storedSubobjects,
		} )
end

semantic( 'flat scalar mapping',
	{ ['@context'] = { name = 'Property:HasName' } },
	{ name = 'Widget', unmapped = 'ignored' } )

semantic( 'list of scalars',
	{ ['@context'] = { keywords = 'Property:HasKeyword' } },
	{ keywords = { 'Term:A', 'Term:B' } } )

-- One term per key. Two terms competing for the same key is realistic, and the
-- values land under both properties deterministically, but which of them ends
-- up in `definitions` depends on pairs() order and so cannot be pinned here.
-- LuaSemanticFixtureTest covers that case separately.
semantic( 'asterisk shorthand maps the bare key',
	{ ['@context'] = { ['type*'] = { ['@id'] = 'Property:HasType' } } },
	{ type = { 'Category:A' } } )

semantic( 'external iri is not stored',
	{ ['@context'] = { url = 'schema:url' } },
	{ url = 'https://example.org' } )

semantic( 'nested object becomes a subobject',
	{ ['@context'] = { part = { ['@id'] = 'Property:HasPart', ['@type'] = '@id' } },
	  properties = { part = { type = 'object', ['@context'] = { name = 'Property:HasName' },
	                          properties = { name = { type = 'string' } } } } },
	{ part = { uuid = '11111111-2222-3333-4444-555555555555', name = 'Bolt' } } )

semantic( 'nested object without a uuid yields no reference',
	{ ['@context'] = { part = { ['@id'] = 'Property:HasPart' } },
	  properties = { part = { type = 'object', ['@context'] = { name = 'Property:HasName' } } } },
	{ part = { name = 'Bolt' } } )

semantic( 'list of objects',
	{ ['@context'] = { parts = { ['@id'] = 'Property:HasPart' } },
	  properties = { parts = { items = { type = 'object', ['@context'] = { name = 'Property:HasName' } } } } },
	{ parts = {
		{ uuid = 'aaaaaaaa-0000-0000-0000-000000000001', name = 'One' },
		{ uuid = 'aaaaaaaa-0000-0000-0000-000000000002', name = 'Two' },
	} } )

semantic( 'reverse property is stored on the subobject',
	{ ['@context'] = { parent = { ['@reverse'] = 'Property:HasPart' } },
	  properties = { parent = { type = 'object', ['@context'] = { name = 'Property:HasName' } } } },
	{ parent = { uuid = 'bbbbbbbb-0000-0000-0000-000000000001', name = 'Assembly' } } )

semantic( 'statement shortcut is written onto the page',
	{ ['@context'] = { statements = { ['@id'] = 'Property:HasStatement' } },
	  properties = { statements = { items = { type = 'object', ['@context'] = {
		  predicate = 'Property:HasProperty', object = 'Property:HasObject' } } } } },
	{ statements = { {
		uuid = 'cccccccc-0000-0000-0000-000000000001',
		predicate = 'Property:HasPart',
		object = { 'Item:X' },
	} } } )

semantic( 'quantity object emits the flat value too',
	{ ['@context'] = { length = { ['@id'] = 'Property:HasLength' } },
	  properties = { length = {
		  type = 'object',
		  ['x-smw-quantity-property'] = 'Property:HasLengthValue',
		  properties = {
			  value = { type = 'number' },
			  unit = { enum = { 'Item:Metre' }, options = { enum_titles = { 'm' } } },
		  },
	  } } },
	{ length = { value = 2.5, unit = 'Item:Metre' } } )

semantic( 'subobject category and label handling',
	{ ['@context'] = { part = { ['@id'] = 'Property:HasPart' } },
	  properties = { part = { type = 'object', title = 'Part',
	                          ['@context'] = { label = 'Property:HasLabel' } } } },
	{ part = { uuid = 'dddddddd-0000-0000-0000-000000000001',
	           type = { 'Category:Part' }, label = { 'Bolt@en' } } } )

semantic( 'empty data', { ['@context'] = { name = 'Property:HasName' } }, {} )

rec.write()
