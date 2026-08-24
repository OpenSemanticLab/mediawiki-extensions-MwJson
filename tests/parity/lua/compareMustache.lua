--[[
Lustache side of the mustache conformance gate.

Renders every eval_template found on the wiki, against real jsondata values,
through the *actual* Module:Lustache under Lua 5.1, and prints the results as
JSON. tests/parity/compareMustache.php renders the same cases through
lightncandy and diffs the two.

The point is to decide, on evidence, whether lightncandy can replace Lustache.
The OSL templates use mustache delimiter switching, implicit iterators and
nested sections, so a synthetic test suite would not settle it.

Input:  tests/parity/output/eval-templates.lua  (from dumpEvalTemplates.php)
Output: stdout, consumed by compareMustache.php

    docker exec <container> lua \
        /var/www/html/w/extensions/MwJson/tests/parity/lua/compareMustache.lua \
        > tests/parity/output/lustache-results.json
--]]

local dir = ( arg and arg[0] and arg[0]:match( '(.*)/' ) ) or '.'
local support = dofile( dir .. '/support.lua' )

support.installStubs( nil, dir .. '/../../../docs/legacy-lua' )

local lustache = require( 'Module:Lustache' )
local cases = dofile( dir .. '/../output/eval-templates.lua' )

--- Reproduce p.tableMerge for the partial table, since that is how
--- expandEmbeddedTemplates builds it: `tableMerge({self=value}, partials)`,
--- registering the template as a partial named "self" so a template can recurse
--- into itself.
local function partialsFor( case )
	local partials = { self = case.template }
	for k, v in pairs( case.partials or {} ) do partials[k] = v end
	return partials
end

--- The render input, following expandEmbeddedTemplates:
---   property level, root_key ~= false  ->  { [property] = value }
---   property level, root_key == false  ->  value
---   items level                        ->  the item itself
local function inputsFor( case )
	local inputs = {}

	if case.samples == nil or #case.samples == 0 then
		-- Still worth rendering: an absent value must produce empty output
		-- rather than an error, and compile-time behaviour is exercised.
		inputs[#inputs + 1] = { label = 'empty', value = {} }
		return inputs
	end

	for i, sample in ipairs( case.samples ) do
		if case.level == 'items' then
			if type( sample ) == 'table' and #sample > 0 then
				for j = 1, math.min( #sample, 2 ) do
					inputs[#inputs + 1] = { label = 'sample ' .. i .. ' item ' .. j, value = sample[j] }
				end
			else
				inputs[#inputs + 1] = { label = 'sample ' .. i, value = sample }
			end
		elseif case.root_key == false then
			inputs[#inputs + 1] = { label = 'sample ' .. i, value = sample }
		else
			inputs[#inputs + 1] = { label = 'sample ' .. i, value = { [case.property] = sample } }
		end
	end

	return inputs
end

local results = {}

for index, case in ipairs( cases ) do
	for _, input in ipairs( inputsFor( case ) ) do
		local ok, output = pcall( function()
			-- The renderer caches compiled templates on itself and keeps the
			-- partial table as state, so partials are passed on every call
			-- exactly as MwJson.lua does.
			return lustache:render( case.template, input.value, partialsFor( case ) )
		end )

		results[#results + 1] = {
			index = index - 1, -- 0-based, to match the PHP case list
			input = input.label,
			ok = ok,
			output = ok and output or nil,
			error = ( not ok ) and tostring( output ) or nil,
		}
	end
end

io.write( '{"_generator":"tests/parity/lua/compareMustache.lua","_lua":"' .. _VERSION .. '","results":[' )
for i, result in ipairs( results ) do
	if i > 1 then io.write( ',' ) end
	io.write( '\n  ' .. support.encode( result ) )
end
io.write( '\n]}\n' )
