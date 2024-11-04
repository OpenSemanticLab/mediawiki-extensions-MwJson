/*@nomin*/

mwjson.editor.prototype.addCss = function () {
    var styleSheet = document.createElement("style");
    // add a more descriptive i18n label to the addition properties button / burger menu
    styleSheet.innerText = `
    button.json-editor-btn-edit_properties::after {
        content: " ${mw.message("mwjson-editor-select-additional-properties").text()}"
    }
    `;
    document.head.appendChild(styleSheet);
}

mwjson.editor.createModal = function (config) {
    config = config || {}
    var defaultConfig = {
        "size": "lg",
        "class": "",
        "backdrop": "static",
        "body": "",
        "footer": "",
        "cancelCallback": null
    }
    config = mwjson.util.mergeDeep(defaultConfig, config);
    if (config.body && config.body !== "")
        config.body = `
        	        <div class="modal-body">
                        ${config.body}
                    </div>`
    else config.body = "";

    if (document.getElementById(config.id)) {
        //bootstrap.Modal.getOrCreateInstance(document.getElementById(config.id)).remove();
        document.getElementById(config.id).remove();
    }
    if (!document.getElementById(config.id)) {
        var html = `
        <div class="modal" id="${config.id}" data-bs-backdrop="${config.backdrop}" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-${config.size} ${config.class}">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${config.title}</h5>
                    </div>
                    ${config.body}
                    <div class="modal-footer">
                        ${config.footer}
                    </div>
                </div>
            </div>
        </div>
        `;

        var elem = document.createElement('div');
        elem.innerHTML = html;
        document.querySelector('body').appendChild(elem);


        for (btn of config.buttons) {
            const button = document.createElement('button');
            button.textContent = btn.label;
            if (btn.tooltip) button.title = btn.tooltip;
            button.type = 'button';
            button.className = btn.class ? btn.class : 'btn btn-primary';
            if (btn.closing) button.setAttribute('data-bs-dismiss', 'modal');
            if (btn.id) button.setAttribute('id', btn.id);
            let location = btn.location ? btn.location : 'footer';
            const parentNode = document.querySelector("#" + config.id + " ." + (btn.section ? btn.section : "modal-" + location));
            parentNode.appendChild(button);

            // Register an event handler for on_click
            button.addEventListener('click', btn.onclick);
        }
    }

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById(config.id), {
        backdrop: 'static', // Includes a modal-backdrop element. Alternatively, specify static for a backdrop which doesn’t close the modal when clicked.
        focus: true, // Puts the focus on the modal when initialized.
        keyboard: false, //	Closes the modal when escape key is pressed.
    })

    //modal.show()
    return modal;
}

// drop-in replacement for OO.ui.alert
mwjson.editor.prototype.alert = function (msg) {
    let msg_confirm = "OK";
    const promise = new Promise((resolve, reject) => {
        const confirmClose_modal = mwjson.editor.createModal({
            id: "confirm", title: msg, description: "", body: "",
            size: "md", class: "modal-danger",
            buttons: [
                {label: msg_confirm, class: "btn btn-secondary", closing: true, onclick: () => {resolve();}}
            ]
        });
        confirmClose_modal.show(); 
    })  
    return promise;
}

// drop-in replacement for OO.ui.confirm
mwjson.editor.prototype.confirm = function (msg) {
    let msg_confirm = mw.message("mwjson-editor-close-anyway").text();
    let msg_reject = mw.message("mwjson-editor-return-to-editor").text();
    const promise = new Promise((resolve, reject) => {
        const confirmClose_modal = mwjson.editor.createModal({
            id: "confirm", title: msg, description: "", body: "",
            size: "md", class: "modal-warning",
            buttons: [
                {label: msg_confirm, class: "btn btn-secondary", closing: true, onclick: () => {resolve(true);}},
                {label: msg_reject, closing: true, onclick: () => {resolve(false);}}
            ]
        });
        confirmClose_modal.show(); 
    })
       
    return promise;
}

