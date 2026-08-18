-- mw.logObject(p.processJsondata({jsondata=p.loadJson({title="Item:OSW7d7193567ea14e4e89b74de88983b718", slot="jsondata"}).json, debug=true, mode="header"}))

local lustache = require("Module:Lustache")

local p = {} --p stands for package

p.keys = { --jsonschema / json-ld keys
	category='type', 
	category_pseudoproperty='Category', -- Property:Category
	subcategory='subclass_of',
	schema_type='schema_type',
	property_ns_prefix='Property',
	schema='osl_schema', 
	template='eval_template',
	mode='mode',
	context='@context',
	allOf='allOf',
	label='label',
	name='name',
	description='description',
	text='text',
	smw_quantity_property='x-smw-quantity-property',
	debug='_debug'
}
p.slots = { --slot names
	main='main',
	jsondata='jsondata', 
	jsonschema='jsonschema', 
	header_template='header_template',
	footer_template='footer_template',
	data_template='data_template'
} 
p.mode = {
	header='header',
	footer='footer',
	query='query'
}
-- json-ld property a slot is mapped to in order to be treated as a characteristic, which makes it
-- addressable by its schema key. keys mapped to any other property (statements, label, meta, ...)
-- are not addressed individually to avoid minting a property for every object valued key
p.characteristic_property = "Property:HasCharacteristic"
-- prefix for the properties linking a parent to the subobject of a quantity slot, e.g. "l1" => "HasCharacteristic_l1".
-- the prefix keeps these properties in a namespace only written here, so they always hold page values
-- (the subobject reference). a bare schema key would be a global property that another schema may use
-- for a string, which makes smw report type errors. no property page is required either way
p.slot_property_prefix = "HasCharacteristic_"

p.cache = {}

--loads json from a wiki page
--test: mw.logObject(p.loadJson({title="JsonSchema:Entity"}))
--test: mw.logObject(p.loadJson({title="Category:Entity", slot="jsonschema"}))
function p.loadJson(args)
	local page_title = p.defaultArg(args.title, "JsonSchema:Entity") --for testing
	local slot = p.defaultArg(args.slot, 'main')
	local debug = p.defaultArg(args.debug, nil)
	local msg = ""
	
	local json = {}
	
	if p.cache[page_title] ~= nil then
		if p.cache[page_title][slot] ~= nil then
			if (debug) then msg = msg .. "Fetch slot " .. p.slots.jsondata .. " of page " .. page_title .. " from cache <br>" end
			json = p.cache[page_title][slot]
			return {json=json, debug_msg=msg}
		end
	else p.cache[page_title] = {}
	end
	
	if (slot == 'main') then
		--json = mw.loadJsonData( "JsonSchema:Entity" ) --requires MediaWiki 1.39
		local page = mw.title.makeTitle(p.splitString(page_title, ':')[1], p.splitString(page_title, ':')[2])
		local text = page:getContent()
		if (text ~= nil) then json = mw.text.jsonDecode(text) end
	else
		if (debug) then msg = msg .. "Fetch slot " .. p.slots.jsondata .. " of page " .. page_title .. "<br>" end
		local text = mw.slots.slotContent( slot , page_title )
		if (text ~= nil) then json = mw.text.jsonDecode(text) end
	end	
	
	
	local generated_content = json["$defs"] and json["$defs"]["generated"]
	
	if generated_content then
	    -- Check if "$ref": "#/$defs/generated" exists directly in the table
	    if json["$ref"] == "#/$defs/generated" then
	        json = p.tableMerge(p.copy(generated_content), json)
	        json["$ref"] = nil -- Remove the reference after merging
	    end
	
	    -- Check if "$ref": "#/$defs/generated" is contained in "allOf"
	    if json["allOf"] then
	        for _, item in ipairs(json["allOf"]) do
	            if item["$ref"] == "#/$defs/generated" then
	            	
	            	-- Remove the reference after merging
	                for i, v in ipairs(json["allOf"]) do
	                    if v["$ref"] == "#/$defs/generated" then
	                        table.remove(json["allOf"], i)
	                        break
	                    end
	                end
	                json = p.tableMerge(p.copy(generated_content), json)
	                
	                break
	            end
	        end
	    end
	    json["$defs"]["generated"] = nil
	end
	
	--mw.logObject(json)
	p.cache[page_title][slot] = json

	return {json=json, debug_msg=msg}
end


-- test: mw.logObject(p.walkJsonSchema({jsonschema=p.loadJson({title="Category:Hardware", slot="jsonschema"}).json, debug=true}).jsonschema)
function p.walkJsonSchema(args)
	local jsonschema = p.defaultArg(args.jsonschema, {})
	local jsonschemas = p.defaultArg(args.jsonschemas, {})
	local categories = p.defaultArg(args.categories, nil)
	local visited = p.defaultArg(args.visited, {})
	local mode = p.defaultArg(args.mode, p.mode.header)
	--local merged_jsonschema = p.defaultArg(args.merged_jsonschema, {})
	local template = p.defaultArg(args.template, nil)
	local templates = p.defaultArg(args.templates, {})
	local recursive = p.defaultArg(args.recursive, true)
	local root = p.defaultArg(args.root, true)
	local debug = p.defaultArg(args.debug, false)
	local msg = ""
	local wikitext = ""
	
	local category_template_slot = nil
	if (mode == p.mode.footer) then category_template_slot = p.slots.footer_template end
	if (mode == p.mode.header) then category_template_slot = p.slots.header_template end
	
	if (categories == nil) then categories = p.getCategories({jsonschema=jsonschema, includeNamespace=true, includeSchemas=true}).categories end
	if (type(categories) ~= 'table') then categories = {categories} end
	if (debug) then msg = msg .. "Supercategories: " .. mw.dumpObject(categories) .. "\n<br>" end
	for k, category in pairs(categories) do
		if (not p.tableContains(visited, category)) then
			--mw.logObject("Visit " .. category)
			if (debug) then msg = msg .. "Fetch slot " .. p.slots.jsonschema .. " from page " .. category .. "\n<br>" end
			local super_jsonschema = nil
			if p.splitString(category, ':')[1] == "JsonSchema" then super_jsonschema = p.loadJson({title=category, slot=p.slots.main}).json
			else super_jsonschema = p.loadJson({title=category, slot=p.slots.jsonschema}).json end
			if (super_jsonschema ~= nil) then
				if (recursive) then	
					local res = p.walkJsonSchema({jsonschema=super_jsonschema, jsonschemas=jsonschemas, templates=templates, mode=mode, visited=visited, root=false})
					wikitext = wikitext .. res.wikitext 
				end
				--table.insert(jsonschemas, mw.text.jsonDecode( super_jsonschema_str )) --keep a copy of the schema, super_jsonschema passed by references gets modified
				--table.insert(jsonschemas, super_jsonschema ) 
				--mw.logObject("Store " .. category)
				table.insert(visited, category)
				
				jsonschemas[category] = p.copy( super_jsonschema ) --keep a copy of the schema, super_jsonschema passed by references gets modified
				--jsonschema = p.tableMerge(jsonschema, super_jsonschema) --merge superschema is done by the caller
			end
			
			if (debug) then msg = msg .. "Fetch slot " .. category_template_slot .. " from page " .. category .. "\n<br>" end
			templates[category] = mw.slots.slotContent( category_template_slot , category )
		end
	end	
	if (root and p.tableLength(jsonschema) > 0) then
		table.insert(visited, "_") -- dummy category for own schema 
		jsonschemas["_"] = p.copy(jsonschema)
		templates["_"] = template
	end
	
	-- Process propertyOrder based on nesting level
	if (root) then
		local visited_properties = {}
		
		-- Iterate through visited schemas and adjust propertyOrder
		for i, category in ipairs(visited) do
			local schema = jsonschemas[category]
			-- Calculate level: last visited (most specific) has level=1, first (base) has highest level
			local level = #visited - i + 1
			
			if schema and schema.properties then
				for property, prop_data in pairs(schema.properties) do
					-- Set default propertyOrder if not set and property not visited before
					if not prop_data.propertyOrder and not visited_properties[property] then
						prop_data.propertyOrder = 1000
					end
					
					if prop_data.propertyOrder then
						local order = prop_data.propertyOrder
						
						if order < 0 then
							-- Absolute value - keep as is (currently not ranked correctly)
							prop_data.propertyOrder = order
						elseif order <= 1000 then
							-- Insert on top, rank higher levels before lower levels
							-- Default value is 1000, so we shift -2*1000 per level
							prop_data.propertyOrder = (1000 * 1000 - level * 2000) + order
						else -- order > 1000
							-- Insert at bottom, rank higher levels after lower levels
							-- Default value is 1000, so we shift +2*1000 per level
							prop_data.propertyOrder = (1000 * 1000 + level * 2000) + order
						end
					end
					
					-- Mark property as visited
					visited_properties[property] = true
				end
			end
		end
		
		-- Merge all schemas after adjusting propertyOrder
		for i, category in ipairs(visited) do
			--merge all schemas. we need to make a copy here, otherwise jsonschemas["Category:Entity"] contains the merged schema
			jsonschema = p.copy(p.tableMerge(jsonschema, jsonschemas[category])) 
		end	
	end
	if (debug) then wikitext = msg .. wikitext  end
	return {jsonschema=jsonschema, jsonschemas=jsonschemas, templates=templates, visited=visited, wikitext=wikitext}
end

