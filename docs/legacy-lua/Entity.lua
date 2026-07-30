local p = {} --p stands for package
local mwjson = require('Module:MwJson')

function p.process(frame, mode, title, jsondata, jsonschema, template)
	local msg = "Debug Output: <br>" --debug msg

	local res = ""
	if title == nil then title = mw.title.getCurrentTitle().fullText end
	local namespace = mwjson.splitString(title, ':')[1]
	
	if (jsondata == nil and frame.args['jsondata'] ~= nil) then 
		--jsondata =  mw.text.jsonDecode(mw.text.unstrip(frame.args['jsondata']), mw.text.JSON_TRY_FIXING)--:gsub("<*>", ""):gsub("</nowiki>", "")) 
		jsondata =  mw.text.jsonDecode(frame.args['jsondata'], mw.text.JSON_TRY_FIXING) -- nowiki-wrapping and mw.text.unstrip does not work
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
	
	mw.logObject(jsondata)
	
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
	--if (debug) then mw.log(msg) end
	--mw.logObject(res)
	return res
end

function p.header(frame, title)
	return p.process(frame, "header", title)
end

function p.footer(frame, title)
	return p.process(frame, "footer", title)
end

--test: mw.logObject(p.query(mw.getCurrentFrame(), '{"category":"Category:Hardware","manufacturer":"TestM"}'))
function p.query(frame, jsondata_str)
	if (jsondata_str == nil) then jsondata_str = frame.args['jsondata'] end
	--local res = mwjson.processJsondata({frame=frame, jsondata=mw.text.jsonDecode(jsondata_str), mode=mwjson.mode.query}).wikitext
	return jsondata_str --.. "<br>" .. res
end

return p

--DEBUG (direct invoke)
--[[
frame = mw.getCurrentFrame() -- Get a frame object
title="Item:OSL7d7193567ea14e4e89b74de88983b718"
newFrame = frame:newChild{ title=title, args = {}}
mw.log(p.header( newFrame, title ) ) 
--]]

--DEBUG (custom schema and template)
--[[
frame = mw.getCurrentFrame() -- Get a frame object
title="Item:OSL7d7193567ea14e4e89b74de88983b718"
newFrame = frame:newChild{ title=title, args = {jsonschema='{"title": "MySchema", "properties": {"name": {"title": "Name"}}}', template="Name: {{{name}}}", jsondata='{"name":"TEST"}'}}
mw.log(p.header( newFrame, title ) ) 
--]]