mwjson.editor.prototype.createPopupDialog = function (_config) {
    _config = _config || {}
    var editor = this;
    var defaultConfig = {
        size: "medium", //small, medium, large, larger or full,
        toggle_fullscreen: false, //enable toggle fullscreen button
        msg: {
            "dialog-title": "JSONEditor",
            "continue": "Continue",
            "cancel": "Cancel",
            "toggle-fullscreen": "Leave / enter fullscreen",
            "edit-comment": mw.message("mwjson-editor-edit-comment-input-label").text(),
            "edit-comment-placeholder": mw.message("mwjson-editor-edit-comment-input-placeholder").text(),
            "edit-comment-tooltip": mw.message("mwjson-editor-edit-comment-input-tooltip").text()
        },
        redirect: (page) => {
            var params = { "veaction": "edit" };
            if (!page.exists) params["redlink"] = 1;
            return new mw.Title(page.title).getUrl(params);
        },
        new_window: false,
        edit_comment: true,
        edit_comment_required: false
    };

    _config = mwjson.util.mergeDeep(defaultConfig, _config);
    let commentFieldLabelDetails = _config.edit_comment_required ?
        mw.message('mwjson-editor-required').text() : mw.message('mwjson-editor-optional').text();
    let commentFieldLabel = _config.msg['edit-comment'] + ' (' + commentFieldLabelDetails + ')';
    let footer = "";
    if (editor.config.mode !== "query") {
        footer += `
        <div class="input-group mb-3">
            <span class="input-group-text" id="${editor.config.id}_edit-comment-label">${commentFieldLabel}</span>
            <input id="${editor.config.id}_edit-comment-input" type="text" class="form-control" placeholder="${_config.msg['edit-comment-placeholder']}" title="${_config.msg['edit-comment-tooltip']}" aria-label="edit-comment" aria-describedby="edit-comment-label">
        </div>
        `;
    }

    let dataEditor_modal = null;
    let query_body = "";
    if (editor.config.mode === 'query') {
        editor.config.result_container_id = editor.config.id + '_query';
        query_body = '<div id="' + editor.config.result_container_id + '" style="height:300px;overflow:auto"></div>';
    }

    const confirmClose = () => {
        let msg = mw.message("mwjson-editor-cancel-unsafed-changes").text();
        let msg_confirm = mw.message("mwjson-editor-close-anyway").text();
        let msg_reject = mw.message("mwjson-editor-return-to-editor").text();
        const confirmClose_modal = mwjson.editor.createModal({
            id: "confirmClose", title: msg, description: "", body: "",
            size: "md", class: "modal-warning",
            buttons: [
                {label: msg_confirm, class: "btn btn-secondary", closing: true, onclick: () => {dataEditor_modal.hide();}},
                {label: msg_reject, closing: true}
            ]

        });
        confirmClose_modal.show();
    }

    const aiBtnLabel = mw.message("mwjson-editor-ai-completion-label").text(),
      aiBtnTooltip = mw.message("mwjson-editor-ai-completion-tooltip").text(),
      aiBtnDoneLabel = mw.message("mwjson-editor-api-call-done").text(),
      aiBtnRunningLabel = mw.message("mwjson-editor-api-call-running").text(),
      aiBtnFailedLabel = mw.message("mwjson-editor-api-call-failed").text(),
      aiBtnRerunLabel = mw.message("mwjson-editor-api-call-rerun").text();
    let aiBtnClassList = "btn btn-info";
    const aiCompletionApiUrl = mw.config.get('wgMwJsonAiCompletionApiUrl');
    if (!aiCompletionApiUrl || aiCompletionApiUrl == "") aiBtnClassList += " invisible";
    dataEditor_modal = mwjson.editor.createModal({
        id: "dataEditorModal_" + editor.config.id, title: _config.msg["dialog-title"], description: "",
        size: "xxl",
        body: query_body + `
        <div id="${editor.config.id}" style="min-height:1000px;"></div>
        `,
        footer: footer,
        buttons: [
            {class: "btn-close", closing: false, onclick: confirmClose, location: "header"},
            {label: aiBtnLabel, tooltip: aiBtnTooltip, id:`${editor.config.id}_btn-ai-complete`, class: aiBtnClassList, location: "footer", closing: false, onclick: async () => {
                const button = document.getElementById(`${editor.config.id}_btn-ai-complete`);
                button.classList.remove('btn-info');
                button.classList.remove('btn-success');
                button.classList.remove('btn-danger');
                button.classList.remove('btn-warning');
                button.classList.add('btn-warning');
                button.textContent = aiBtnLabel + ": " + aiBtnRunningLabel;
                try {
                    result = await mwjson.extData.getAiCompletion({editor: editor, aiCompletionApiUrl: aiCompletionApiUrl});
                    button.classList.remove('btn-warning');
                    button.classList.remove('btn-danger');
                    button.classList.add('btn-success');
                    button.textContent = aiBtnLabel + ": " + aiBtnDoneLabel + " " + aiBtnRerunLabel;
                    //editor.jsoneditor.change();
                }
                catch (error) {
                    console.log(error);
                    button.classList.remove('btn-warning');
                    button.classList.add('btn-danger');
                    button.textContent = aiBtnLabel + ": " + aiBtnFailedLabel + " " + aiBtnRerunLabel;
                }

            }},
            {label: _config.msg["cancel"], class: "btn btn-secondary", closing: false, onclick: confirmClose},
            {label: _config.msg["continue"], id: `${editor.config.id}_btn-submit`, closing: false, onclick: () => {
                let meta = {};
                if (editor.config.mode !== "query" && _config.edit_comment) 
                    meta.comment = document.getElementById(`${editor.config.id}_edit-comment-input`).value;
                editor._onsubmit({meta:meta})
                    .then(() => dataEditor_modal.hide())
                    .catch();
            }}
        ]

    });
    if (editor.config.mode !== "query" && _config.edit_comment_required) {
        let btn = document.getElementById(`${editor.config.id}_btn-submit`);
        btn.disabled = true;
        document.getElementById(`${editor.config.id}_edit-comment-input`).addEventListener('input', (e) => {
            let text = e.target.value;
            if (text && text !== "") btn.disabled = false;
            else btn.disabled = true;
        });
    }

    dataEditor_modal.show();
    document.getElementById("dataEditorModal_" + editor.config.id).addEventListener('hidden.bs.modal', () => {
        dataEditor_modal.dispose(); // does not remove DOM
        document.getElementById("dataEditorModal_" + editor.config.id).remove();
    })
    
}

