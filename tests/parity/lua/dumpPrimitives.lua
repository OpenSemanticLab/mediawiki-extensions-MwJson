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
-- Minimal stubs. MwJson.lua pulls in Module:Lustache and the mw library at
-- load time; the primitives themselves touch neither.
-- ---------------------------------------------------------------------------
local realRequire = require
require = function( name )
	if name:match( '^Module:' ) then
		return setmetatable( {}, { __index = function() return function() end end } )
	end
	return realRequire( name )
end

mw = {
	dumpObject = function( o ) return tostring( o ) end,
	logObject = function() end,
	log = function() end,
	text = { trim = function( s ) return ( s:gsub( '^%s*(.-)%s*$', '%1' ) ) end },
	title = { getCurrentTitle = function() return { fullText = '', nsText = '' } end },
}

local here = arg and arg[0] and arg[0]:match( '(.*)/' ) or '.'
local p = dofile( here .. '/../../../docs/legacy-lua/MwJson.lua' )

-- ---------------------------------------------------------------------------
-- JSON encoding. Lua 5.1 has none, and Lua cannot distinguish an empty list
-- from an empty map, so empty tables are emitted as [], which is exactly the
-- ambiguity the PHP port has to make a decision about, so the fixture records
-- it honestly rather than papering over it.
-- ---------------------------------------------------------------------------
local function isList( t )
	if next( t ) == nil then return true end
	local n = 0
	for k in pairs( t ) do
		if type( k ) ~= 'number' then return false end
		n = n + 1
	end
	return n == #t
end

local function escape( s )
	return ( s:gsub( '[%c"\\]', function( c )
		local map = { ['"'] = '\\"', ['\\'] = '\\\\', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t' }
		return map[c] or string.format( '\\u%04x', c:byte() )
	end ) )
end

local function encode( v )
	local t = type( v )
	if v == nil then return 'null' end
	if t == 'boolean' then return tostring( v ) end
	if t == 'number' then return string.format( '%.14g', v ) end
	if t == 'string' then return '"' .. escape( v ) .. '"' end
	if t ~= 'table' then return '"<' .. t .. '>"' end

	if isList( v ) then
		local parts = {}
		for i = 1, #v do parts[#parts + 1] = encode( v[i] ) end
		return '[' .. table.concat( parts, ',' ) .. ']'
	end

	-- Sort keys so the fixture is stable across runs; Lua's pairs() order is
	-- unspecified, which is the whole reason the parity harness sorts too.
	local keys = {}
	for k in pairs( v ) do keys[#keys + 1] = tostring( k ) end
	table.sort( keys )
	local parts = {}
	for _, k in ipairs( keys ) do
		-- Not `v[k] ~= nil and v[k] or v[tonumber(k)]`: that idiom silently
		-- turns a stored `false` into the fallback branch.
		local value = v[k]
		if value == nil then value = v[tonumber( k )] end

		-- Emit numeric keys 0-based. Lua indexes sequences from 1 and PHP from
		-- 0, and json_decode() already yields 0-based lists for the JSON-array
		-- branch above; translating mixed tables here too means the fixture is
		-- expressed entirely in the port's representation and the PHP side
		-- needs no reindexing (which is easy to get subtly wrong).
		local outKey = k
		local n = tonumber( k )
		if n ~= nil and v[n] ~= nil then outKey = tostring( n - 1 ) end

		parts[#parts + 1] = '"' .. escape( outKey ) .. '":' .. encode( value )
	end
	return '{' .. table.concat( parts, ',' ) .. '}'
end

-- ---------------------------------------------------------------------------
-- Cases. Keep these in step with the PHP unit tests; anything interesting that
-- turns up during the port should be added here first.
-- ---------------------------------------------------------------------------
local cases = {}

local function record( fn, name, args, result )
	cases[#cases + 1] = { fn = fn, name = name, args = args, result = result }
end

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
	record( 'tableMerge', name, args, p.tableMerge( t1, t2 ) )
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
	record( 'splitString', case[1] .. ' | ' .. case[2],
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
	record( 'defaultArgPath', name, args, p.defaultArgPath( arg, path, default ) )
end

-- Simple predicates --------------------------------------------------------
local scalarCases = { nil, '', 'a', 0, false, {} }
for i = 1, 6 do
	local v = scalarCases[i]
	record( 'nilOrEmpty', 'case ' .. i, { encode( v ) }, p.nilOrEmpty( v ) )
	record( 'tablefy', 'case ' .. i, { encode( v ) }, p.tablefy( v ) )
end
record( 'nilOrEmpty', 'non-empty table', { encode( { 'a' } ) }, p.nilOrEmpty( { 'a' } ) )
record( 'tablefy', 'map', { encode( { k = 'v' } ) }, p.tablefy( { k = 'v' } ) )

record( 'tableContains', 'present', { encode( { 'a', 'b' } ), '"b"' }, p.tableContains( { 'a', 'b' }, 'b' ) )
record( 'tableContains', 'absent', { encode( { 'a', 'b' } ), '"c"' }, p.tableContains( { 'a', 'b' }, 'c' ) )
record( 'tableContains', 'no coercion', { encode( { 1, 2 } ), '"1"' }, p.tableContains( { 1, 2 }, '1' ) )
record( 'tableContains', 'map part invisible', { encode( { k = 'v' } ), '"v"' }, p.tableContains( { k = 'v' }, 'v' ) )

record( 'tableLength', 'mixed', { encode( { 'a', 'b', k = 'v' } ) }, p.tableLength( { 'a', 'b', k = 'v' } ) )
record( 'tableLength', 'empty', { '[]' }, p.tableLength( {} ) )

-- ---------------------------------------------------------------------------
io.write( '{"_generator":"tests/parity/lua/dumpPrimitives.lua","_lua":"'
	.. _VERSION .. '","cases":[' )
for i, case in ipairs( cases ) do
	if i > 1 then io.write( ',' ) end
	io.write( '\n  {"fn":"' .. case.fn .. '","name":"' .. escape( case.name )
		.. '","args":[' .. table.concat( case.args, ',' )
		.. '],"result":' .. encode( case.result ) .. '}' )
end
io.write( '\n]}\n' )
