var schema = {
    "title": "TestTemplate",
    "template": "TestTemplate",
    "type": "object",
    "id": "form",
    "properties": {
        "building": {
            "title": "Gebäude",
            "type": "string",
            "description": "reference (autocomplete)",
            "format": "autocomplete",
            "options": {
                "autocomplete": {
                    "search": "search_smw",
                    "getResultValue": "getResultValue_smw",
                    "renderResult": "renderResult_smw",
                    "onSubmit": "onSubmit_smw",
                    "autoSelect": "true"
                }
            },
            "query": "[[Category:LIMS/Location/Building]]|?-IsLocatedIn|?HasName|?HasImage",
            "displayProperty": "HasName",
            "renderProperty": "-IsLocatedIn",
            "renderLabel": "Stockwerke:",
            "previewWikiTextTemplate": "{{#if result.printouts.HasImage.0.fulltext}}[[{{result.printouts.HasImage.0.fulltext}}|right|x66px]]</br>{{/if}}This is a building: [[{{result.fulltext}}]]. Levels: \\{\\{#ask: [[IsLocatedIn::{{result.fulltext}}]]|format=list\\}\\}",
            "default": ""
        },
        "level": {
            "title": "Stockwerk",
            "type": "string",
            "description": "reference (autocomplete)",
            "format": "autocomplete",
            "options": {
                "autocomplete": {
                    "search": "search_smw",
                    "getResultValue": "getResultValue_smw",
                    "renderResult": "renderResult_smw",
                    "onSubmit": "onSubmit_smw",
                    "autoSelect": "true"
                }
            },
            "query": "[[Category:LIMS/Location/Floor]][[IsLocatedIn::$(building)]]|?-IsLocatedIn|?HasImage",
            "watch": {
                "building": "building"
            },
            "renderProperty": "-IsLocatedIn",
            "renderLabel": "Räume:",
            "previewWikiTextTemplate": "{{#if result.printouts.HasImage.0.fulltext}}[[{{result.printouts.HasImage.0.fulltext}}|right|x66px]]</br>{{/if}}This is a building level: [[{{result.fulltext}}]]. Rooms: \\{\\{#ask: [[IsLocatedIn::{{result.fulltext}}]]|format=list\\}\\}",
            "default": ""
        },
        "room": {
            "title": "Raum",
            "type": "string",
            "default": "",
            "format": "autocomplete",
            "options": {
                "autocomplete": {
                    "search": "search_smw",
                    "getResultValue": "getResultValue_smw",
                    "renderResult": "renderResult_smw",
                    "onSubmit": "onSubmit_smw",
                    "autoSelect": "true"
                }
            },
            "query": "[[Category:LIMS/Location/Room]][[IsLocatedIn::$(level)]]|?HasName|?HasImage",
            "watch": {
                "level": "level"
            },
            "renderProperty": "HasName",
            "renderLabel": "Name:",
            "previewWikiTextTemplate": "{{#if result.printouts.HasImage.0.fulltext}}[[{{result.printouts.HasImage.0.fulltext}}|right|x66px]]</br>{{/if}}This is a room: [[{{result.fulltext}}]]. Function: \\{\\{#ask: [[{{result.fulltext}}]]|?HasRoomFunction|format=list\\}\\}",
            "default": ""
        }
    }
}