mwjson.editor.prototype.createPopupDialog_old = function (_config) {
    _config = _config || {}
    var editor = this;
    var defaultConfig = {
        size: "medium", //small, medium, large, larger or full,
        toggle_fullscreen: false, //enable toggle fullscreen button
        msg: {
            "dialog-title": "JSONEditor",
            "continue": "Continue",
            "cancel": "Cancel",
            "toggle-fullscreen": "Leave / enter fullscreen",
            "edit-comment": mw.message("mwjson-editor-edit-comment-input-label").text(),
            "edit-comment-placeholder": mw.message("mwjson-editor-edit-comment-input-placeholder").text(),
            "edit-comment-tooltip": mw.message("mwjson-editor-edit-comment-input-tooltip").text()
        },
        redirect: (page) => {
            var params = { "veaction": "edit" };
            if (!page.exists) params["redlink"] = 1;
            return new mw.Title(page.title).getUrl(params);
        },
        new_window: false,
        edit_comment: true,
        edit_comment_required: false
    };

    _config = mwjson.util.mergeDeep(defaultConfig, _config);

    // Make a subclass of ProcessDialog 
    function Dialog(config) {
        Dialog.super.call(this, config);
    }
    OO.inheritClass(Dialog, OO.ui.ProcessDialog);

    // Specify a name for .addWindows()
    Dialog.static.name = 'CreatePageDialog';
    // Specify the static configurations: title and action set
    Dialog.static.title = _config.msg["dialog-title"];
    Dialog.static.escapable = false; // pressing ESC does not close the dialog 
    Dialog.static.actions = [
        {
            flags: 'safe',
            label: _config.msg['cancel'],
            action: 'cancel'
        }
    ];
    if (editor.config.mode !== 'query') {
        Dialog.static.actions.push({
            flags: [ 'primary', 'progressive' ],
            label: _config.msg['continue'],
            action: 'create',
            disabled: _config.edit_comment_required
        });
    }
    else _config.edit_comment = false; // diable comment in query form
    if (_config.toggle_fullscreen) {
        Dialog.static.actions.push(
            {
                action: 'toggle-fullscreen',
                label: _config.msg['toggle-fullscreen'],
            }
        );
    }

    // Customize the initialize() function to add content and layouts: 
    Dialog.prototype.initialize = function () {
        Dialog.super.prototype.initialize.call(this);
        this.panel = new OO.ui.PanelLayout({
            padded: true,
            expanded: false
        });

        if (_config.edit_comment) {
            this.content = new OO.ui.FieldsetLayout();
            this.commentInput = new OO.ui.TextInputWidget();
            let commentFieldLabelDetails = _config.edit_comment_required ?
                mw.message('mwjson-editor-required').text() : mw.message('mwjson-editor-optional').text();
            let commentFieldLabel = _config.msg['edit-comment'] + ' (' + commentFieldLabelDetails + ')';
            this.commentField = new OO.ui.FieldLayout(this.commentInput, {
                label: commentFieldLabel,
                placeholder: _config.msg['edit-comment-placeholder'],
                title: _config.msg['edit-comment-tooltip'],
                align: 'left'
            });
            this.content.addItems([this.commentField]);
            this.panel.$element.append(this.content.$element);
            if (_config.edit_comment_required) this.commentInput.connect(this, { 'change': 'onCommentInputChange' });
        }

        if (editor.config.mode === 'query') {
            editor.config.result_container_id = editor.config.id + '_query';
            this.panel.$element.append($('<div id="' + editor.config.result_container_id + '" style="height:300px;overflow:auto"></div>'));
        }
        this.panel.$element.append($('<div id="' + editor.config.id + '" style="min-height:1000px;"></div>'));
        this.$body.append(this.panel.$element);
    };

    // Specify any additional functionality required by the window (disable creating an empty comment, in this case)
    // only called when _config.edit_comment_required === true
    Dialog.prototype.onCommentInputChange = function (value) {
        this.actions.setAbilities({
            create: !!value.length
        });
    };

    // Specify the dialog height (or don't to use the automatically generated height).
    Dialog.prototype.getBodyHeight = function () {
        // Note that "expanded: false" must be set in the panel's configuration for this to work.
        // When working with a stack layout, you can use:
        //   return this.panels.getCurrentItem().$element.outerHeight( true );
        return this.panel.$element.outerHeight(true);
    };

    // Use getSetupProcess() to set up the window with data passed to it at the time 
    // of opening (e.g., pageTitle: '', in this example). 
    Dialog.prototype.getSetupProcess = function (data) {
        data = data || {};
        return Dialog.super.prototype.getSetupProcess.call(this, data)
            .next(function () {
                // Set up contents based on data
            }, this);
    };

    // Specify processes to handle the actions.
    Dialog.prototype.getActionProcess = function (action) {
        var dialog = this;
        console.log(action);
        if (action === 'cancel') { // "Cancel or ESC pressed"
            return new OO.ui.Process(function () {
                let msg = mw.message("mwjson-editor-cancel-unsafed-changes").text();
                let msg_confirm = mw.message("mwjson-editor-close-anyway").text();
                let msg_reject = mw.message("mwjson-editor-return-to-editor").text();
                // does block UI when reopen the editor after first closing
                //OO.ui.confirm(msg).done((confirmed) => {
                //    if (confirmed) dialog.close({ action: action });
                //});
                // same
                dialog.close({ action: action });
                return;
                const modal = mwjson.editor.createModal({
                    id: "confirmClose", title: msg, description: "",
                    buttons: [
                        {label: msg_confirm, class: "btn btn-secondary", closing: true, onclick: () => {dialog.close({ action: action });}},
                        {label: msg_reject, closing: true}
                    ]

                });
                modal.show();
            }, this);
        }
        if (action === 'create') {
            // Create a new process to handle the action
            return new OO.ui.Process(function () {
                let meta = {};
                if (_config.edit_comment) 
                    meta.comment = this.commentInput.getValue();
                editor._onsubmit(
                    {meta:meta}
                )
                    .then(() => dialog.close({ action: action }))
                    .catch();
            }, this);
        }
        if (action === 'toggle-fullscreen') {
            // Toggle fullscreen mode
            return new OO.ui.Process(function () {
                if (dialog.getSize() === _config.size) dialog.setSize('full');
                else dialog.setSize(_config.size);
            }, this);
        }
        // Fallback to parent handler
        return Dialog.super.prototype.getActionProcess.call(this, action);
    };

    // Use the getTeardownProcess() method to perform actions whenever the dialog is closed. 
    // This method provides access to data passed into the window's close() method 
    // or the window manager's closeWindow() method.
    Dialog.prototype.getTeardownProcess = function (data) {
        return Dialog.super.prototype.getTeardownProcess.call(this, data)
            .first(function () {
                // Perform any cleanup as needed
                this.manager.$element.remove(); //delete dialog DOM
                // prevent scrolling back to the last selected elements
                // this is often the top of the page which is not intended 
                // when the user has already scrolled down
                this.manager.$returnFocusTo = null; 
            }, this);
    };

    // Create and append a window manager.
    var windowManager = new OO.ui.WindowManager();
    //windowManager.escapable = false; // pressing ESC does not close the dialog 
    $(document.body).append(windowManager.$element);

    // Create a new process dialog window.
    var dialog = new Dialog({ 
        size: _config.size,
        //escapable: false, // pressing ESC does not close the dialog 
    });
    //dialog.escapable = false; // pressing ESC does not close the dialog 

    // Add the window to window manager using the addWindows() method.
    windowManager.addWindows([dialog]);

    // Open the window!   
    windowManager.openWindow(dialog, { pageTitle: _config.title });
}