--[[ test: 
category = "Category:Hardware"
page = "Item:OSW7d7193567ea14e4e89b74de88983b718"
category2 = "Category:OSW80e240a2e17d4ae5adfe6419051aa0bb"
page2 = "Item:OSWa4da6664aeac466a86b09e6b32a1cb41"
mw.logObject(p.expandEmbeddedTemplates({
	jsonschema=p.walkJsonSchema({jsonschema=p.loadJson({title=category, slot="jsonschema"}).json, debug=true}).jsonschema, 
	jsondata=p.loadJson({title=page, slot="jsondata"}).json,
	debug=true, mode="render"
}).res)
--]]
function p.expandEmbeddedTemplates(args)
	local frame = p.defaultArg(args.frame, mw.getCurrentFrame())
	local jsondata = p.defaultArg(args.jsondata, {})
	local jsonschema = p.defaultArg(args.jsonschema, {})
	local template = p.defaultArg(args.template, nil)
	local mode = p.defaultArg(args.mode, nil)
	local stringify_arrays = p.defaultArg(args.stringify_arrays, false)
	local msg = ""
	local res = p.defaultArg(args.jsondata, "")
	local root = p.defaultArg(args.root, true) -- first entry into recursion
	local debug = p.defaultArg(args.debug, false)
	
	for k,v in pairs(jsondata) do
		local eval_template = nil
		local eval_templates = p.defaultArgPath(jsonschema, {"properties", k, p.keys.template}, {})
		if (eval_templates[1] == nil) then eval_templates = {eval_templates} end --ensure list of objects
		for i, t in pairs(eval_templates) do
			if (t[p.keys.mode] ~= nil and t[p.keys.mode] == mode) then eval_template = t --use only render templates in render mode and store templates in store mode
			elseif (t[p.keys.mode] == nil) then  eval_template = t --default
			elseif (debug) then msg = msg .. "Ignore eval_template" .. mw.dumpObject( t ) .. "\n<br>"
			end
		end

		if (eval_template ~= nil and eval_template.value ~= nil and (eval_template.type == "mustache" or eval_template.type == "mustache-wikitext")) then
			-- mustache can handle objects and array to we can parse it directly
			-- todo: handle nested templates
			local template_param = {[k]=v}
			if (eval_template.root_key == false) then template_param = v end
			if (debug) then msg = msg .. "Parse mustache template " .. eval_template.value .. " with params " .. mw.dumpObject( template_param ) .. "\n<br>" end
			jsondata[k] = lustache:render(eval_template.value, template_param, p.tableMerge({self=eval_template.value}, eval_template.partials)) -- render with self as registered partial for recursion
			if (eval_template.type == "mustache-wikitext") then 
				jsondata[k] = frame:preprocess( jsondata[k] )
			end
		elseif type(v) == 'table' then 
			if (p.tableLength(v) > 0 and v[1] == nil) then --key value array = object/dict
				local sub_res = p.expandEmbeddedTemplates({frame=frame, jsondata=v, jsonschema=p.defaultArgPath(jsonschema, {"properties", k}, {}), template=eval_template, mode=mode, stringify_arrays=stringify_arrays, root=false, debug=debug})
				msg = msg .. sub_res.debug_msg
				jsondata[k] = sub_res.res
				--if (sub_res.unparsed ~= nil) then jsondata[k] = sub_res.unparsed else jsondata[k] = sub_res.wikitext end
			else --list array
				local string_list = ""
				for i,e in pairs(v) do 
					
					local eval_template = nil
					local eval_templates = p.defaultArgPath(jsonschema, {"properties", k, "items", p.keys.template}, {})
					if (eval_templates[1] == nil) then eval_templates = {eval_templates} end --ensure list of objects
					
					for i, t in pairs(eval_templates) do
						if (t[p.keys.mode] ~= nil and t[p.keys.mode] == mode) then eval_template = t --use only render templates in render mode and store templates in store mode
						elseif (t[p.keys.mode] == nil) then  eval_template = t --default
						elseif (debug) then msg = msg .. "Ignore eval_template" .. mw.dumpObject( t ) .. "\n<br>"
						end
					end

					if type(e) == 'table' then 	
						local sub_res = p.expandEmbeddedTemplates({frame=frame, jsondata=e, jsonschema=p.defaultArgPath(jsonschema, {"properties", k, "items"}, {}), template=eval_template, mode=mode, stringify_arrays=stringify_arrays, root=false, debug=debug})
						msg = msg .. sub_res.debug_msg
						if (type(sub_res.res) == 'table') then 
							if (debug) then msg = msg .. "Values for " .. k .. " contains non-literal items: " .. mw.dumpObject( sub_res.res ) .. " => skip value in wikitemplate array param creation\n<br>" end
						else 
							if (stringify_arrays) then string_list = string_list .. sub_res.res .. ";" 
							else v[i] = sub_res.res end
						end
					else
						if (eval_template ~= nil and eval_template.value ~= nil) then
							
							--evaluate single array item string as json {"self": "<value>", ".": "<value>"} => does not work since jsondata is an object
							--e = p.expandEmbeddedTemplates({frame=frame, jsondata={["self"]=e,["."]=e}, jsonschema=p.defaultArgPath(jsonschema, {"properties", k, "items"}, {}), template=eval_template, mode=mode, stringify_arrays=stringify_arrays, root=false, debug=debug})
							

							if (eval_template.type == "mustache" or eval_template.type == "mustache-wikitext") then
								if (debug) then msg = msg .. "Parse mustache template " .. eval_template.value .. " with params " .. mw.dumpObject( e ) .. "\n<br>" end
								-- {{.}} in the template will be the value of e
								e = lustache:render(eval_template.value, e, p.tableMerge({self=eval_template.value}, eval_template.partials)) -- render with self as registered partial for recursion
							end
							if (eval_template.type == "mustache-wikitext") then --or eval_template.type == "wikitext") then 
								if (debug) then msg = msg .. "Parse wikitext template " .. e .. " with params " .. mw.dumpObject( e ) .. "\n<br>" end
								e = frame:preprocess( e )
							end
							v[i] = e -- update array
						end
						if (stringify_arrays) then string_list = string_list .. e .. ";" end
					end
				end
				if (stringify_arrays) then jsondata[k] = string_list end
			end
		end
	end	
	
	
	if (template == nil and root == false) then -- don't stringify root json objects
		local templates = jsondata[p.keys.template]
		if (templates == nil) then templates = p.defaultArg(jsonschema[p.keys.template], {}) end
		if (templates[1] == nil) then templates = {templates} end --ensure list of objects
		for i, t in pairs(templates) do
			if (t[p.keys.mode] ~= nil and t[p.keys.mode] == mode) then template = t --use only render templates in render mode and store templates in store mode
			elseif (t[p.keys.mode] == nil) then  template = t --default
			elseif (debug) then msg = msg .. "Ignore template" .. mw.dumpObject( t ) .. "\n<br>"
			end
		end
	end
	
	if (template ~= nil and root == false) then -- don't stringify root json objects
		if (template.type == "wikitext") then
			for k,v in pairs(jsondata) do
				if type(v) == 'table' then 
					if (debug) then msg = msg .. "Values for " .. k .. " contains non-literals: " .. mw.dumpObject( v ) .. " => skip wikitemplate parsing\n<br>" end
					return {res=res, debug_msg=msg} 
				end --not supported
			end			
			if (template.value ~= nil) then
				if (debug) then msg = msg .. "Parse wikitemplate " .. template.value .. " with params " .. mw.dumpObject( jsondata ) .. "\n<br>" end
				local child = frame:newChild{args=jsondata}
				res = child:preprocess( template.value )
			elseif (template.page ~= nil) then
				if (debug) then msg = msg .. "Parse wikitemplate " .. template.page .. " with params " .. mw.dumpObject( jsondata ) .. "\n<br>" end
				res = frame:expandTemplate{ title = template.page, args = jsondata }
			end
			
		end
	end
	
	--if (debug) then mw.logObject(msg) end
	return {res=res, debug_msg=msg}
end

-- mw.logObject(p.processJsondata({jsondata=p.loadJson({title="Item:OSW7d7193567ea14e4e89b74de88983b718", slot="jsondata"}).json, debug=true, mode="header"}))
-- mw.logObject(p.processJsondata({jsondata=p.loadJson({title="Item:OSWa4da6664aeac466a86b09e6b32a1cb41", slot="jsondata"}).json, debug=true, mode="header"}))
-- The eval_template #switch renders a multilang field (label, description, ...)
-- to the current user language and yields an empty string when that language is
-- missing. This falls back to the en (or first available) text from the original
-- multilang array (source = [{text, lang}, ...]) so the tree, infobox, subtitle
-- and template still show a value. Patches jsondata[key] in place when the
-- rendered value is empty and returns the chosen fallback text (or nil).
function p.applyMultilangFallback(jsondata, source, key)
	local fallback = nil
	if type(source) == 'table' then
		for _, e in ipairs(source) do
			if type(e) == 'table' and e["text"] ~= nil then
				if e["lang"] == "en" then fallback = e["text"]; break end
				if fallback == nil then fallback = e["text"] end
			end
		end
	end
	local rendered = jsondata[key]
	if (rendered == nil or (type(rendered) == "string" and rendered:match("^%s*$"))) and fallback ~= nil then
		jsondata[key] = fallback
	end
	return fallback
end