var schema2 = {
    "title": "Lab Process",
    "template": "OslTemplate:LabProcess/Header",
    "type": "object",
    "id": "process",
    "properties": {
        "id": {
            "title": "ID",
            "type": "string",
            "description": "Short local ID"
        },
        "name": {
            "title": "Name",
            "type": "string",
            "description": "Human readable name"
        },
        /*"creation_data": {
            'type': 'string',
            'format': 'datetime-local',
            //template': 'now',
            //'format': 'flatpickr'
        },*/
        "output_category": {
            "title": "Output category",
            "type": "string",
            "description": "Category/Class of the primary process output",
            "format": "autocomplete",
            "query": "[[IsASubcategoryOf::Category:Thing]] OR [[IsASubcategoryOf.IsASubcategoryOf::Category:Thing]]|?Display_title_of=label",
            "labelTemplate": "{{#if result.printouts.label.length}}{{result.printouts.label}}{{else if result.displaytitle}}{{result.displaytitle}}{{else}}{{result.fulltext}}{{/if}}",
            "previewWikiTextTemplate": "[[:{{result.fulltext}}]]",
            "default": ""
        },
        "output_type": {
            "title": "Output type",
            "type": "string",
            "description": "Type of the primary process output",
            "format": "autocomplete",
            "query": "[[$(category)]]",
            "watch": {
                "category": "output_category"
            },
            "default": ""
        },
        "parameters": {
            "title": "Parameters",
            "type": "array",
            "format": "table",
            "id": "parameters",
            "items": {
                "title": "Parameter",
                "headerTemplate": "{{i}} - {{self.name}}",
                "id": "parameter",
                "properties": {
                    "id": {
                        "title": "ID",
                        "type": "string",
                        "description": "Short local ID",
                        "default": "P0000",
                        "options": {
                            "imask": {
                                "returnUnmasked": true,
                                "mask": "{P}0000",
                                "lazy": false,
                                "placeholderChar": "#"
                            }
                        }
                    },
                    "name": {
                        "title": "Name",
                        "type": "string",
                        "description": "Human readable name"
                    },
                    "property": {
                        "title": "Property",
                        "type": "string",
                        "format": "autocomplete",
                        "query": "[[Category:QuantityProperty]]|?HasDescription",
                        "previewWikiTextTemplate": "[[{{result.fulltext}}]]<br/>{{result.printouts.HasDescription}}",
                    },
                    "nominal_value": {
                        "title": "Nominal Value",
                        "type": "number",
                        "format": "number",
                        "step": 0.1
                    },
                    "actual_value": {
                        "title": "Actual Value",
                        "type": "number",
                        "format": "number",
                        "step": 0.1
                    },
                    "unit": {
                        "title": "Unit",
                        "type": "string",
                        "format": "autocomplete",
                        "query": "[[$(property)]]|?HasInputUnitSymbol",
                        "listProperty": "HasInputUnitSymbol",
                        "previewWikiTextTemplate": "{{result}}",
                        "labelTemplate": "{{result}}",
                        "watch": {
                            "property": "parameter.property"
                        }
                    }
                }
            }
        },
        "objects": {
            "title": "Objects",
            "type": "array",
            "format": "tabs",
            "id": "objects",
            "items": {
                "title": "Object",
                "headerTemplate": "{{i}} - {{self.name}}",
                "id": "object",
                "properties": {
                    "id": {
                        "title": "ID",
                        "type": "string",
                        "description": "Short local ID",
                        "default": "O0010",
                        "imask": {
                            "returnUnmasked": true,
                            "mask": "{O}0000",
                            "lazy": false,
                            "placeholderChar": "#"
                        }
                    },
                    "name": {
                        "title": "Name",
                        "type": "string",
                        "description": "Human readable name"
                    },
                    "category": {
                        "title": "Category",
                        "type": "string",
                        "description": "Category/Class of the primary process output",
                        "format": "autocomplete",
                        "query": "[[IsASubcategoryOf::Category:Thing]] OR [[IsASubcategoryOf.IsASubcategoryOf::Category:Thing]]|?Display_title_of=label",
                        "previewWikiTextTemplate": "[[:{{result.fulltext}}]]",
                        "default": ""
                    },
                    "type": {
                        "title": "Type",
                        "type": "string",
                        "description": "Type of the primary process output",
                        "format": "autocomplete",
                        "query": "[[$(category)]]",
                        "watch": {
                            "category": "object.category"
                        },
                        "default": ""
                    },
                    "count": {
                        "title": "Count",
                        "oneOf": [
                            {
                                "title": "Constant",
                                "type": "integer",
                                "format": "number",
                                "description": "Number of similar objects/batch members",
                                "default": 1
                            },
                            {
                                "title": "Parameter",
                                "type": "string",
                                "description": "Number of similar objects/batch members",
                                "watch": {
                                    "parameters": "process.parameters"
                                },
                                "enumSource": [
                                    {
                                        "source": "parameters",
                                        "title": "{{item.name}}",
                                        "value": "{{item.id}}"
                                    }
                                ]
                            }
                        ]
                    },
                    "global": {
                        "title": "Global",
                        "type": "boolean",
                        "format": "checkbox",
                        "default": false,
                        "description": "Object is global visible and reuseable"
                    }
                }
            }
        },
        "steps": {
            "title": "Process Steps",
            "type": "array",
            "format": "tabs",
            "id": "steps",
            "items": {
                "title": "Step",
                "headerTemplate": "{{i}} - {{self.name}}",
                "options": {
                    "keep_oneof_values": false
                },
                "oneOf": [
                    {
                        "title": "None",
                        "type": "object",
                        "required": [
                            "file_type"
                        ],
                        "properties": {
                            "file_type": {
                                "title": "File type",
                                "type": "string",
                                "enum": ["None"]
                            }
                        }
                    },
                    {
                        "title": "Generic",
                        "template": "OslTemplate:LabProcess/Steps/Generic",
                        "type": "object",
                        "id": "step",
                        "properties": {
                            "id": {
                                "title": "ID",
                                "type": "string",
                                "description": "Short local ID",
                                "default": "S0010",
                                "imask": {
                                    "returnUnmasked": true,
                                    "mask": "{S}0000",
                                    "lazy": false,
                                    "placeholderChar": "#"
                                }
                            },
                            "name": {
                                "title": "Name",
                                "type": "string",
                                "description": "Human readable name"
                            },
                            "predecessor": {
                                "title": "Predecessor",
                                "type": "string",
                                "format": "selectize",
                                "description": "Previous step",
                                "watch": {
                                    "steps": "process.steps"
                                },
                                "enumSource": [
                                    {
                                        "source": "steps",
                                        "title": "{{item.name}}",
                                        "value": "{{item.id}}",
                                        "filter": "{{#when item.id '!==' self.id}}1{{/when}}"
                                    }
                                ]

                            },
                            "input_objects": {
                                "title": "Input Objects",
                                "type": "array",
                                "format": "table",
                                "id": "input_objects",
                                "items": {
                                    "title": "Input Object",
                                    "properties": {
                                        "id": {
                                            "type": "string",
                                            "title": "Object Reference",
                                            "description": "Short local ID",
                                            "watch": {
                                                "objects": "process.objects"
                                            },
                                            "enumSource": [
                                                {
                                                    "source": "objects",
                                                    "title": "{{item.name}}",
                                                    "value": "{{item.id}}"
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            "output_objects": {
                                "title": "Output Objects",
                                "type": "array",
                                "format": "table",
                                "id": "output_objects",
                                "items": {
                                    "title": "Output Object",
                                    "properties": {
                                        "id": {
                                            "type": "string",
                                            "title": "Object Reference",
                                            "description": "Short local ID",
                                            "watch": {
                                                "objects": "process.objects"
                                            },
                                            "enumSource": [
                                                {
                                                    "source": "objects",
                                                    "title": "{{item.name}}",
                                                    "value": "{{item.id}}"
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            "tools": {
                                "title": "Used Devices and Software Tools",
                                "type": "array",
                                "format": "table",
                                "id": "tools",
                                "items": {
                                    "title": "Tool/Device",
                                    "headerTemplate": "{{i}} - {{self.name}}",
                                    "id": "tool",
                                    "properties": {
                                        "id": {
                                            "title": "ID",
                                            "type": "string",
                                            "default": "P0000",
                                            "options": {
                                                "imask": {
                                                    "returnUnmasked": true,
                                                    "mask": "{P}0000",
                                                    "lazy": false,
                                                    "placeholderChar": "#"
                                                }
                                            }
                                        },
                                        "name": {
                                            "title": "Name",
                                            "type": "string",
                                        },
                                        "nominal_category": {
                                            "title": "Category (Nominal)",
                                            "type": "string",
                                            //"description": "Category/Class of the tool/device",
                                            "format": "autocomplete",
                                            "query": "[[IsASubcategoryOf::Category:Tool]] OR [[IsASubcategoryOf.IsASubcategoryOf::Category:Tool]] OR [[IsASubcategoryOf.IsASubcategoryOf.IsASubcategoryOf::Category:Tool]] |?Display_title_of=label",
                                            "previewWikiTextTemplate": "[[:{{result.fulltext}}]]",
                                            "default": ""
                                        },
                                        "nominal_type": {
                                            "title": "Type (Nominal)",
                                            "type": "string",
                                            //"description": "Type of the tool/device",
                                            "format": "autocomplete",
                                            "query": "[[$(category)]]",
                                            "watch": {
                                                "category": "tool.nominal_category"
                                            },
                                            "default": ""
                                        },
                                        "nominal_instance": {
                                            "title": "Instance (Nominal)",
                                            "type": "string",
                                            //"description": "Instance of the tool/device",
                                            "format": "autocomplete",
                                            "query": "[[IsInstanceOf::$(type)]]",
                                            "watch": {
                                                "type": "tool.nominal_type"
                                            },
                                            "default": ""
                                        }
                                    }
                                }
                            },
                            "objects": {
                                "title": "Used Materials/Parts",
                                "type": "array",
                                "format": "table",
                                "id": "objects",
                                "items": {
                                    "title": "Materials/Parts",
                                    "headerTemplate": "{{i}} - {{self.name}}",
                                    "id": "object",
                                    "properties": {
                                        "id": {
                                            "title": "ID",
                                            "type": "string",
                                            "default": "P0000",
                                            "options": {
                                                "imask": {
                                                    "returnUnmasked": true,
                                                    "mask": "{P}0000",
                                                    "lazy": false,
                                                    "placeholderChar": "#"
                                                }
                                            }
                                        },
                                        "name": {
                                            "title": "Name",
                                            "type": "string",
                                        },
                                        "object_id": {
                                            "title": "Object Reference",
                                            "type": "string",
                                            "watch": {
                                                "objects": "process.objects"
                                            },
                                            "enumSource": [
                                                {
                                                    "source": "objects",
                                                    "title": "{{item.name}}",
                                                    "value": "{{item.id}}"
                                                }
                                            ]
                                        },
                                        "nominal_category": {
                                            "title": "Category (Nominal)",
                                            "type": "string",
                                            //"description": "Category/Class of the tool/device",
                                            "format": "autocomplete",
                                            "query": "[[IsASubcategoryOf::Category:Material]] OR [[IsASubcategoryOf.IsASubcategoryOf::Category:Material]] OR [[IsASubcategoryOf.IsASubcategoryOf.IsASubcategoryOf::Category:Material]] |?Display_title_of=label",
                                            "previewWikiTextTemplate": "[[:{{result.fulltext}}]]",
                                            "default": ""
                                        },
                                        "nominal_type": {
                                            "title": "Type (Nominal)",
                                            "type": "string",
                                            //"description": "Type of the tool/device",
                                            "format": "autocomplete",
                                            "query": "[[$(category)]]",
                                            "watch": {
                                                "category": "object.nominal_category"
                                            },
                                            "default": ""
                                        },
                                        "nominal_instance": {
                                            "title": "Instance (Nominal)",
                                            "type": "string",
                                            //"description": "Instance of the tool/device",
                                            "format": "autocomplete",
                                            "query": "[[IsInstanceOf::$(type)]]",
                                            "watch": {
                                                "type": "object.nominal_type"
                                            },
                                            "default": ""
                                        }
                                    }
                                }
                            },
                            "quantitatives": {
                                "title": "Quantitative Parameters",
                                "type": "array",
                                "format": "table",
                                "id": "quantitatives",
                                "items": {
                                    "title": "Quantitative Parameter",
                                    "headerTemplate": "{{i}} - {{self.name}}",
                                    "id": "parameter",
                                    "properties": {
                                        "id": {
                                            "title": "ID",
                                            "type": "string",
                                            "default": "P0000",
                                            "options": {
                                                "imask": {
                                                    "returnUnmasked": true,
                                                    "mask": "{P}0000",
                                                    "lazy": false,
                                                    "placeholderChar": "#"
                                                }
                                            }
                                        },
                                        "name": {
                                            "title": "Name",
                                            "type": "string",
                                        },
                                        "object_id": {
                                            "title": "Object Reference",
                                            "type": "string",
                                            "watch": {
                                                "objects": "process.objects"
                                            },
                                            "enumSource": [
                                                {
                                                    "source": "objects",
                                                    "title": "{{item.name}}",
                                                    "value": "{{item.id}}"
                                                }
                                            ]
                                        },
                                        "property": {
                                            "title": "Property",
                                            "type": "string",
                                            "format": "autocomplete",
                                            "query": "[[Category:QuantityProperty]]|?HasDescription",
                                            "previewWikiTextTemplate": "[[{{result.fulltext}}]]<br/>{{result.printouts.HasDescription}}",
                                        },
                                        "nominal_value": {
                                            "title": "Nominal Value",
                                            "type": "number",
                                            "format": "number",
                                            "step": 0.1
                                        },
                                        "actual_value": {
                                            "title": "Actual Value",
                                            "type": "number",
                                            "format": "number",
                                            "step": 0.1
                                        },
                                        "unit": {
                                            "title": "Unit",
                                            "type": "string",
                                            "format": "autocomplete",
                                            "query": "[[$(property)]]|?HasInputUnitSymbol",
                                            "listProperty": "HasInputUnitSymbol",
                                            "previewWikiTextTemplate": "{{result}}",
                                            "labelTemplate": "{{result}}",
                                            "watch": {
                                                "property": "parameter.property"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }]
            }
        }
    }
}

$(document).ready(function () {

    $.when(
        mw.loader.using('ext.mwjson.util'),
        mw.loader.using('ext.mwjson.api'),
        mw.loader.using('ext.mwjson.parser'),
        mw.loader.using('ext.mwjson.editor'),
        $.Deferred(function (deferred) {
            $(deferred.resolve);
        })
    ).done(function () {
        if ($('.JsonEditor').length) mwjson.editor.init().done(() => {
            $(".JsonEditor").each(function (index) {
                var defaultOptions = {};
                var userOptions = {};

                if (this.dataset.config) userOptions = JSON.parse(this.dataset.config);
                else if (this.innerText !== "") userOptions = JSON.parse(this.innerText); //Legacy support
                var config = { ...defaultOptions, ...userOptions };
                if (!config.schema) config.schema = schema2;
                var editor = new mwjson.editor(this, config, config.schema);
            });
        });
    });
});