/*
Creates an autocomplete input
*/
mwjson.editor.createAutocompleteInput = function (config) {
    //console.log("create autocomplete for div " + div_id);

    const config_defaults = {
        query: input => `[[Display_title_of::like:*${input}*]][[!~*QUERY*]]|?Display_title_of=HasDisplayName|?HasDescription`,
        minInputLen: 0,
        filter: (result, input) => {
            if (result.printouts['HasDisplayName'][0]) return result.printouts['HasDisplayName'][0].toLowerCase().includes(input.toLowerCase());
            else return result.fulltext.split(":")[result.fulltext.split(":").length - 1].toLowerCase().includes(input.toLowerCase());
        },
        renderMode: "html",
        renderResult: (result, props) => `
			<li ${props}>
				<div class="wiki-title">
					${result.printouts['HasDisplayName'][0]} (${result.fulltext})
				</div>
			</li>
			<div class="wiki-snippet">
			${result.printouts['HasDescription'][0]}
			</div>
			`,
        getResultValue: result => {
            if (result.printouts['HasDisplayName'][0]) return result.printouts['HasDisplayName'][0];
            else return result.fulltext.split(":")[result.fulltext.split(":").length - 1];
        },
        onSubmit: result => { }
    }

    config = { ...config_defaults, ...config };

    new Autocomplete('#' + config.div_id, {
        search: input => {
            const url = mw.config.get("wgScriptPath") + `/api.php?action=ask&query=${config.query(input)}&format=json`;
            return new Promise(resolve => {
                if (input.length < config.minInputLen) { return resolve([]); }
                fetch(url)
                    .then(response => response.json())
                    .then(data => {
                        //convert result dict to list/array
                        var resultList = Object.values(data.query.results);
                        resultList = resultList.filter(result => {
                            return config.filter(result, input);
                        });
                        resolve(resultList);
                    });
            });
        },
        renderResult: (result, props) => {
            if (config.renderMode == "html") return config.renderResult(result, props);
            if (config.renderMode == "wikitext") {
                var renderUrl = mw.config.get("wgScriptPath") + '/api.php?action=parse&format=json&text=';
                renderUrl += encodeURIComponent(config.renderResult(result, props));
                new Promise(resolve => {
                    //console.log("Render-URL: " + renderUrl);
                    fetch(renderUrl)
                        .then(response => response.json())
                        .then(data => {
                            //console.log("Parsed: " + data.parse.text);
                            //console.log("ID = " + props.id);
                            $("#" + props.id).append($(data.parse.text['*']));
                            $("#" + props.id).find("a").attr("target", "_blank"); //make all links open in new tab
                            //resolve(data.parse.text);
                        });
                });
                return `
					<li ${props}>
					</li>`;
            }
        },
        getResultValue: result => config.getResultValue(result),
        onSubmit: result => {
            //console.log(result); 
            config.onSubmit(result);
        }
    });
}

