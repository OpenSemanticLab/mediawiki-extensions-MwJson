--[[
Differential-test generator for the Module:MwJson primitives.

Loads the *real* Lua source in docs/legacy-lua/MwJson.lua under the stock
Lua 5.1 that Scribunto's luastandalone engine uses, runs a fixed list of cases
through p.tableMerge / p.splitString / p.defaultArgPath / p.nilOrEmpty /
p.tablefy / p.tableContains / p.tableLength, and prints the results as JSON on
stdout.

The output is committed as tests/phpunit/Unit/fixtures/lua-primitives.json and
replayed against the PHP port by LuaPrimitivesFixtureTest, so the unit tests
stay hermetic while still being grounded in what the Lua actually does rather
than in someone's reading of it.

One mechanical translation is applied on the way out: numeric table keys are
emitted 0-based, because Lua indexes sequences from 1 and the PHP port indexes
from 0 (json_decode produces 0-based lists). Nothing else about the values is
altered.

Regenerate with:

    docker exec <mediawiki-container> lua \
        /var/www/html/w/extensions/MwJson/tests/parity/lua/dumpPrimitives.lua \
        > tests/phpunit/Unit/fixtures/lua-primitives.json

Run from anywhere; paths are resolved relative to this file.
--]]

-- ---------------------------------------------------------------------------
local dir = ( arg and arg[0] and arg[0]:match( '(.*)/' ) ) or '.'
local support = dofile( dir .. '/support.lua' )

support.installStubs( nil )
local p = support.loadMwJson( dir )

local rec = support.newRecorder( 'tests/parity/lua/dumpPrimitives.lua' )
local encode = support.encode

-- ---------------------------------------------------------------------------
-- Cases. Keep these in step with the PHP unit tests; anything interesting that
-- turns up during the port should be added here first.
-- ---------------------------------------------------------------------------
-- p.tableMerge -------------------------------------------------------------
local mergeCases = {
	{ 'documented example',
		{ 'string', test1 = 'test1', subtable1 = { 'test' } },
		{ 'string2', test1 = 'test2', test3 = 'test4' } },
	{ 'integer keys append', { 'a', 'b' }, { 'c', 'd' } },
	{ 'nested arrays merge by position', { { 'a' }, { 'b' } }, { { 'c' } } },
	{ 'maps merge recursively',
		{ properties = { a = { title = 'A' } } },
		{ properties = { b = { title = 'B' } } } },
	{ 'source overwrites on string key',
		{ properties = { a = { title = 'from target' } } },
		{ properties = { a = { title = 'from source' } } } },
	{ 'array replaces scalar on string key', { a = 'scalar' }, { a = { 'x' } } },
	{ 'scalar replaces array on string key', { a = { 'x' } }, { a = 'scalar' } },
	{ 'both scalars', 'x', 'y' },
	{ 'scalar target', 'x', { 'y' } },
	{ 'scalar source', { 'x' }, 'y' },
	{ 'nil target', nil, { 'y' } },
	{ 'nil source', { 'x' }, nil },
	{ 'both nil', nil, nil },
	{ 'false is a value', nil, false },
	{ 'enum accumulation across a chain',
		{ enum = { 'a' }, required = { 'uuid' } },
		{ enum = { 'b' }, required = { 'label' } } },
}
for _, case in ipairs( mergeCases ) do
	local name, t1, t2 = case[1], case[2], case[3]
	-- tableMerge mutates t1, so encode the arguments before calling.
	local args = { encode( t1 ), encode( t2 ) }
	rec.record( 'tableMerge', name, args, p.tableMerge( t1, t2 ) )
end

-- p.splitString ------------------------------------------------------------
local splitCases = {
	{ 'a;b', ';' }, { 'Category:Entity', ':' }, { 'label*', '*' }, { 'label**', '*' },
	{ 'a*b', '*' }, { 'Keyword@en', '@' }, { 'a::b', ':' }, { '::a', ':' },
	{ 'a::', ':' }, { 'abc', ';' }, { '', ';' }, { ';;;', ';' },
	{ 'a:b;c', ':;' }, { 'a.b', '.' },
	{ '/wiki/JsonSchema:Label?action=raw', ':' },
}
for _, case in ipairs( splitCases ) do
	rec.record( 'splitString', case[1] .. ' | ' .. case[2],
		{ encode( case[1] ), encode( case[2] ) },
		p.splitString( case[1], case[2] ) )
end

-- p.defaultArgPath ---------------------------------------------------------
-- NOTE p.defaultArgPath consumes its path via table.remove, so each call needs
-- a fresh path table. That mutation is itself a quirk worth pinning.
local pathCases = {
	{ 'documented hit', { some = { defined = { path = 'value' } } }, { 'some', 'defined', 'path' }, 'default_value' },
	{ 'documented miss', { some = { defined = { path = 'value' } } }, { 'some', 'undefined', 'path' }, 'default_value' },
	{ 'empty path', { a = 1 }, {}, 'fallback' },
	{ 'nil root', nil, { 'a' }, 'fallback' },
	{ 'scalar mid-path', { some = { defined = { path = 'value' } } }, { 'some', 'defined', 'path', 'deeper' }, 'fallback' },
	{ 'false leaf', { a = false }, { 'a' }, 'fallback' },
	{ 'zero leaf', { a = 0 }, { 'a' }, 'fallback' },
}
for _, case in ipairs( pathCases ) do
	local name, arg, path, default = case[1], case[2], case[3], case[4]
	local args = { encode( arg ), encode( path ), encode( default ) }
	rec.record( 'defaultArgPath', name, args, p.defaultArgPath( arg, path, default ) )
end

-- Simple predicates --------------------------------------------------------
local scalarCases = { nil, '', 'a', 0, false, {} }
for i = 1, 6 do
	local v = scalarCases[i]
	rec.record( 'nilOrEmpty', 'case ' .. i, { encode( v ) }, p.nilOrEmpty( v ) )
	rec.record( 'tablefy', 'case ' .. i, { encode( v ) }, p.tablefy( v ) )
end
rec.record( 'nilOrEmpty', 'non-empty table', { encode( { 'a' } ) }, p.nilOrEmpty( { 'a' } ) )
rec.record( 'tablefy', 'map', { encode( { k = 'v' } ) }, p.tablefy( { k = 'v' } ) )

rec.record( 'tableContains', 'present', { encode( { 'a', 'b' } ), '"b"' }, p.tableContains( { 'a', 'b' }, 'b' ) )
rec.record( 'tableContains', 'absent', { encode( { 'a', 'b' } ), '"c"' }, p.tableContains( { 'a', 'b' }, 'c' ) )
rec.record( 'tableContains', 'no coercion', { encode( { 1, 2 } ), '"1"' }, p.tableContains( { 1, 2 }, '1' ) )
rec.record( 'tableContains', 'map part invisible', { encode( { k = 'v' } ), '"v"' }, p.tableContains( { k = 'v' }, 'v' ) )

rec.record( 'tableLength', 'mixed', { encode( { 'a', 'b', k = 'v' } ) }, p.tableLength( { 'a', 'b', k = 'v' } ) )
rec.record( 'tableLength', 'empty', { '[]' }, p.tableLength( {} ) )

-- ---------------------------------------------------------------------------
rec.write()