-- mw.logObject(p.processJsondata({jsondata=p.loadJson({title="Category:OSWb3022bbf7e7146eb8e6f6e3264f50bbe", slot="jsondata"}).json, debug=true, mode="header", categories={"Category:Category"}}))
function p.processJsondata(args)
	local frame = p.defaultArg(args.frame, mw.getCurrentFrame())
	local jsondata = p.defaultArg(args.jsondata, {})
	local jsonschema = p.defaultArg(args.jsonschema, {})
	local template = p.defaultArg(args.template, nil)
	local categories = p.defaultArg(args.categories, nil)
	local recursive = p.defaultArg(args.recursive, true)
	local mode = p.defaultArg(args.mode, p.mode.header)
	local debug = p.defaultArg(args.debug, false)
	local title = mw.title.getCurrentTitle()
	
	local wikitext = ""
	local msg = "" --debug msg

	if (p.nilOrEmpty(jsondata) or (p.nilOrEmpty(categories) and p.nilOrEmpty(jsonschema) and p.nilOrEmpty(jsondata[p.keys.category]))) then return {wikitext=wikitext, debug_msg=msg} end --nothing to do here
	--if (jsondata == nil or p.tableLength(jsondata) == 0 or (categories == nil and jsonschema == nil and jsondata[p.keys.category] == nil)) then return {wikitext=wikitext, debug_msg=msg} end --nothing to do here
	--jsonschema = p.defaultArg(jsonschema, {})
	--jsondata = p.defaultArg(jsondata, {})
	--if (categories == nil) then categories = jsondata[p.keys.category] end -- let function param overwrite json property
	if (not p.nilOrEmpty(jsondata[p.keys.category])) then categories = jsondata[p.keys.category] end -- let json property overwrite function param
	
	local schema_res = p.walkJsonSchema({jsonschema=jsonschema, categories=categories, mode=mode, recursive=recursive, debug=debug})
	local expand_res = p.expandJsonRef({json=schema_res.jsonschema, debug=debug})
	jsonschema = expand_res.json
	--mw.log(mw.text.jsonEncode(jsonschema))


	local jsonld = p.copy(jsondata)
	local json_data_store = p.copy(jsondata)
	local json_data_render = p.copy(jsondata)
	json_res_store = p.expandEmbeddedTemplates({jsonschema=jsonschema, jsondata=json_data_store, mode='store', debug=debug})
	msg = msg .. json_res_store.debug_msg
	--mw.log("JSONDATA STORE")
	--mw.logObject(json_res_store.res)
	
	local smw_res = nil
	if (mode == p.mode.header) then

		-- get the semantic properties by looking up the json keys in the json-ld context
		smw_res = p.getSemanticProperties({jsonschema=jsonschema, jsondata=json_res_store.res, store=false, debug=debug})
		
		-- store metadata where properties were defined / overridden
		for i, category in ipairs(schema_res.visited) do 
			for k, v in pairs(p.defaultArgPath(schema_res.jsonschemas, {category, 'properties'}, {})) do --property section may not exisit
				if smw_res.definitions[k] == nil then smw_res.definitions[k] = {} end
				if smw_res.definitions[k]['defined_in'] == nil then smw_res.definitions[k]['defined_in'] = {} end
				table.insert(smw_res.definitions[k]['defined_in'], category)
			end
		end
		
		-- embed json-ld in resulting html for search engine discovery
		jsonld["@context"] = smw_res.context
		jsonld["@type"] = p.tableMerge(p.tablefy(jsonschema.schema_type), p.tablefy(jsonld["@type"])) --
		jsonld['schema:name'] = p.defaultArgPath(jsonld, {p.keys.label, 1, p.keys.text}, jsonld['name']) --google does not support @value and @lang
		jsonld['schema:description'] = p.defaultArgPath(jsonld, {p.keys.description, 1, p.keys.text}, nil)
		for k, v in pairs(jsonld) do
			if (type(v) == "string") then
				local vpart = p.splitString(v, ':')
				if (p.tableLength(vpart) == 2 and vpart[1] == "File") then jsonld[k] = mw.getCurrentFrame():callParserFunction( 'filepath', { vpart[2] } ) end --google does not follow redirects via "File":"wiki:Special:Redirect/file/"
			end
		end
		wikitext = wikitext .. "<div class='jsonld-header' style='display:none' data-jsonld='" .. mw.text.jsonEncode( jsonld ):gsub("'","`") .. "'></div>"
	end
	
	local json_res = p.expandEmbeddedTemplates({jsonschema=jsonschema, jsondata=json_data_render, mode='render', debug=debug})
	msg = msg .. json_res.debug_msg
	jsondata =json_res.res
	--mw.log("JSONDATA RENDER")
	--mw.logObject(jsondata)
	
	-- label / description language fallback: substitute the en (or first available)
	-- text when the eval_template #switch rendered empty for the user language.
	-- _label_fallback / _description_display are reused below for the scalar template args.
	local _label_fallback = p.applyMultilangFallback(jsondata, jsonld[p.keys.label], p.keys.label)
	local _description_fallback = p.applyMultilangFallback(jsondata, jsonld[p.keys.description], p.keys.description)
	-- The description render eval_template has no #switch #default (and may be
	-- dropped in generated schemas), so the rendered header value can be empty or
	-- still be the raw multilang array. Resolve it directly from the original data
	-- for the subtitle: user language, then en, then first available.
	local _description_display = p.renderMultilangValue({jsondata=jsonld, key=p.keys.description})
	if (_description_display == nil or _description_display == "") then _description_display = _description_fallback end

	local renderMode = "tree"
	if jsondata.__render_mode__ == "tree" then renderMode = "tree" end
	if jsondata.__render_mode__ == "table" then renderMode = "table" end

	local max_index = p.tableLength(schema_res.visited)
	for i, category in ipairs(schema_res.visited) do
		if (mode == p.mode.footer) then category = schema_res.visited[max_index - i +1] end --reverse order for footer templates
		local super_jsonschema = schema_res.jsonschemas[category]
		local template = schema_res.templates[category]
		local _details = nil
		if (mode == p.mode.header and renderMode == "tree" and i == 1) then -- insert tree after root infobox
			local tree_view_wikitext = p.renderJson({jsonschema=jsonschema, context=smw_res.context, property_definitions=smw_res.definitions, jsondata=jsondata})
			tree_view_wikitext = frame:preprocess(tree_view_wikitext)
			--tree_view = frame:callParserFunction( '#tree', { "", id="jsondata-tree", class="info-tree", minExpandLevel=2, quicksearch=true, tree_view_wikitext } ) -- doesn't render, so we add a div wrapper below
			tree_view = frame:callParserFunction( '#tree', { tree_view_wikitext } )
			--tree_view = frame:preprocess("{{#tree | " .. tree_view_wikitext .. " }}")
			if (debug) then
				mw.logObject("TREE")
				mw.logObject(tree_view_wikitext)
				mw.logObject(tree_view)
			end
			_details = '<div id="jsondata-tree" class="info-tree" >' .. tree_view .. '</div>'
		end
		local template_has_infobox = (template ~= nil and string.find(template, 'class="info_box"') ~= nil and string.find(template, '@renderInfoBox') == nil)
		-- render auto-generated infobox when template has no full infobox table, no template exists, or template opts in via @renderInfoBox marker
		if (not template_has_infobox and mode == p.mode.header and renderMode ~= "tree") then
			local ignore_properties = {[p.keys.category]=true} -- don't render type/category on every subclass
			for j, subcategory in ipairs(schema_res.visited) do
				if j > i then
					local subjsonschema = schema_res.jsonschemas[subcategory]
					for k, v in pairs(p.defaultArg(subjsonschema['properties'], {})) do
						-- skip properties that are overwritten in subschemas, render them only once at the most specific position
						ignore_properties[k] = true
					end
				end
			end
			-- render the infobox for the schema itself and every super_schema using always the global json-ld context (merged within walkJsonSchema())
			-- context needs to be preprocessed with buildContext() since the generic json/table merge of the @context atttribute produces a list of strings (remote context) and context objects
			-- context is already build in p.getSemanticProperties. schema_allOfMerged is used to provide the full schema for overridden properties
			local infobox_res = p.renderInfoBox({jsonschema=super_jsonschema, schema_allOfMerged=jsonschema, context=smw_res.context, property_definitions=smw_res.definitions, jsondata=jsondata, ignore_properties=ignore_properties})
			wikitext = wikitext .. frame:preprocess( infobox_res.wikitext )
		end
		-- render custom template (backward compatible for templates with infobox, or remaining non-table content like #set: calls)
		if (template ~= nil) then
			if (debug) then msg = msg .. "Parse \n\n" .. template .. " \n\nwith params " .. mw.dumpObject( jsondata ) .. "\n<br>" end
			local stripped_jsondata={}
			for k, v in pairs(jsondata) do
				if (type(v) ~= 'table') then stripped_jsondata[k] = v end --delete object values, not supported by wiki templates
			end
			local _lbl = stripped_jsondata[p.keys.label]
			if (_lbl == nil or (type(_lbl) == "string" and _lbl:match("^%s*$"))) and _label_fallback ~= nil then
				stripped_jsondata[p.keys.label] = _label_fallback
			end
			if (_description_display ~= nil and _description_display ~= "") then
				stripped_jsondata[p.keys.description] = _description_display
			end
			stripped_jsondata["_details"] = _details
			local child = frame:newChild{args=stripped_jsondata}
			if ( template:sub(1, #"=") == "=" ) then template = "\n" .. template end -- add line break if template starts with heading (otherwise not rendered by mw parser)
			wikitext = wikitext .. child:preprocess( template )
		end
	end
	
	local set_categories_in_wikitext = {}
	p.tableMerge(set_categories_in_wikitext, json_res_store.res[p.keys.subcategory])  --classes/categories, nil for items
	if (title.nsText ~= "Category") then --items
		p.tableMerge(set_categories_in_wikitext, json_res_store.res[p.keys.category]) -- categories from schema type
	end
	
	-- Todo: Consider moving the category and this block to p.getSemanticProperties with store=true. However, settings categories with @category is only possible for subobjects
	if (smw_res ~= nil) then
		local display_label = p.getDisplayLabel(json_res_store.res, smw_res.properties)
		if title.nsText == "Property" then display_label = p.defaultArgPath(json_res_store.res, {p.keys.name}, display_label) end

		if (debug) then msg = msg .. "Store page properties" end
		-- category handling
		p.tableMerge(set_categories_in_wikitext, smw_res.properties[p.keys.category_pseudoproperty]) 
		smw_res.properties[p.keys.category_pseudoproperty] = nil -- delete pseudo property
		
		smw_res.properties['HasOswId'] = mw.title.getCurrentTitle().fullText  --set special property OswId to own title
		
		-- label and display title handling
		if display_label ~= nil then 
			smw_res.properties['Display title of'] = display_label --set special property display title
			smw_res.properties['Display title of lowercase'] = display_label:lower() --store lowercase for case insensitive query
			smw_res.properties['Display title of normalized'] = display_label:lower():gsub('[^%w]+','') --store with all non-alphanumeric chars removed for normalized query
		end
		p.setNormalizedLabel(smw_res.properties) --build normalized multilang label
		mw.ext.displaytitle.set(display_label)
		--smw_res.properties['@category'] = jsondata[p.keys.category]
		local store_res = mw.smw.set( smw_res.properties ) --store as semantic properties
		if (debug) then msg = msg .. mw.dumpObject(smw_res.properties) end
		if (store_res) then 
			if (debug) then msg = msg .. "SMW SUCCESS: " end
		else
			wikitext = wikitext .. store_res.error 
			if (debug) then msg = msg .. "SMW ERROR: " .. store_res.error end
		end
		--wikitext = mw.dumpObject(smw_res.properties) .. wikitext
	end
	-- category links render invisibly; appending them without a newline avoids a
	-- stray empty paragraph (<p><br/></p>) at the end of the header slot output
	wikitext = wikitext .. p.setCategories({categories=set_categories_in_wikitext, sortkey=display_label}).wikitext
	
	if (debug) then mw.logObject(res) end
	return {wikitext=wikitext, debug_msg=msg}
end


-- renders a default infobox
-- test: mw.logObject(p.renderInfoBox({jsonschema=p.loadJson({title="JsonSchema:Entity"}).json, jsondata={uuid="123123"}}))
function p.renderInfoBox(args)
	local debug = p.defaultArg(args.debug, false)
	local jsondata = p.defaultArg(args.jsondata, {})
	local schema = p.defaultArg(args.jsonschema, nil) -- local schema from the perspective of the current category
	local schema_allOfMerged = p.defaultArg(args.schema_allOfMerged, schema) -- global schema with allOfs merged
	local property_definitions = p.defaultArg(args.property_definitions, {}) -- dict schema_key: {property: <smw_property>, ...}
	local res = ""
	if schema == nil then return res end
	
	local context = p.defaultArg(args.context, p.buildContext({jsonschema=schema}).context)
	local ignore_properties = p.defaultArg(args.ignore_properties, {})

	local schema_label = p.renderMultilangValue({jsonschema=schema})
	
	-- see also: https://help.fandom.com/wiki/Extension:Scribunto/HTML_Library_usage_notes
	local tbl = mw.html.create( 'table' )
	tbl
		:attr( 'class', 'info_box' )
		:tag( 'tr' )
			:tag( 'th' )
				:attr( 'class', 'heading' )
				:attr( 'colspan', '2' )
				:wikitext( schema_label )
	for k,v in pairs(jsondata) do
		if (not ignore_properties[k]) then
			if (schema['properties'] ~= nil and schema['properties'][k] ~= nil and (type(v) ~= 'table' or v[1] ~= nil)) then --literal or literal array
				local def = schema_allOfMerged['properties'][k]
				-- skip hidden properties
				local hidden = p.defaultArgPath(def, {'options', 'hidden'}, false)
				if (hidden ~= true and hidden ~= "true") then
				--mw.logObject(def)

				local label = p.renderMultilangValue({jsonschema=def, default=k})
				
				local description = p.renderMultilangValue({jsonschema=def, key="description"})
				if (p.tableLength(p.defaultArgPath(property_definitions, {k, 'defined_in'}, {})) > 0) then description = description .. "<br>Definition: " end
				for i, c in pairs(p.defaultArgPath(property_definitions, {k, 'defined_in'}, {})) do 
					if (i > 1) then description = description .. ", " end
					description = description .. "[[:" ..c .. "]]"
				end
				if (description ~= "") then description = "{{#info: " .. description .. "|note }}" end -- smw tooltip
				label = label .. description

				--res = res .. title ": " .. v
				local cell = tbl:tag( 'tr' )
									:tag( 'th' )
										:wikitext( label )
										:done()
									:tag( 'td' )
				if (type(v) == 'table') then
					for i,e in pairs(v) do 
						if (type(e) ~= 'table') then 
							local p_type = p.getPropertyType({context=context, key=k, schema=def})
							if (p_type == '@id' and p.defaultArgPath(def, {'items', 'type'}, 'unknown') == 'string' and def['eval_template'] == nil) then
								-- auto-link (OSW-)IDs if no eval_template is present
								e = string.gsub(e, "Category:", ":Category:") -- make sure category links work
								e = string.gsub(e, "File:", ":File:") -- do not embedd images but link to them
								e = "[[" .. e .. "]]"
							elseif (p_type == 'xsd:date' or p_type == 'xsd:dateTime') then -- format date/time with user preferences
								e = p.formatDate(e, p_type, p.defaultArgPath(property_definitions, {k, 'property'}))
							elseif (type(v) == 'boolean') then
								if (v) then v = "&#x2705;" else v = "&#x274C;" end -- green check mark or red cross
							elseif (def['eval_template'] == nil and (string.len(e) > 100) and (string.find(e, "{{") == nil) and (string.find(e, "</") == nil) and (string.find(e, "%[%[") == nil)) then -- no markup, no links
								e = string.sub(e, 1, 100) .. "..."; -- limit infobox plain text to max 100 chars
							elseif (debug) then
								mw.log("Unformated: " .. k .. " " .. p.defaultArgPath(def, {'items', 'type'}, 'unknown'))
								mw.logObject(def)
							end
							cell:wikitext("\n* " .. e .. "") 
						end
					end
				else
					local p_type = p.getPropertyType({context=context, key=k, schema=def})
					if (p_type == '@id' and p.defaultArgPath(def, {'type'}, 'unknown') == 'string' and def['eval_template'] == nil) then
						-- auto-link (OSW-)IDs if no eval_template is present
						v = string.gsub(v, "Category:", ":Category:") -- make sure category links work
						v = string.gsub(v, "File:", ":File:") -- do not embedd images but link to them
						v = "[[" .. v .. "]]"
					elseif (p_type == 'xsd:date' or p_type == 'xsd:dateTime') then -- format date/time with user preferences
						v = p.formatDate(v, p_type, p.defaultArgPath(property_definitions, {k, 'property'}))
					elseif (type(v) == 'boolean') then
						if (v) then v = "&#x2705;" else v = "&#x274C;" end -- green check mark or red cross
					elseif (def['eval_template'] == nil and (string.len(v) > 100) and (string.find(v, "{{") == nil) and (string.find(v, "</") == nil) and (string.find(v, "%[%[") == nil)) then -- no markup, no links
						v = string.sub(v, 1, 100) .. "..."; -- limit infobox plain text to max 100 chars
					elseif (debug) then
						mw.log("Unformated: " .. k .. " " .. p.defaultArgPath(def, {'type'}, 'unknown'))
						mw.logObject(def)
					end
					cell:wikitext("\n" .. v .. "")
				end
			end -- hidden check
			end
		end
	end
	res = res .. tostring( tbl )
	--mw.logObject(res)
	
	return {wikitext=res}
end

function p.renderArrayItemSummary(args)
	local frame = mw.getCurrentFrame()
	local item = p.defaultArg(args.item, {})
	local index = p.defaultArg(args.index, 0)
	local schema = p.defaultArg(args.schema, nil)

	-- Try to get a display label: use label if it's a plain string (already language-processed), else fallback to name
	local display = ""
	if item.label and type(item.label) == "string" then
		display = item.label
	end
	if display == "" and item.name then
		display = tostring(item.name)
	end

	-- Try to get type info: characteristic > type (both may be links if namespace-prefixed)
	local typeInfo = ""
	if item.characteristic and type(item.characteristic) == "string" then
		typeInfo = p.wrapLinkIfNs(item.characteristic)
	elseif item.type and type(item.type) == "string" then
		typeInfo = p.wrapLinkIfNs(item.type)
	end

	if typeInfo ~= "" then
		return display .. " (" .. typeInfo .. ")"
	else
		return display
	end
end

-- Resolve the effective JSON-LD @type of a property, working for any property
-- (scalar or array). Falls back from the JSON-LD context @type to the
-- json-schema format/type, so e.g. date / date-time typed properties are
-- detected even when no context mapping is present. Returns a JSON-LD type
-- string such as '@id', 'xsd:date', 'xsd:dateTime' or '@value'.
function p.getPropertyType(args)
	local context = p.defaultArg(args.context, nil)
	local key = p.defaultArg(args.key, nil)
	local schema = p.defaultArg(args.schema, nil) -- property definition (scalar or array)
	-- 1) the JSON-LD context @type is most specific and wins whenever it is set
	if (context ~= nil and key ~= nil) then
		local p_type = p.defaultArgPath(context, {key, '@type'}, nil)
		if (p_type ~= nil) then return p_type end
	end
	-- 2) fall back to the json-schema format/type. For arrays the date type/format
	--    lives on the items schema (the array node only carries the structural
	--    type 'array'), so read items first and fall back to the schema level -
	--    which also covers scalars (no items) and a format/type set on the array
	--    node itself.
	if (type(schema) == 'table') then
		local node = schema
		if (schema.type == 'array' and type(schema.items) == 'table') then node = schema.items end
		local fmt = node.format or schema.format
		local t = node.type or schema.type
		if (fmt == 'date' or t == 'date') then return 'xsd:date' end
		if (fmt == 'date-time' or t == 'date-time') then return 'xsd:dateTime' end
	end
	return '@value'
end

-- Format a date / date-time value with the user's date preferences.
-- smw_property (optional) lets a dateTime render via SMW in the viewer's locale.
function p.formatDate(value, p_type, smw_property)
	if (p_type == 'xsd:date') then
		return "{{#dateformat:" .. value .. "|ymd}}"
	elseif (p_type == 'xsd:dateTime') then
		if (smw_property ~= nil) then
			return "{{#ask: [[{{FULLPAGENAME}}]]|?" .. smw_property .. "#LOCL#TO= |format=plain |mainlabel=-}}"
		else
			local _, _, date, hours, minutes = string.find(value, "(%S+)[T ](%S+)[:](%S+)[:?]")
			-- value without a parsable time part (e.g. a date-only or non-ISO value
			-- typed as date-time): just format the date, no timezone hint
			if (date == nil) then return "{{#dateformat:" .. value .. "|ymd}}" end
			-- no semantic property -> cannot convert to the viewer's timezone, show UTC
			-- and hint how to enable per-user conversion (SMW #LOCL#TO via a property)
			return "{{#dateformat:" .. date .. "|ymd}} " .. hours .. ":" .. minutes
				.. " (UTC){{#info: Specify a semantic property in the schema for time zone conversion |note }}"
		end
	end
	return value
end

function p.renderLiteral(args)
	local frame = mw.getCurrentFrame()
	local debug = p.defaultArg(args.debug, false)
	local key = p.defaultArg(args.key, nil)
	local value = p.defaultArg(args.value, nil)
	local schema = p.defaultArg(args.schema, nil) -- local property schema
	local property_definitions = p.defaultArg(args.property_definitions, {}) -- {property: <smw_property>, ...}
    local level = p.defaultArg(args.level, 0)
    local result = ""
    
    -- Create the indentation prefix for the main level
    local prefix = string.rep("*", level + 1)
    
    -- Get the label/title from schema
    local label = p.renderMultilangValue({jsonschema=schema, default=key})
    
    -- format label bold
    label = "'''" .. label .. "'''"
    
    -- display further information in tooltip
	local description = p.renderMultilangValue({jsonschema=schema, key="description"})
	if (p.tableLength(p.defaultArgPath(property_definitions, {key, 'defined_in'}, {})) > 0) then description = description .. "<br>Definition: " end
	for i, c in pairs(p.defaultArgPath(property_definitions, {key, 'defined_in'}, {})) do 
		if (i > 1) then description = description .. ", " end
		description = description .. "[[:" ..c .. "]]"
	end
	if (description ~= "") then description = "{{#info: " .. description .. "|note }}" end -- smw tooltip
	label = label .. description
	--label = frame:preprocess(label) -- we need to evaluate the wikitext before we pass it to the tree tag
    
    -- Helper function to check if value is an array
    local function isArray(v)
        return type(v) == "table" and v[1] ~= nil
    end
    
    -- Resolve the effective type once (works for scalar and array properties),
    -- so date / date-time values reuse the same formatter as the infobox.
    local p_type = p.getPropertyType({schema=schema})
    local smw_property = p.defaultArgPath(property_definitions, {key, 'property'})

    -- Helper function to convert value to string
    local function valueToString(v)
        if type(v) == "boolean" then
            return tostring(v)
        elseif type(v) == "nil" then
            return "nil"
        elseif type(v) == "string" then
        	if (p_type == 'xsd:date' or p_type == 'xsd:dateTime') then return p.formatDate(v, p_type, smw_property) end
        	return p.wrapLinkIfNs(v)
        else
            return tostring(v)
        end
    end

    -- Check if a single value is a semicolon-separated list of NS:Title entries
    local expandedValue = nil
    if not isArray(value) and type(value) == "string" and value:find(';') then
        -- Only split if entries match <Namespace>:<Title> pattern
        local parts = p.splitString(value, ';')
        local allNs = true
        local cleaned = {}
        for _, part in ipairs(parts) do
            part = mw.text.trim(part)
            if part ~= '' then
                if not part:match('^[%a]+:.+$') then allNs = false; break end
                table.insert(cleaned, part)
            end
        end
        if allNs and #cleaned > 0 then expandedValue = cleaned end
    end

    -- Handle different value types
    if expandedValue then
        -- Semicolon-separated NS:Title entries rendered as array
        value = expandedValue
        if #value == 1 then
            result = prefix .. " " .. label .. ": " .. valueToString(value[1]) .. "\n"
        else
            result = prefix .. " " .. label .. ":\n"
            local nestedPrefix = string.rep("*", level + 2)
            for _, item in ipairs(value) do
                result = result .. nestedPrefix .. " " .. valueToString(item) .. "\n"
            end
        end

    elseif not isArray(value) then
        -- Single literal value
        result = prefix .. " " .. label .. ": " .. valueToString(value) .. "\n"

    elseif #value == 1 then
        -- Array with single element
        result = prefix .. " " .. label .. ": " .. valueToString(value[1]) .. "\n"

    else
        -- Array with multiple elements (length > 1)
        result = prefix .. " " .. label .. ":\n"
        local nestedPrefix = string.rep("*", level + 2)
        if value ~= nil then
	        for _, item in ipairs(value) do
	            result = result .. nestedPrefix .. " " .. valueToString(item) .. "\n"
	        end
	    end
    end
    
    return result
end

function p.renderJson(args)
	local frame = mw.getCurrentFrame()
	local debug = p.defaultArg(args.debug, false)
	local jsondata = p.defaultArg(args.jsondata, {})
	local jsonschema = p.defaultArg(args.jsonschema, nil) -- global schema with allOfs merged
	local property_definitions = p.defaultArg(args.property_definitions, {}) -- dict schema_key: {property: <smw_property>, ...}
	local level = p.defaultArg(args.level, 0)
	local display_empty = p.defaultArg(args.display_empty, false)
    local result = ""

    -- Helper function to check if a table is an array (has numeric indices)
    local function isArray(t)
        if type(t) ~= "table" then
            return false
        end
        return t[1] ~= nil
    end
    
    -- Helper function to check if a value is a literal (not a table)
    local function isLiteral(v)
        return type(v) ~= "table"
    end
    
    -- Try detect and render quantity objects
    local function isQuantityObject(val, def)
        if type(val) ~= 'table' then return false end
        local num = val.numerical_value or val.value or val.amount
        local unit = val.unit
        if num ~= nil and (type(unit) == 'string' or unit == nil) then
            return true
        end
        if type(def) == 'table' and type(def.properties) == 'table' then
            local hasNumDef = def.properties.numerical_value or def.properties.value or def.properties.amount
            local hasUnitDef = def.properties.unit
            if hasNumDef and hasUnitDef then return true end
        end
        return false
    end

    local function renderQuantity(val)
        local num = val and (val.numerical_value or val.value or val.amount)
        local unit = val and val.unit
        if num == nil then return nil end
        local unitTxt = unit and p.wrapLinkIfNs(unit) or ""
        if unitTxt ~= "" then return tostring(num) .. " " .. unitTxt end
        return tostring(num)
    end
    
    -- Helper function to get propertyOrder from schema
    local function getPropertyOrder(key)
        if jsonschema and jsonschema.properties and jsonschema.properties[key] then
            local propSchema = jsonschema.properties[key]
            if propSchema.propertyOrder then
                return propSchema.propertyOrder
            end
        end
        -- Default order for properties without explicit order
        return 1000000 -- High value to place them at the end
    end
    
    -- Collect all keys and sort them by propertyOrder
    local sortedKeys = {}
    for key, _ in pairs(jsondata) do
        table.insert(sortedKeys, key)
    end
    
    table.sort(sortedKeys, function(a, b)
        local oa, ob = getPropertyOrder(a), getPropertyOrder(b)
        -- Primary: schema propertyOrder. Secondary: key name, so properties
        -- sharing the same (or default) propertyOrder render in a stable,
        -- reproducible order instead of the arbitrary pairs() iteration order.
        if oa == ob then return a < b end
        return oa < ob
    end)
    
    -- Iterate over sorted keys
    for _, key in ipairs(sortedKeys) do
        local value = jsondata[key]
        local do_render = true
        -- Look up the property definition in the schema
        local propertySchema = nil
        if jsonschema and jsonschema.properties then
            propertySchema = jsonschema.properties[key]
            if p.defaultArgPath(propertySchema, {"options", "hidden"}, false) == true then
            	do_render = false
            end
        end
        if (not display_empty and (value == nil or (type(value) == "string" and value:match("^%s*$")) or (type(value) == "table" and next(value) == nil))) then
        	do_render = false
        end

        if do_render then
        	
	        if isLiteral(value) then
	            -- Single literal value (string, number, boolean, nil)
	            result = result .. p.renderLiteral({key=key, value=value, schema=propertySchema, property_definitions=property_definitions, level=level, debug=debug})
	            
	        elseif isArray(value) then
	            -- Array - determine if it contains literals or objects
	            if #value == 0 or isLiteral(value[1]) then
	                -- Empty array or array of literals
	                result = result .. p.renderLiteral({key=key, value=value, schema=propertySchema, property_definitions=property_definitions, level=level, debug=debug})
	            else
	                -- Array of objects - render header once, then each item underneath
	                local itemSchema = propertySchema and propertySchema.items
	                -- Single header for the array
	                result = result .. p.renderLiteral({key=key, value="", schema=propertySchema, property_definitions=property_definitions, level=level, debug=debug})
	                for i, item in ipairs(value) do
						if isQuantityObject(item) then
					    	result = result .. p.renderLiteral({key=key, value=renderQuantity(item), schema=itemSchema, property_definitions=property_definitions, level=level + 1, debug=debug})
					    else
	                		-- Build summary line: "{index} - {label|name} [{characteristic|type}]"
	                		local summary = p.renderArrayItemSummary({item=item, index=i, schema=itemSchema})
	                		result = result .. p.renderLiteral({key=tostring(i), value=summary, schema=itemSchema, property_definitions=property_definitions, level=level + 1, debug=debug})
	                    	result = result .. p.renderJson({jsondata=item, jsonschema=itemSchema, level=level + 2, display_empty=display_empty, debug=debug})
	                    end
	                end
	            end
	            
	        else
	            -- Single object - recurse with incremented level
	            if isQuantityObject(value) then
					result = result .. p.renderLiteral({key=key, value=renderQuantity(value), schema=propertySchema, property_definitions=property_definitions, level=level, debug=debug})	
				else
	            	result = result .. p.renderLiteral({key=key, value="", schema=propertySchema, property_definitions=property_definitions, level=level, debug=debug})
	            	result = result .. p.renderJson({jsondata=value, jsonschema=propertySchema, level=level + 1, display_empty=display_empty, debug=debug})
	            end
	        end
	   end
    end
    
    return result
end

-- test
-- mw.logObject(p.getCategories({jsonschema={allOf={["$ref"]="/wiki/Category:Test?action=raw&slot=jsonschema"}}, includeNamespace=true}))
-- mw.logObject(p.getCategories({jsonschema={allOf={{["$ref"]="/wiki/Category:Test?action=raw&slot=jsonschema"}, {["$ref"]="/wiki/Category:Test2?action=raw&slot=jsonschema"}}}}))
function p.getCategories(args)
	local jsonschema = p.defaultArg(args.jsonschema, {})
	local includeNamespace = p.defaultArg(args.includeNamespace, false)
	local includeSchemas = p.defaultArg(args.includeSchemas, false)
	
	local categories = {}
		local allOf = jsonschema[p.keys.allOf]
		if (allOf ~= nil) then
			--properties['@category'] = {}
			for k, entry in pairs(allOf) do
				local refs = nil
				if type(entry) == 'table' then refs = entry -- "allOf": [{"$ref": "/wiki/Category:Test?action=raw"}]
				else refs = {entry} end-- "allOf": {"$ref": "/wiki/Category:Test?action=raw"}
				for p, v in pairs(entry) do
					if (p == '$ref') then
						for category in v:gmatch("Category:([^?]+)") do -- e.g. "/wiki/Category:Test?action=raw"
							if (includeNamespace) then category = "Category:" .. category end
						    table.insert(categories, category)
						end
						if includeSchemas then
							for schema in v:gmatch("JsonSchema:([^?]+)") do -- e.g. "/wiki/JsonSchema:Test?action=raw"
								if (includeNamespace) then schema = "JsonSchema:" .. schema end
							    table.insert(categories, schema)
							end
						end
					end
				end
			end
		end	
		
	return {categories=categories}
end

--sets a list of categories on the page
--test: mw.logObject(p.setCategories({categories={"Cat1", "Category:Cat2"}}))
function p.setCategories(args)
	local categories = p.defaultArg(args.categories, {})
	local sortkey = p.defaultArg(args.sortkey, "")
	if (sortkey ~= "") then sortkey = "|" .. sortkey end
	if (type(categories) ~= 'table') then categories = {categories} end
	local res = ""
	for k, entry in pairs(categories) do
		res = res .. "[[Category:" .. string.gsub(entry, "Category:", "") .. sortkey .."]]"
	end
	return {wikitext=res}
end

--[[ test
category = "Category:Entity"
jsonschema = p.expandJsonRef({json=p.loadJson({title=category, slot="jsonschema"}).json}).json
mw.logObject(p.buildContext({jsonschema=jsonschema, debug=true}))
mw.log(mw.text.jsonEncode(p.buildContext({jsonschema=jsonschema, debug=false}).context))
or
jsonschema = {
	["@context"]={test="level 0"}, 
	properties={
		test={
			type="object",
			["@context"]={test1="level 1"}, 
			properties= {
				test= {
					type="array",
					items= {
						type="object",
						["@context"]={test2="level 2"}
					}
				}
			}
		}
	}
}
mw.logObject(p.buildContext({jsonschema=jsonschema, debug=true}))
--]]

-- constructs a property specific local jsonld context
function p.buildContext(args)
	local schema = p.defaultArg(args.jsonschema, {})
	--mw.logObject(schema)
	local context = p.defaultArg(args.context, schema[p.keys.context])
	local result = p.defaultArg(args.result, {})
	if (context ~= nil) then
		for k,v in pairs(context) do
			if type(k) == 'number' and type(v) == 'string' then
				--table.insert(result, v) --skip context imports
			elseif (type(v) == 'table' and v[1] ~= nil) then --custom addtional mappings, e. g. "type*": ["Property:HasType"]
				result[k] = v
			elseif (type(v) == 'table' and v['@id'] == nil and v['@reverse'] == nil) then --subcontext
				p.tableMerge(result, p.buildContext({context=v}).context)
			else 
				result[k] = v	
			end
		end
	end
	local properties = p.defaultArg(schema.properties, {})

	-- build property context
	for k,v in pairs(properties) do
		local subcontext = nil
		if (p.defaultArgPath(properties, {k, 'type'}) == 'object') then
			--mw.logObject(properties[k])
			subcontext = p.buildContext({jsonschema=properties[k]}).context
		elseif (p.defaultArgPath(properties, {k, 'items', 'type'}) == 'object') then 
			--mw.logObject(properties[k]['items'])
			subcontext = p.buildContext({jsonschema=properties[k]['items']}).context
		end
		if (subcontext ~= nil and p.tableLength(subcontext) > 0) then
			if (result[k] == nil) then result[k] = {} end
			if (type(result[k]) == 'string') then result[k] = {["@id"]=result[k]} end
			if (result[k][p.keys.context] == nil) then result[k][p.keys.context] = {} end
			result[k][p.keys.context] = p.tableMerge(result[k][p.keys.context], subcontext)
		end
	end
	return {context=result}
end

--maps jsondata values to semantic properties by using the @context attribute within the schema
--test: mw.logObject(p.getSemanticProperties({jsonschema={["@context"]={test="Property:schema:TestProperty", myObjectProperty={["@id"]= "Property:MyObjectProperty", ["@type"]= "@id"}}}, jsondata={test="TestValue", myObjectProperty="123"}, debug=true}))
--test: mw.logObject(p.getSemanticProperties({jsonschema={["@context"]={"some uri",{test="Property:TestProperty", myObjectProperty={["@id"]= "Property:MyObjectProperty", ["@type"]= "@id"}}}}, jsondata={test="TestValue", myObjectProperty="123"}, debug=true}))
--[[
mw.logObject(p.getSemanticProperties({jsonschema={["@context"]={test="Property:TestProperty", subobject="Property:HasSubobject", myObjectProperty={["@id"]= "Property:MyObjectProperty", ["@type"]= "@id"}}}, jsondata={
test="TestValue", myObjectProperty="123", subobject={uuid="123-123-123", test="TestValue2"}
}, debug=true}))

mw.logObject(p.getSemanticProperties({jsonschema=p.loadJson({title="Category:OSW80e240a2e17d4ae5adfe6419051aa0bb", slot="jsonschema"}).json, p.loadJson({title="Item:OSWa4da6664aeac466a86b09e6b32a1cb41", slot="jsonsdata"}).json, debug=true}))

category = "Category:Hardware"
page = "Item:OSW7d7193567ea14e4e89b74de88983b718"
category2 = "Category:OSW80e240a2e17d4ae5adfe6419051aa0bb"
page2 = "Item:OSWa4da6664aeac466a86b09e6b32a1cb41"
jsonschema =p.walkJsonSchema({jsonschema=p.loadJson({title=category, slot="jsonschema"}).json, debug=true}).jsonschema
mw.logObject(p.getSemanticProperties({
	jsonschema=jsonschema,
	jsondata=p.expandEmbeddedTemplates({jsonschema=jsonschema, jsondata=p.loadJson({title=page, slot="jsondata"}).json}).res,
	debug=true
}).properties)

--]]
function p.getSemanticProperties(args)
	local jsondata = p.defaultArg(args.jsondata, {})
	local schema = p.defaultArg(args.jsonschema, {})
	local subschema = p.defaultArg(args.subschema, schema)
	local parent_schema_property = p.defaultArg(args.parent_schema_property, {}) -- ToDo: Not used except in getSemanticQuery => remove
	local store = p.defaultArg(args.store, false)
	local root = p.defaultArg(args.root, true)
	local properties = p.defaultArg(args.properties, {}) --semantic properties to store, dict key=property_name, value=array of string values
	local debug = p.defaultArg(args.debug, false)
	local path = p.defaultArg(args.path, nil) -- json path of this node within the root object, e. g. "l1", "characteristics.2"
	--if (debug) then mw.logObject("Call getSemanticProperties with args " .. mw.dumpObject( args ) .. "\n<br>") end

	local subjectId = mw.title.getCurrentTitle().fullText
	local subobjectId = nil
	if (root == false) then
		-- the uuid stays the primary source to keep existing subobject ids stable,
		-- the json path addresses nodes without uuid, e. g. quantity values
		if (jsondata['uuid'] ~= nil) then subobjectId = "OSW" .. string.gsub(jsondata['uuid'], "-", "")
		else subobjectId = path end
		if (subobjectId ~= nil) then subjectId = subjectId .. '#' .. subobjectId end
	end

	-- create smw quantity property within the quantity value subobject
	properties = p.processQuantityValue({properties=properties, value_object=jsondata, schema=subschema, debug=debug}).properties

	local property_data = {}
	local context = p.defaultArg(args.context, p.buildContext({jsonschema=schema}).context)
	local error = ""
	if (debug) then mw.logObject(context) end
	if schema ~= nil and context ~= nil then
		local schema_properties = p.defaultArg(subschema.properties, nil)
		if schema_properties == nil then schema_properties = p.defaultArgPath(subschema,  {"items", "properties"},  {}) end -- array schema
		if (debug and root) then
			for k,v in pairs(context) do
				if type(k) == 'number' then mw.logObject("imports " .. v)
				elseif type(v) == 'table' and v["@id"] ~= nil then mw.logObject("" .. k .. " maps to " .. v["@id"]) 
				else mw.logObject("" .. k .. " maps to " .. mw.dumpObject(v)) end
			end
		end
		for k,v in pairs(jsondata) do
			local property_names = {}
			local subobject_properties = {} -- reverse properties to store in the subobject
			local mapping_found = false
			-- a slot holding a characteristic is addressed by its schema key to tell apart
			-- multiple slots of the same type, e. g. l and d, or minimal_ and maximal_dimensions.
			-- set for a declared quantity and for any slot mapped to p.characteristic_property (below)
			local characteristic_slot = (type(schema_properties[k]) == 'table' and schema_properties[k][p.keys.smw_quantity_property] ~= nil)
			local property_definitions = {} -- list of objects {id=..., reverse=...}

			for term, def in pairs(context) do
				local term_parts = p.splitString(term, "*")
				if (term_parts[1] == k) then --custom additional mapping term*(*...): "Property:..."
					if type(def) == 'table' then 
						-- note: json-ld allows only @id OR @reverse
						if (def["@id"] ~= nil) then table.insert(property_definitions, {id=def["@id"], reverse=false}) end
						if (def["@reverse"] ~= nil) then table.insert(property_definitions, {id=def["@reverse"], reverse=true}) end
					else table.insert(property_definitions, {id=def}) end
				end
			end
			if (debug) then mw.logObject(property_definitions) end
			for i,e in ipairs(property_definitions) do 
				local id = e["id"]
				local property_definition = p.splitString(id, ':')
				if property_definition[1] == p.keys.property_ns_prefix then
					mapping_found = true
					property_name = string.gsub(id, p.keys.property_ns_prefix .. ":", "") -- also allow prefix properties like: Property:schema:url
					-- a slot mapped to the characteristic property is addressed by its schema key, too
					if (not e["reverse"] and id == p.defaultArg(p.characteristic_property, "")) then characteristic_slot = true end
					if (e["reverse"]) then -- reverse properties are handled in the respective subobject
						if (subobject_properties[property_name] == nil) then subobject_properties[property_name] = {} end --initialize empty list
						table.insert(subobject_properties[property_name], subjectId) -- add triple subobject -property-> subject
					else table.insert(property_names, property_name) end
					local schema_property = p.defaultArg(schema_properties[k], {})
					local schema_type = p.defaultArg(schema_property.type, nil) --todo: also load smw property type on demand
					property_data[k] = {schema_type=schema_type, schema_data=schema_property, property=property_name, value=v, reverse=e["reverse"]}
				end
			end
			if (characteristic_slot) then
				local slot_property = p.defaultArg(p.slot_property_prefix, "") .. k
				table.insert(property_names, slot_property)
				if (properties[slot_property] == nil) then properties[slot_property] = {} end
			end
			for i, property_name in ipairs(property_names) do
				if (properties[property_name] == nil) then properties[property_name] = {} end --initialize empty list
			end
			if type(v) == 'table' then
				--if (debug) then mw.logObject("prop " .. k .. " = " .. mw.dumpObject(v)) end
				-- a characteristic slot descends even without a json-ld mapping to record the subobject reference
				if (mapping_found or characteristic_slot) then
					local subcontext = p.copy(p.defaultArgPath(context, {k, p.keys.context}, {})) --deepcopy, see also https://phabricator.wikimedia.org/T269990
					context = p.tableMerge(context, subcontext) -- pull up nested context
					local values = {}
					if (p.tableLength(v) > 0 and v[1] == nil) then --key value array = object/dict => subobject
						local subproperties_res = p.getSemanticProperties({jsonschema=schema, jsondata=v, properties=p.copy(subobject_properties), store=true, root=false, debug=debug, context=context, subschema=schema_properties[k], parent_schema_property=property_data[k], path=p.joinPath(path, k)})
						local id = subproperties_res.id --subobject_id
						if (id ~= nil) then 
							id = mw.title.getCurrentTitle().fullText .. '#' .. id
							table.insert(values, id) 
						end
						-- create statement shortcut on the parent object
						properties = p.processStatement({subject=properties, statement=subproperties_res.properties, debug=debug}).subject
					else --list array
						for i, e in pairs(v) do
							if (type(e) == 'table') then
								local subproperties_res = p.getSemanticProperties({jsonschema=schema, jsondata=e, properties=p.copy(subobject_properties), store=true, root=false, debug=debug, context=context, subschema=schema_properties[k], parent_schema_property=property_data[k], path=p.joinPath(path, k .. "." .. i)})
								local id = subproperties_res.id --subobject_id
								if (id ~= nil) then 
									id = mw.title.getCurrentTitle().fullText .. '#' .. id
									table.insert(values, id) 
								end
								-- create statement shortcut on the parent object
								properties = p.processStatement({subject=properties, statement=subproperties_res.properties, debug=debug}).subject
							else values = v end --plain strings
						end
					end 
					for pi, property_name in ipairs(property_names) do
						for i,value in pairs(values) do table.insert(properties[property_name], value) end
						if (debug) then mw.logObject("set " .. property_name .. " = " .. mw.dumpObject(values)) end
					end
				else if (debug) then mw.logObject("not mapped: " .. k .. " = " .. mw.dumpObject(v)) end 
				end
				
				-- create smw quantity property on the parent object
				if (p.tableLength(v) > 0 and v[1] == nil) then --key value array = object/dict => subobject
					properties = p.processQuantityValue({properties=properties, value_object=v, schema=schema_properties[k], debug=debug}).properties
				else --list array
					for i, e in pairs(v) do
						if (type(e) == 'table') then
							-- the array schema itself carries no unit enum - resolve the element schema first
							properties = p.processQuantityValue({properties=properties, value_object=e, schema=p.resolveItemsSchema({schema=schema_properties[k], element=e}), debug=debug}).properties
						end
					end
				end
			else
				if (mapping_found) then 
					for pi, property_name in ipairs(property_names) do
						table.insert(properties[property_name], v)
						if (debug) then mw.logObject("set " .. property_name .. " = " .. mw.dumpObject(v)) end
					end
				else 
					if (debug) then mw.logObject("not mapped: " .. k .. " = " .. mw.dumpObject(v)) end 
				end
			end
		end
	end
	
	local store_res = nil
	if (store) then 
		properties['HasOswId'] = subjectId
		if (root) then 
			if (debug) then mw.logObject("Store page properties") end
			store_res = mw.smw.set( properties ) --store as semantic properties
		else
			properties['@category'] = {}
			p.tableMerge(properties['@category'], jsondata[p.keys.category]) -- from json property 'type'
			p.tableMerge(properties['@category'], properties[p.keys.category_pseudoproperty]) -- from json-ld context 'Property:Category'
			properties[p.keys.category_pseudoproperty] = nil -- delete pseudo property
			
			local display_label = p.getDisplayLabel(jsondata, properties)
			if properties['Display title of'] == nil and properties['Display_title_of'] == nil then
				if (display_label ~= nil and display_label ~= "") then properties['Display title of'] = display_label
				else properties['Display title of'] = p.defaultArg(subschema['title'], "") end -- fall back to property name in schema
			end
			p.setNormalizedLabel(properties) --build normalized multilang label
			if (p.tableLength(properties) > 0) then
				store_res = mw.smw.subobject( properties, subobjectId )	--store as subobject
				if (debug) then mw.logObject("Store subobject with id " .. (subobjectId or "<random>")) end
			end
		end
	end
	if (debug) then mw.logObject(properties) end
	if (store_res ~= nil) then 
		if (not store_res and store_res.error ~= nil) then error = error .. store_res.error end
	end
	if (debug) then mw.logObject(error) end
	return {properties=properties, definitions=property_data, id=subobjectId, context=context, error=error}
end

function p.processQuantityValue(args)
	local properties = p.defaultArg(args.properties, {})
	local object = p.defaultArg(args.value_object) -- {value: 1.1, unit: "Item:..."}
	local schema = p.defaultArg(args.schema) -- {title: "Length", properties: {unit: {default: "Item:...", enum: ["Item:...", ...], options: enum_titles: ["m", ...]}}}
	local debug = p.defaultArg(args.debug, false)
	
	if debug then
		mw.log("Check for quantity value object")
		mw.logObject(object)
		mw.logObject(schema)
	end
	if (object.value ~= nil and schema[p.keys.smw_quantity_property] ~= nil and schema.properties ~= nil and schema.properties.value ~= nil 
		and schema.properties.unit ~= nil and schema.properties.unit.enum ~= nil and schema.properties.unit.options ~= nil and schema.properties.unit.options.enum_titles ~= nil) then
		object.property = string.gsub(schema[p.keys.smw_quantity_property], p.keys.property_ns_prefix .. ":", "")
		object.value = p.defaultArg(object.value, schema.properties.value.default)
		object.unit = p.defaultArg(object.unit, schema.properties.unit.default)
		for i, e in pairs(schema.properties.unit.enum) do
			if e == object.unit then object.unit_index = i end	
		end
		-- only map internal properties (Properties:...) and if a unit was found
			if (object.unit_index ~= nil and p.splitString(schema[p.keys.smw_quantity_property], ':')[1] == p.keys.property_ns_prefix) then
				if debug then
					mw.log("Create quantity value")
					mw.logObject(object)
				end
				object.unit_symbol = schema.properties.unit.options.enum_titles[object.unit_index]
				if (properties[object.property] == nil) then properties[object.property] = {} end
				table.insert(properties[object.property], object.value .. " " .. object.unit_symbol)
			end
		end

	return {properties=properties}
end

function p.processStatement(args)
	local statement = p.defaultArg(args.statement)
	local subject = p.defaultArg(args.subject)
	local debug = p.defaultArg(args.debug, false)

	-- handle "approved" statements
	if (statement["HasSubject"] == nil or statement["HasSubject"][1] == nil or statement["HasSubject"][1] == "") then --implicit subject
		if (statement["HasProperty"] ~= nil and statement["HasProperty"][1] ~= nil and statement["HasProperty"][1] ~= "" and statement["HasObject"] ~= nil) then
			local property = string.gsub(statement["HasProperty"][1], p.keys.property_ns_prefix .. ":", "") -- also allow prefix properties like: Property:schema:url
			if (debug) then
				mw.log("Set property " .. property .. " from statement to ")
				mw.logObject(statement["HasObject"])
			end
			if (subject[property] == nil) then subject[property] = {} end
			for k, v in pairs(statement["HasObject"]) do table.insert(subject[property], v) end
		end
	end
	return {subject=subject}
end

-- build a semantic query based on provided properties and their schema definition
--[[ test: 
mw.logObject(p.getSemanticQuery({
	jsonschema={
		["@context"]={
			test="Property:TestProperty",
			number_max="Property:HasNumber",
			date_min="Property:HasDate"
		}, 
		properties={
			test={title="Test", type="string"},
			number_max={title="Number", type="string", format="number", options={role={query={filter="max"}}}},
			date_min={title="Date", type="string", format="date", options={role={query={filter="min"}}}},
		}
	}, 
	jsondata={test="TestValue", number_max=5, date_min="01.01.2023"}
}))
--]]
function p.getSemanticQuery(args)
	--local jsondata = p.defaultArg(args.jsondata, {})
	--local schema = p.defaultArg(args.jsonschema, {})
	local res = ""
	local where = ""
	local select = ""
	local semantic_properties = p.getSemanticProperties(args)
	--mw.logObject(semantic_properties)
	for k,def in pairs(semantic_properties.definitions) do
		-- see also: https://www.semantic-mediawiki.org/wiki/Help:Search_operators
		local filter = p.defaultArgPath(def.schema_data, {'options', 'role', 'query', 'filter'}, 'eq')
		local value = def.value
		if def.schema_data.type == 'string' and (def.schema_data.format == 'number' or def.schema_data.format == 'date') then 
			if (filter == 'min') then value = "<" .. value
			elseif (filter == 'max') then value = ">" .. value
			else value = value end --exact match
		elseif def.schema_data.type == 'string' then
			value = "~*" .. value .. "*"
		end
		where = where .. "\n[[".. def.property .. "::" .. value .. "]]"
		select = select .. "\n|?" .. def.property
		if (def.schema_data.title ~= nil) then select = select .. "=" .. def.schema_data.title end
	end
	if (where ~= "") then res = "{{#ask:" .. res .. where .. select .. "}}" end
	return {wikitext=res}
end

-- HELPERS

-- expands all $ref
--test: mw.logObject(p.expandJsonRef({json={items={test="value", ["$ref"]="/wiki/JsonSchema:Label?action=raw"}}}).json)
--test: mw.logObject(p.expandJsonRef({json={["$ref"]="/wiki/Category:Item?action=raw&slot=jsonschema"}}).json)
--test: mw.logObject(p.expandJsonRef({json={["$ref"]="/wiki/JsonSchema:Statement?action=raw"}}).json)
function p.expandJsonRef(args)
	local json = p.defaultArg(args.json, {})
	local debug = p.defaultArg(args.debug, false)
	local refs = {}
    for k,v in pairs(json) do
    	if (k == "$ref") then
    		-- e. g. "/wiki/JsonSchema:Label?action=raw" or "/wiki/Category:Entity?action=raw&slot=jsonschema"
    		if string.find(v, "#") then
    			if (debug) then mw.logObject("Skip relative reference") end
    		else
	    		local uri = mw.uri.new(v)
	    		local ref_title = mw.text.split(uri.path, "wiki/", true)[2]
	    		local ref_slot = uri.query["slot"]
	    		if (debug) then 
		    		if (ref_slot ~= nil) then mw.logObject("Ref found with title " .. ref_title .. " and slot " .. ref_slot)
		    		else mw.logObject("Ref found with title " .. ref_title) end
	    		end
	    		local ref_json = p.loadJson({title=ref_title, slot=ref_slot}).json
	    		refs[v] = ref_json
	    		json[k] = nil
    		end
    	end
    end
	--mw.logObject(refs)
	for k,v in pairs(refs) do
		json = p.tableMerge(v, json)
	end
    for k,v in pairs(json) do
    	if type(v) == "table" then
            json[k] = p.expandJsonRef({json=v}).json
        end
    end
    local result = p.copy(json)
    for k,v in pairs(json) do
    	if (k == "allOf") then
            if (type(v) == "table" and v[1] == nil) then v = {v} end -- ensure array
            for i,s in pairs(v) do 
            	result = p.tableMerge(s, result)
            	if (debug) then mw.log("merge allOf with title " .. s["title"]) end
            end
            result[k] = nil
        end
    end
    
    return {json=result}
end



function p.defaultArg(arg, default)
	if (arg == nil) then 
		return default
	else
		return arg
	end
end

-- returns the value of a table (dict) path or default, if the path is not defined
-- test: mw.logObject(p.defaultArgPath({some={defined={path="value"}}}, {"some", "defined", "path"}, "default_value"))
-- test: mw.logObject(p.defaultArgPath({some={defined={path="value"}}}, {"some", "undefined", "path"}, "default_value"))
function p.defaultArgPath(arg, path, default)
	if (arg == nil) then 
		return default
	elseif (path == nil) then
		return arg
	else
		key = table.remove(path,1)
		if (key == nil) then return arg end  --end of path
		return p.defaultArgPath(arg[key], path, default)
	end
end

-- joins a json path segment to its parent path
-- test: mw.logObject(p.joinPath("characteristics", "2"))
function p.joinPath(parent, key)
	if (p.nilOrEmpty(parent)) then return key end
	return parent .. "." .. key
end

-- resolves the schema of an array element: the 'items' schema, or - if 'items' declares a
-- oneOf/anyOf - the branch whose declared instance type matches the type of the element.
-- the quantity property is inherited from 'items' if the matching branch does not define one
-- test: mw.logObject(p.resolveItemsSchema({schema={items={oneOf={{properties={type={default={"Category:A"}}}}}}}, element={type={"Category:A"}}}))
function p.resolveItemsSchema(args)
	local schema = p.defaultArg(args.schema, {})
	local element = p.defaultArg(args.element, {})
	local items = p.defaultArgPath(schema, {"items"}, nil)
	if (items == nil) then return schema end
	local branches = p.defaultArg(items.oneOf, items.anyOf)
	if (type(branches) ~= 'table') then return items end
	local element_types = p.tablefy(element[p.keys.category])
	for bi, branch in ipairs(branches) do
		local declared = p.defaultArgPath(branch, {"properties", p.keys.category, "default"}, nil)
		if (declared == nil) then declared = p.defaultArgPath(branch, {"properties", p.keys.category, "const"}, nil) end
		if (declared == nil) then declared = p.defaultArgPath(branch, {"properties", p.keys.category, "enum"}, nil) end
		for di, dv in pairs(p.tablefy(declared)) do
			for ei, ev in pairs(element_types) do
				if (dv == ev) then
					if (branch[p.keys.smw_quantity_property] == nil and items[p.keys.smw_quantity_property] ~= nil) then
						branch = p.copy(branch)
						branch[p.keys.smw_quantity_property] = items[p.keys.smw_quantity_property]
					end
					return branch
				end
			end
		end
	end
	return items
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

--dumps a table to a string (replaced by mw.dumpObject())
function p.dump(o)
   return mw.dumpObject(o)
end

--converts a literal to an table
function p.tablefy(o)
	if (o == nil) then o = {} end
	if (type(o) ~= 'table') then o = {o} end
	return o
end

--true if the value is contained in the array (flat arrays only)
function p.tableContains (tab, val)
    for index, value in ipairs(tab) do
        if value == val then
            return true
        end
    end

    return false
end

--get the size of a table
function p.tableLength(t)
  local count = 0
  for _ in pairs(t) do count = count + 1 end
  return count
end

--check if a variable is nil or an empty string or table
function p.nilOrEmpty(o)
	if (o == nil) then return true
	elseif (type(o) == 'string' and o == "") then return true
	elseif (type(o) == 'table' and p.tableLength(o) == 0) then return true
	else return false 
	end
end

-- merges t2 to t1
--test: mw.logObject(p.tableMerge({"string", test1="test1", subtable1={"test"}}, {"string2", test1="test2", test3="test4"}))
function p.tableMerge(t1, t2)
	if (t1 == nil) then t1 = {} elseif (type(t1) ~= 'table') then t1 = {t1} end
	if (t2 == nil) then t2 = {} elseif (type(t2) ~= 'table') then t2 = {t2} end
    for k,v in pairs(t2) do
        if type(v) == "table" then
            if type(t1[k] or false) == "table" then
                p.tableMerge(t1[k] or {}, t2[k] or {})
            else
                if type(k) == 'number' then table.insert(t1, v)
            	else t1[k] = v end
            end
        else
        	if type(k) == 'number' then table.insert(t1, v)
            else t1[k] = v end
        end
    end
    return t1
end

-- from https://stackoverflow.com/questions/640642/how-do-you-copy-a-lua-table-by-value
function p.copy(obj, seen)
  if type(obj) ~= 'table' then return obj end
  if seen and seen[obj] then return seen[obj] end
  local s = seen or {}
  local res = setmetatable({}, getmetatable(obj))
  s[obj] = res
  for k, v in pairs(obj) do res[p.copy(k, s)] = p.copy(v, s) end
  return res
end

-- get normalized label
function p.getDisplayLabel(jsondata, properties)
	local display_label = nil
	-- check if label properties are mapped
	if (properties["HasLabel"] ~= nil and properties["HasLabel"][1] ~= nil) then display_label = p.splitString(properties["HasLabel"][1], '@')[1] 
	elseif (properties["HasName"] ~= nil) then 
		if type(properties["HasName"]) == 'table' then display_label = properties["HasName"][1]
		else display_label = properties["HasName"] end
	-- fall back to unmapped keywords
	elseif (jsondata[p.keys.label] ~= nil and jsondata[p.keys.label][1] ~= nil) then
		if type(jsondata[p.keys.label][1]) ~= 'table' then display_label = p.splitString(jsondata[p.keys.label][1], '@')[1]
		else display_label = jsondata[p.keys.label][1][p.keys.text] end -- no eval_template applied
	elseif (jsondata[p.keys.name] ~= nil) then display_label = jsondata[p.keys.name] 
	end

	return display_label
end

-- build normalized multilang label
function p.setNormalizedLabel(properties, use_fallbacks)
	if (use_fallbacks == nil) then use_fallbacks = true end
	if (properties['HasLabel'] ~= nil) then 
		labels = properties['HasLabel']
		if(type(labels) ~= 'table') then labels = {labels} end
		properties['HasNormalizedLabel'] = {}
		for i, label in ipairs(labels) do
			label_norm = p.splitString(label, '@')[1]:lower():gsub('[^%w]+','')
			label_lang = "en"
			if (p.splitString(label, '@')[2] ~= nil) then label_lang = p.splitString(label, '@')[2] end
			table.insert(properties['HasNormalizedLabel'], label_norm .. "@" .. label_lang)	
		end
	
	elseif (use_fallbacks and properties['HasName'] ~= nil) then -- fallback, assume English lang
		labels = properties['HasName']
		if(type(labels) ~= 'table') then labels = {labels} end
		properties['HasNormalizedLabel'] = {}
		for i, label in ipairs(labels) do
			label_norm = label:lower():gsub('[^%w]+','')
			table.insert(properties['HasNormalizedLabel'], label_norm .. "@en")
		end
	elseif (use_fallbacks and properties['Display title of'] ~= nil) then -- fallback, assume English lang
		labels = properties['Display title of']
		if(type(labels) ~= 'table') then labels = {labels} end
		properties['HasNormalizedLabel'] = {}
		for i, label in ipairs(labels) do
			label_norm = label:lower():gsub('[^%w]+','')
			table.insert(properties['HasNormalizedLabel'], label_norm .. "@en")
		end
	end
end

-- Resolve the current user interface language code (e.g. "de", "en").
-- Cached for the lifetime of the Lua environment (one render = one language).
function p.getUserLang()
	if p._userLang == nil then
		local frame = mw.getCurrentFrame()
		local lang = mw.text.trim(frame:preprocess('{{USERLANGUAGECODE}}'))
		if lang == nil or lang == '' then lang = 'en' end
		p._userLang = lang
	end
	return p._userLang
end

-- Resolve a (multilang) value for the current user language, with fallback to
-- English and then to the supplied default. Returns a plain string (no
-- {{#switch}} wikitext), so the value cannot cross-talk with other properties
-- once the tree/infobox wikitext is preprocessed.
function p.renderMultilangValue(args)
	local jsondata = p.defaultArg(args.jsondata, {})
	local jsonschema = p.defaultArg(args.jsonschema, {})
	local key = p.defaultArg(args.key, "title")
	local fallback = p.defaultArg(args.default, "")
	local lang = p.getUserLang()
	local localized = nil -- value matching the user language
	local en = nil        -- explicit English value (preferred fallback)

	-- plain "title": "..." (language-neutral, treated as English fallback)
	if type(jsonschema[key]) == 'string' then
		en = jsonschema[key]
	end
	-- "title*": {"de": ..., "en": ...}
	if type(jsonschema[key .. '*']) == 'table' then
		for k, v in pairs(jsonschema[key .. '*']) do
			if k == lang then localized = v end
			if k == "en" then en = v end
		end
	end
	-- "some_property": [{"lang": "de", "text": ...}]
	if type(jsondata[key]) == 'table' then
		for _, v in pairs(jsondata[key]) do
			if type(v) == 'table' and v["lang"] ~= nil and v["text"] ~= nil then
				if v["lang"] == lang then localized = v["text"] end
				if v["lang"] == "en" then en = v["text"] end
			end
		end
	end

	local result = localized or en or fallback
	if result == nil then result = "" end
	return result
end

function p.wrapLinkIfNs(s)
	local frame = mw.getCurrentFrame()
    if type(s) ~= 'string' then return s end
    if s:find('%[%[') then return s end -- already linked
    local ns, rest = s:match('^([%a]+):(.*)$')
    if not ns or not rest or rest == '' then return s end

    if ns == 'Category' or ns == 'Item' or ns == 'File' or ns == 'Property' then
        -- If there is an anchor/subobject in the title, use the Viewer/Link template
         return frame:expandTemplate{ title = 'Viewer/Link', args = { page = s } }
         --s = "{{Viewer/Link |page= " .. s .. "}}"
    end

    return s
end

return p