mwjson.editor.createCopyPageDialog = function (_config) {
    var defaultConfig = { "title": "", "template": mw.config.get("wgPageName"), "hide_template": true, "hide_template_preview": true };
    _config = { ...defaultConfig, ..._config };
    //_config.beforeSubmit = (targetTitle) => {return mwjson.api.copyPage(_config.sourceTitle, targetTitle)};
    mwjson.editor.createPageDialog(_config);
}

mwjson.editor.createSubpageDialog = function (_config) {
    var defaultConfig = { "superpage": mw.config.get("wgPageName"), "namespace": "", "title": "" };
    _config = { ...defaultConfig, ..._config };
    mwjson.editor.createPageDialog(_config);
}

mwjson.editor.createPageDialog = function (_config) {
    var defaultConfig = {
        "superpage": "",
        "namespace": "",
        "title": "",
        "hide_title": false,
        "template": "",
        "hide_template": false,
        "hide_template-preview": false,
        "template_query": "",
        msg: {
            "dialog-title": "Create new page",
            "continue": "Continue",
            "cancel": "Cancel",
            "title-label": "Click continue to create a page with the given name",
            "template-label": "Here you can select an optional template (any existing site).",
            'template-preview-label': "Preview",
            "page-exists-warning": "Page does exist. Overwrite?"
        },
        redirect: (page) => {
            var params = { "veaction": "edit" };
            if (!page.exists) params["redlink"] = 1;
            return new mw.Title(page.title).getUrl(params);
        },
        new_window: false
    };
    defaultConfig.template_autocomplete = {
        div_id: "autocomplete",
        //preview_div_id: "autocomplete-preview", //static for now
        query: input => "[[Display_title_of::like:*" + input + "*]]OR[[like:*" + input + "*]]|?Display_title_of=HasDisplayName|?HasDescription", // adding [[!~*QUERY*]] seams incompatible with OR operator
        minInputLen: 0,
        filter: (result, input) => {
            if (result.fulltext.includes("QUERY")) return false; //filter out SMW Query subobjects
            if (result.printouts['HasDisplayName'][0]) return result.printouts['HasDisplayName'][0].toLowerCase().includes(input.toLowerCase());
            else return result.fulltext.split(":")[result.fulltext.split(":").length - 1].toLowerCase().includes(input.toLowerCase());
        },
        _renderMode: "html",
        _renderResult: (result, props) => `
			<li ${props}>
				<div class="wiki-title">
					${result.printouts['HasDisplayName'][0] ? result.printouts['HasDisplayName'][0] + " (" : ""} ${result.fulltext} ${result.printouts['HasDisplayName'][0] ? ")" : ""}
				</div>
			</li>
			<div class="wiki-snippet">
			${result.printouts['HasDescription'][0] ? result.printouts['HasDescription'][0] : ""}
			</div>
			`,
        renderMode: "wikitext",
        renderResult: (result, props) => {
            var wikitext = "";
            wikitext += `[[${result.fulltext}|${mwjson.util.stripNamespace(result.fulltext)}]]`;
            if (result.printouts['HasDescription'][0]) wikitext += `</br>${result.printouts['HasDescription'][0]}`;
            return wikitext;
        },
        getResultValue: result => {
            if (result.printouts['HasDisplayName'][0]) return result.printouts['HasDisplayName'][0];
            else return result.fulltext.split(":")[result.fulltext.split(":").length - 1];
        },
        onSubmit: result => {
            _config.template = result.fulltext;
            var renderUrl = mw.config.get("wgScriptPath") + '/api.php?action=parse&format=json&page=';
            renderUrl += encodeURIComponent(result.fulltext);
            new Promise(resolve => {
                //console.log("Render-URL: " + renderUrl);
                fetch(renderUrl)
                    .then(response => response.json())
                    .then(data => {
                        //console.log("Parsed: " + data.parse.text);
                        //console.log("ID = " + props.id);
                        $("#" + 'autocomplete-preview').html($(data.parse.text['*']));
                        $("#" + 'autocomplete-preview').find("a").attr("target", "_blank"); //make all links open in new tab
                        //resolve(data.parse.text);
                    });
            });
        }
    }
    _config = mwjson.util.mergeDeep(defaultConfig, _config);

    //inject a page modification before safing the new page
    if (_config.modifications) {
        _config.modify = (page) => {
            const deferred = $.Deferred();
            //console.log(page.dict);
            mwjson.parser.parsePageAsync(page).then((page) => {
                _config.modifications.forEach(mod => {
                    if (typeof mod.value === 'function') mod.value = mod.value(_config);
                    mwjson.parser.set_template_param(page, mod.template, mod.path, mod.value);
                });
                mwjson.parser.updateContent(page);
                console.log(page.dict);
                deferred.resolve(page);
            });
            return deferred.promise();
        }
    }

    // Make a subclass of ProcessDialog 
    function Dialog(config) {
        Dialog.super.call(this, config);
    }
    OO.inheritClass(Dialog, OO.ui.ProcessDialog);

    // Specify a name for .addWindows()
    Dialog.static.name = 'CreatePageDialog';
    // Specify the static configurations: title and action set
    Dialog.static.title = _config.msg["dialog-title"];
    Dialog.static.actions = [
        {
            flags: 'primary',
            label: _config.msg['continue'],
            action: 'create'
        },
        {
            flags: 'safe',
            label: _config.msg['cancel']
        }
    ];

    // Customize the initialize() function to add content and layouts: 
    Dialog.prototype.initialize = function () {
        Dialog.super.prototype.initialize.call(this);
        this.panel = new OO.ui.PanelLayout({
            padded: true,
            expanded: false
        });
        this.content = new OO.ui.FieldsetLayout();

        /*this.templateInput = new OO.ui.TextInputWidget();

        this.templateField = new OO.ui.FieldLayout(this.templateInput, {
            label: 'Chose a template',
            align: 'top'
        });*/

        //_config.template_autocomplete.onSubmit = (result) => {this.template = result.fulltext; console.log(this.template);};
        var $autocomplete = $('<span>' + _config.msg['template-label'] + '</span><div style="height: auto"><div id="autocomplete"><input class="autocomplete-input"></input><ul class="autocomplete-result-list"></ul></div></div>');
        if (_config.hide_template) $autocomplete.hide();
        this.content.$element.append($autocomplete);
        if (!_config.hide_template_preview) this.content.$element.append('<span>' + _config.msg['template-preview-label'] + '</span><div id="autocomplete-preview" style="height: 400px; border: 1px solid #ccc; border-radius: 8px;"></div>');

        this.titleInput = new OO.ui.TextInputWidget();

        this.field = new OO.ui.FieldLayout(this.titleInput, {
            label: _config.msg['title-label'],
            align: 'top'
        });
        if (_config.hide_title) this.field.$element.hide();

        this.content.addItems([this.field]);
        this.panel.$element.append(this.content.$element);
        this.$body.append(this.panel.$element);

        mwjson.editor.createAutocompleteInput(_config.template_autocomplete);

        this.titleInput.connect(this, { 'change': 'onTitleInputChange' });
    };

    // Specify any additional functionality required by the window (disable creating an empty URL, in this case)
    Dialog.prototype.onTitleInputChange = function (value) {
        this.actions.setAbilities({
            create: !!value.length
        });
    };

    // Specify the dialog height (or don't to use the automatically generated height).
    Dialog.prototype.getBodyHeight = function () {
        // Note that "expanded: false" must be set in the panel's configuration for this to work.
        // When working with a stack layout, you can use:
        //   return this.panels.getCurrentItem().$element.outerHeight( true );
        return this.panel.$element.outerHeight(true);
    };

    // Use getSetupProcess() to set up the window with data passed to it at the time 
    // of opening (e.g., pageTitle: '', in this example). 
    Dialog.prototype.getSetupProcess = function (data) {
        data = data || {};
        return Dialog.super.prototype.getSetupProcess.call(this, data)
            .next(function () {
                // Set up contents based on data
                this.titleInput.setValue(data.pageTitle);
            }, this);
    };

    // Specify processes to handle the actions.
    Dialog.prototype.getActionProcess = function (action) {
        if (action === 'create') {
            // Create a new process to handle the action
            return new OO.ui.Process(function () {
                var title = "";
                if (_config.namespace) title += _config.namespace + ":";
                if (_config.superpage) title += _config.superpage + "/";
                title += this.titleInput.getValue();

                if (_config.template !== "" && !_config.beforeSubmit) _config.beforeSubmit = (targetTitle, template) => { return mwjson.api.copyPage(template, targetTitle, "", _config.modify) };

                if (_config.beforeSubmit) {
                    _config.beforeSubmit(title, _config.template).then(() => {
                        mwjson.api.getPage(title).then((page) => {
                            var url = _config.redirect(page);
                            if (url && url !== "") {
                                if (_config.new_window) window.open(_config.redirect(page)); //new tab
                                else window.location.href = _config.redirect(page); //same tab
                            }
                        });
                    });
                }
                else {
                    mwjson.api.getPage(title).then((page) => {
                        var url = _config.redirect(page);
                        console.log(url);
                        if (url && url !== "") {
                            if (_config.new_window) window.open(_config.redirect(page)); //new tab
                            else window.location.href = _config.redirect(page); //same tab
                        }
                    });
                }

            }, this);
        }
        // Fallback to parent handler
        return Dialog.super.prototype.getActionProcess.call(this, action);
    };

    // Use the getTeardownProcess() method to perform actions whenever the dialog is closed. 
    // This method provides access to data passed into the window's close() method 
    // or the window manager's closeWindow() method.
    Dialog.prototype.getTeardownProcess = function (data) {
        return Dialog.super.prototype.getTeardownProcess.call(this, data)
            .first(function () {
                // Perform any cleanup as needed
                this.manager.$element.remove(); //delete dialog DOM
            }, this);
    };

    // Create and append a window manager.
    var windowManager = new OO.ui.WindowManager();
    $(document.body).append(windowManager.$element);

    // Create a new process dialog window.
    var dialog = new Dialog();

    // Add the window to window manager using the addWindows() method.
    windowManager.addWindows([dialog]);

    // Open the window!   
    windowManager.openWindow(dialog, { pageTitle: _config.title });
}

