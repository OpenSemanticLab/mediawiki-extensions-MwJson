-- The Module:Entity shim.
--
-- Deployed to the wiki during the migration so that the PHP pipeline can be
-- switched on and off without editing a single page. The header and footer slot
-- of every content page calls into this module; it asks whether the PHP
-- renderer is enabled and, if not, falls through to the untouched legacy code.
--
-- $wgMwJsonRenderer ('lua' by default, 'php' to switch over) is therefore a
-- live rollback switch: flipping it back restores the previous behaviour
-- everywhere, with no edits and no content migration.
--
-- The legacy path below is byte-for-byte the original Module:Entity, kept so
-- that the fallback is genuinely the old code rather than a reimplementation of
-- it. Once the parser function lands and the cutover is complete, the whole
-- module goes away.
--
-- Source of record: extensions/MwJson/docs/legacy-lua/Entity.shim.lua

local p = {}
local mwjson = require('Module:MwJson')

--- True when the PHP pipeline should handle this render.
-- Guarded so that the module still works on a wiki where the extension is
-- older than the library, which is what makes deploying this safe.
local function usePhp()
	return mw.ext ~= nil
		and mw.ext.mwjson ~= nil
		and mw.ext.mwjson.enabled()
end

function p.process(frame, mode, title, jsondata, jsonschema, template)
	if usePhp() then
		return mw.ext.mwjson.render(
			mode,
			title,
			frame.args and frame.args['jsondata'] or nil,
			frame.args and frame.args['jsonschema'] or nil,
			frame.args and frame.args['template'] or nil
		)
	end

	-- ---------------------------------------------------------------------
	-- Legacy path, unchanged from the original Module:Entity.
	-- ---------------------------------------------------------------------
	local msg = "Debug Output: <br>" --debug msg

	local res = ""
	if title == nil then title = mw.title.getCurrentTitle().fullText end
	local namespace = mwjson.splitString(title, ':')[1]

	if (jsondata == nil and frame.args['jsondata'] ~= nil) then
		jsondata =  mw.text.jsonDecode(frame.args['jsondata'], mw.text.JSON_TRY_FIXING)
	end
	if (jsonschema == nil and frame.args['jsonschema'] ~= nil) then
		jsonschema =  mw.text.jsonDecode(frame.args['jsonschema'], mw.text.JSON_TRY_FIXING)
	end
	if (template == nil and frame.args['template'] ~= nil) then
		template =  mw.text.unstrip(frame.args['template'])
	end
	if (jsondata == nil) then
		local jsondata_res = mwjson.loadJson({title=title, slot=mwjson.slots.jsondata})
		jsondata = jsondata_res.json
		msg = msg .. jsondata_res.debug_msg
	end

	local debug = mwjson.defaultArg(jsondata[mwjson.keys.debug], false)

	local process_res = nil
	if (namespace == "Category") then
		if (mode == "header") then process_res = mwjson.processJsondata({frame=frame, jsonschema=jsonschema, template=template, jsondata=jsondata, mode=mwjson.mode.header, categories={"Category:Category"}, recursive=true, debug=debug}) end
		if (mode == "footer") then process_res = mwjson.processJsondata({frame=frame, jsonschema=jsonschema, template=template, jsondata=jsondata, mode=mwjson.mode.footer, categories={"Category:Category"}, recursive=true, debug=debug}) end
	else
		if (mode == "header") then process_res = mwjson.processJsondata({frame=frame, jsonschema=jsonschema, template=template, jsondata=jsondata, mode=mwjson.mode.header, debug=debug}) end
		if (mode == "footer") then process_res = mwjson.processJsondata({frame=frame, jsonschema=jsonschema, template=template, jsondata=jsondata, mode=mwjson.mode.footer, debug=debug}) end
	end

	res = res .. process_res.wikitext
	msg = msg .. process_res.debug_msg

	if (debug) then res = msg .. res  end
	return res
end

function p.header(frame, title)
	return p.process(frame, "header", title)
end

function p.footer(frame, title)
	return p.process(frame, "footer", title)
end

function p.query(frame, jsondata_str)
	if (jsondata_str == nil) then jsondata_str = frame.args['jsondata'] end
	return jsondata_str
end

return p
