--[[
Shared support for the differential-test generators in this directory.

Provides the stubs needed to load docs/legacy-lua/MwJson.lua outside MediaWiki,
a JSON encoder (Lua 5.1 has none), and the case-recording plumbing.

Load with dofile(), not require(): require is itself stubbed below so that
MwJson.lua's `require("Module:Lustache")` resolves.
--]]

local support = {}

--- Stub `require` so Module: names resolve to a permissive dummy, and install a
--- minimal `mw`. The functions covered by these generators touch neither, but
--- both are referenced at load time.
---
--- @param slots table|nil  pageTitle -> { slotName = text }, backing mw.slots.slotContent
--- Module: names that resolve to a real file in docs/legacy-lua rather than to
--- the permissive dummy. Set by installStubs when a snapshot dir is given.
--- @type table|nil
local moduleFiles = nil
local moduleCache = {}

function support.installStubs( slots, snapshotDir )
	if snapshotDir then
		moduleFiles = {
			['Module:Lustache'] = snapshotDir .. '/Lustache.lua',
			['Module:Lustache/Context'] = snapshotDir .. '/Lustache_Context.lua',
			['Module:Lustache/Renderer'] = snapshotDir .. '/Lustache_Renderer.lua',
			['Module:Lustache/Scanner'] = snapshotDir .. '/Lustache_Scanner.lua',
		}
	end

	local realRequire = require
	require = function( name )
		if moduleFiles and moduleFiles[name] then
			-- require() memoises; Lustache's renderer is a singleton and the
			-- modules require each other, so loading twice would give two
			-- renderers with separate partial tables.
			if moduleCache[name] == nil then
				moduleCache[name] = dofile( moduleFiles[name] )
			end
			return moduleCache[name]
		end
		if name:match( '^Module:' ) then
			return setmetatable( {}, { __index = function() return function() end end } )
		end
		return realRequire( name )
	end

	mw = {
		dumpObject = function( o ) return tostring( o ) end,
		logObject = function() end,
		log = function() end,
		text = {
			trim = function( s ) return ( s:gsub( '^%s*(.-)%s*$', '%1' ) ) end,
			--- mw.text.split with plain=true, which is the only form
			--- expandJsonRef uses (splitting a path on the literal "wiki/").
			split = function( s, sep, plain )
				local out, pos = {}, 1
				while true do
					local a, b = s:find( sep, pos, plain )
					if not a then
						out[#out + 1] = s:sub( pos )
						return out
					end
					out[#out + 1] = s:sub( pos, a - 1 )
					pos = b + 1
				end
			end,
		},
		--- Enough of mw.uri for expandJsonRef: .path and .query on a
		--- raw-action reference URL.
		uri = {
			new = function( s )
				local path, qs = s:match( '^([^?]*)%??(.*)$' )
				local query = {}
				for k, v in qs:gmatch( '([^&=]+)=([^&]*)' ) do query[k] = v end
				return { path = path, query = query }
			end,
		},
		title = { getCurrentTitle = function() return { fullText = '', nsText = '' } end },
		slots = {
			slotContent = function( slot, title )
				if slot == nil or slots == nil then return nil end
				local page = slots[title]
				if page == nil then return nil end
				local content = page[slot]
				if type( content ) == 'string' then return content end
				return nil
			end,
		},
	}
end

--- @param dir string  directory of the calling script
--- @return table      the MwJson package table
function support.loadMwJson( dir )
	return dofile( dir .. '/../../../docs/legacy-lua/MwJson.lua' )
end

--- Directory of the running script, for resolving relative paths.
function support.scriptDir()
	return arg and arg[0] and arg[0]:match( '(.*)/' ) or '.'
end

-- ---------------------------------------------------------------------------
-- JSON encoding
-- ---------------------------------------------------------------------------

--- Lua cannot distinguish an empty list from an empty map, so empty tables are
--- emitted as []. That ambiguity is real and the PHP port has to take a
--- position on it, so the fixture records it rather than papering over it.
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

--- Encode a Lua value as JSON.
---
--- Numeric table keys are emitted 0-based: Lua indexes sequences from 1 and the
--- PHP port from 0 (json_decode yields 0-based lists), so translating here
--- means the fixture is expressed entirely in the port's representation and the
--- PHP side needs no reindexing, which is easy to get subtly wrong.
---
--- Map keys are sorted so the fixture is reproducible; Lua's pairs() order is
--- unspecified, which is also why the parity harness compares SMW data as sets.
function support.encode( v )
	local t = type( v )
	if v == nil then return 'null' end
	if t == 'boolean' then return tostring( v ) end
	if t == 'number' then return string.format( '%.14g', v ) end
	if t == 'string' then return '"' .. escape( v ) .. '"' end
	if t ~= 'table' then return '"<' .. t .. '>"' end

	if isList( v ) then
		local parts = {}
		for i = 1, #v do parts[#parts + 1] = support.encode( v[i] ) end
		return '[' .. table.concat( parts, ',' ) .. ']'
	end

	local keys = {}
	for k in pairs( v ) do keys[#keys + 1] = tostring( k ) end
	table.sort( keys )
	local parts = {}
	for _, k in ipairs( keys ) do
		-- Not `v[k] ~= nil and v[k] or v[tonumber(k)]`: that idiom silently
		-- turns a stored `false` into the fallback branch.
		local value = v[k]
		if value == nil then value = v[tonumber( k )] end

		local outKey = k
		local n = tonumber( k )
		if n ~= nil and v[n] ~= nil then outKey = tostring( n - 1 ) end

		parts[#parts + 1] = '"' .. escape( outKey ) .. '":' .. support.encode( value )
	end
	return '{' .. table.concat( parts, ',' ) .. '}'
end

-- ---------------------------------------------------------------------------
-- Case recording
-- ---------------------------------------------------------------------------

function support.newRecorder( generator )
	local cases = {}
	return {
		--- @param args table  already-encoded JSON strings, in call order
		--- @param result any  raw Lua value, encoded on write
		record = function( fn, name, args, result )
			cases[#cases + 1] = { fn = fn, name = name, args = args, result = result }
		end,
		write = function()
			io.write( '{"_generator":"' .. generator .. '","_lua":"' .. _VERSION .. '","cases":[' )
			for i, case in ipairs( cases ) do
				if i > 1 then io.write( ',' ) end
				io.write( '\n  {"fn":"' .. case.fn .. '","name":"' .. escape( case.name )
					.. '","args":[' .. table.concat( case.args, ',' )
					.. '],"result":' .. support.encode( case.result ) .. '}' )
			end
			io.write( '\n]}\n' )
		end,
	}
end

return support