mwjson.editor.initDataTables = function () {
    mw.loader.using( 'ext.srf.datatables', function(){

    var datatables = new srf.formats.datatables();
    //var _datatables = datatables._datatables;

	var html = mw.html,
		profile = $.client.profile(),
		smwApi = new smw.api(),
		util = new srf.util();

    //from https://github.com/SemanticMediaWiki/SemanticResultFormats/blob/master/formats/datatables/resources/ext.srf.formats.datatables.js#L988
    $( '.srf-datatables' ).each( function() {

        var container = $( this ).find( '.container' );
        console.log(container);
        var id = container.attr('id');
        console.log(id);
        var config = mw.config.get( id );
        console.log(config);
        var _data = smwApi.parse(config);
        console.log(_data);

        var context = $( this ),
            container = context.find( '.container' ),
            //data = smwApi.parse( _datatables.getData( container ) );
            data = smwApi.parse( mw.config.get( container.attr('id') ) );

        // Add bottom element to avoid display clutter on succeeding elements
        $( html.element( 'div', {
            'class': 'bottom',
            'style': 'clear:both'
            }
        ) ).appendTo( context );

        // Adopt directionality which ensures that all elements within its context
        // are appropriately displayed
        context.prop( 'dir', $( 'html' ).attr( 'dir' ) );
        context.prop( 'lang', $( 'html' ).attr( 'lang' ) );

        // Ensures that CSS/JS dependencies are "really" loaded before
        // dataTables gets initialized
        mw.loader.using( 'ext.srf.datatables.' + context.data( 'theme' ), function(){
            datatables.init( context, container, data );

            // Do an auto update if enabled via user-preferences
            if ( datatables.defaults.autoUpdate ) {
                datatables.update( context, data );
            }
        } );

    } );

    });
}