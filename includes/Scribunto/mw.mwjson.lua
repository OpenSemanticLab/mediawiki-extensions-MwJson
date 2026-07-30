--- Lua interface for the MwJson OO-LD pipeline.
--
-- Registered as mw.ext.mwjson. Exists so Module:Entity can hand a render over
-- to PHP without any page needing to change: the module asks whether the PHP
-- renderer is enabled and falls through to the legacy Module:MwJson if not.
--
-- @see MediaWiki\Extension\MwJson\Scribunto\MwJsonLuaLibrary

local mwjson = {}
local php

function mwjson.setupInterface( options )
	-- Boilerplate
	mwjson.setupInterface = nil
	php = mw_interface
	mw_interface = nil

	mw = mw or {}
	mw.ext = mw.ext or {}
	mw.ext.mwjson = mwjson

	package.loaded['mw.ext.mwjson'] = mwjson
end

--- Whether $wgMwJsonRenderer selects the PHP pipeline.
--
-- Module:Entity should call this before doing anything else, so that flipping
-- the config switches every page at once and back again.
--
-- @treturn boolean
function mwjson.enabled()
	return php.enabled()
end

--- Render one slot of a page.
--
-- @string mode        "header" or "footer"
-- @string[opt] title  page to render; defaults to the page being parsed
-- @string[opt] jsondata    inline data as JSON, when not read from the slot
-- @string[opt] jsonschema  inline schema as JSON
-- @string[opt] template    inline template for the page itself
-- @treturn string wikitext
function mwjson.render( mode, title, jsondata, jsonschema, template )
	return php.render( mode, title, jsondata, jsonschema, template )
end

return mwjson
