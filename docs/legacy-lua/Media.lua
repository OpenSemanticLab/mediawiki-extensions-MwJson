local lustache = require("Module:Lustache")
--local yaml = require("Module:Yaml")
local p = {} --p stands for package

p.template = {}
p.template["mediawiki_gallery"] = [[{{#elements}}{{{file}}}|{{{description}}}
{{/elements}}]]

-- see also https://stackoverflow.com/questions/66382691/how-to-escape-brackets-in-a-multi-line-string-in-lua
p.template["bootstrap_gallery"] = [=[
<!-- Gallery -->
<div class="row">
  {{#elements}}
  <div class="col-lg-4 col-md-12 mb-4 mb-lg-0">
    [[{{{file}}}]]
  </div>
  {{/elements}}
</div>
<!-- Gallery -->
]=]

function p.gallery(frame)
	local jsondata = {}
	local frame = frame:getParent() -- disable for debug console, use the params passed to the template, see https://www.mediawiki.org/wiki/Lua/Scripting#frame:getParent_(frame:getParent())
	mw.logObject(frame.args)
	for k,v in pairs(frame.args) do jsondata[k] = v end
	local wikitext = ""
--	local text = mw.text.killMarkers(frame.args['jsondata'])
--	--jsondata =  mw.text.jsonDecode(frame.args['jsondata']:gsub("UNIQ.*QINU", ""), mw.text.JSON_TRY_FIXING)--:gsub("<*>", ""):gsub("</nowiki>", "")) 
--	jsondata =  mw.text.jsonDecode(text, mw.text.JSON_TRY_FIXING)--:gsub("<*>", ""):gsub("</nowiki>", "")) 
--	return "" .. frame.args['jsondata']
--end

--function p.test(frame)
--	local jsondata = mw.text.jsonDecode(frame.args['jsondata']:gsub("UNIQ.*QINU", ""), mw.text.JSON_TRY_FIXING)--:gsub("<*>", ""):gsub("</nowiki>", "")) 

	--if (frame.args['yamldata'] ~= nil) then jsondata = yaml.eval(frame.args['yamldata']) end
	if (frame.args['textdata'] ~= nil) then
		-- "File:OSW5f36a59d4bb94ea0bf93f08f7470f609.png|test1;File:OSWd1c24f1c4b014ebe99c2a83672e3dfc7.png|test2;"
		jsondata["elements"] = {}
		local lines = p.splitString(frame.args['textdata'], ";")
		for k,v in ipairs(lines) do
			local parts = p.splitString(v, "|")
			local element = {file=parts[1]:gsub('%s+', ''), description=parts[2]}
			table.insert(jsondata["elements"], element)
		end
	end
	if (jsondata["render_template"] == nil or jsondata["render_template"] == "") then jsondata["render_template"] = "mediawiki_gallery" end
	if (jsondata["image_size"] == nil or jsondata["image_size"] == "") then jsondata["image_size"] = "300" end
	mw.logObject(jsondata)
	
	
	local template = p.template["mediawiki_gallery"]
	if (jsondata["render_template"] == "bootstrap_gallery") then template = p.template["bootstrap_gallery"] end

	wikitext = lustache:render(template, jsondata)

	if (jsondata["render_template"] == "mediawiki_gallery") then 
		local params = {
			widths= jsondata["image_size"], 
			heights= jsondata["image_size"],
			mode= jsondata["mode"],
		}
		mw.logObject(params)
		wikitext = frame:extensionTag{ name = "gallery" , content = wikitext, args = params } 
	end
	
	mw.logObject(wikitext)
	return wikitext
end

function p.splitString(inputstr, sep)
    if sep == nil then
        sep = ";"
    end
    local t={}
    for str in string.gmatch(inputstr, "([^"..sep.."]+)") do
    	table.insert(t, str)
    end
    return t
end

return p

--DEBUG (direct invoke)
--[[
frame = mw.getCurrentFrame() -- Get a frame object
jsondata = '{"image_size": "300", "elements": [{"file": "File:OSW5f36a59d4bb94ea0bf93f08f7470f609.png", "description": "test"}]}'
newFrame = frame:newChild{ args = {jsondata=jsondata}}
mw.log(p.gallery( newFrame ) ) 
--]]
--[[
frame = mw.getCurrentFrame() -- Get a frame object
yamldata = [ [ --remove space for testing
image_size: 300
elements: 
 - file: "File:OSW5f36a59d4bb94ea0bf93f08f7470f609.png"
   description: "test
] ] --remove space for testing
newFrame = frame:newChild{ args = {yamldata=yamldata}}
mw.log(p.gallery( newFrame ) ) 
--]]
--[=[
frame = mw.getCurrentFrame() -- Get a frame object
textdata = [[ File:OSW5f36a59d4bb94ea0bf93f08f7470f609.png|a. Click on "Create Instance" on the Article tile;
File:OSWd1c24f1c4b014ebe99c2a83672e3dfc7.png|b. Add at least a label;
File:OSWd8adafab997746e69864f23e7bfba734.png|c. Additional properties can be added on demand. Click "Save" when you are done.;
]]
frame.args = {textdata=textdata}
newFrame = frame:newChild{ args = {textdata=textdata, render_template="bootstrap_gallery"}}
mw.log(p.gallery( newFrame ) ) 
--]=]