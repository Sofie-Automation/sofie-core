---
sidebar_label: JSON Config Schema
sidebar_position: 7
---

# JSON Config Schema

So that Sofie does not have to be aware of every type of gateway that may connect to it, each gateway provides a manifest describing itself and the configuration fields that it has.

Since version 1.50, this is done using [JSON Schemas](https://json-schema.org/). This allows schemas to be written, with typescript interfaces generated from the schema, and for the same schema to be used to render a flexible UI.
We recommend using [json-schema-to-typescript](https://github.com/bcherny/json-schema-to-typescript) to generate typescript interfaces.

Only a subset of the JSON Schema specification is supported, and some additional properties are used for the UI.

We expect this subset to grow over time as more sections are found to be useful to us, but we may proceed cautiously to avoid constantly breaking other applications that use TSR and these schemas.

## Non-standard properties

We use some non-standard properties to help the UI render with friendly names.

### `ui:category`

Note: Only valid for blueprint configuration.

Category of the property

### `ui:title`

Title of the property

### `ui:description`

Description/hint for the property

### `ui:summaryTitle`

If set, when in a table this property will be used as part of the summary with this label

### `ui:zeroBased`

If an integer property, whether to treat it as zero-based

### `ui:displayType`

Override the presentation with a special mode.

Currently only valid for:

- object properties. Valid values are 'json'.
- string properties. Valid values are 'base64-image'.
- boolean properties. Valid values are 'switch'.

### `tsEnumNames`

This is primarily for `json-schema-to-typescript`.

Names of the enum values as generated for the typescript enum, which we display in the UI instead of the raw values

### `ui:sofie-enum` & `ui:sofie-enum:filter`

Note: Only valid for blueprint configuration.

Sometimes it can be useful to reference other values. This property can be used on string fields, to let Sofie generate a dropdown populated with values valid in the current context.

#### `mappings`

Valid for both show-style and studio blueprint configuration

This will provide a dropdown of all mappings in the studio, or studios where the show-style can be used.

Setting `ui:sofie-enum:filter` to an array of strings will filter the dropdown by the specified DeviceType.

#### `source-layers`

Valid for only show-style blueprint configuration.

This will provide a dropdown of all source-layers in the show-style.

Setting `ui:sofie-enum:filter` to an array of numbers will filter the dropdown by the specified SourceLayerType.

### `ui:import-export`

Valid only for tables, this allows for importing and exporting the contents of the table.

## Supported types

Any JSON Schema property or type is allowed, but will be ignored if it is not supported.

In general, if a `default` is provided, we will use that as a placeholder in the input field.

### `object`

This should be used as the root of your schema, and can be used anywhere inside it. The properties inside any object will be shown if they are supported.

You may want to set the `title` property to generate a typescript interface for it.

See the examples to see how to create a table for an object.

`ui:displayType` can be set to `json` to allow for manual editing of an arbitrary json object.

### `integer`

`enum` can be set with an array of values to turn it into a dropdown.

### `number`

### `boolean`

### `string`

`enum` can be set with an array of values to turn it into a dropdown.

`ui:sofie-enum` can be used to make a special dropdown.

### `array`

The behaviour of this depends on the type of the `items`.

#### `string`

`enum` can be set with an array of values to turn it into a dropdown

`ui:sofie-enum` can be used to make a special dropdown.

Otherwise is treated as a multi-line string, stored as an array of strings.

#### `object`

This is not available in all places we use this schema. For example, Mappings are unable to use this, but device configuration is. Additionally, using it inside of another object-array is not allowed.

## Examples

Below is an example of a simple schema for a gateway configuration. The subdevices are handled separetely, with their own schema.

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"$id": "https://example.com/product.schema.json",
	"title": "Mos Gateway Config",
	"type": "object",
	"properties": {
		"mosId": {
			"type": "string",
			"ui:title": "MOS ID of Mos-Gateway (Sofie MOS ID)",
			"ui:description": "MOS ID of the Sofie MOS device (ie our ID). Example: sofie.mos",
			"default": ""
		},
		"debugLogging": {
			"type": "boolean",
			"ui:title": "Activate Debug Logging",
			"default": false
		}
	},
	"required": ["mosId"],
	"additionalProperties": false
}
```

### Defining a table as an object

In the generated typescript interface, this will produce a property `"TestTable": { [id: string]: TestConfig }`.

The key part here, is that it is an object with no `properties` defined, and a single `patternProperties` value performing a catchall.

An `object` table is better than an `array` in blueprint-configuration, as it allows the UI to override individual values, instead of the table as a whole.

```json
"TestTable": {
    "type": "object",
    "ui:category": "Test",
    "ui:title": "Test table",
    "ui:description": "",
    "patternProperties": {
        "": {
            "type": "object",
            "title": "TestConfig",
            "properties": {
                "number": {
                    "type": "integer",
                    "ui:title": "Number",
                    "ui:description": "Camera number",
                    "ui:summaryTitle": "Number",
                    "default": 1,
                    "min": 0
                },
                "port": {
                    "type": "integer",
                    "ui:title": "Port",
                    "ui:description": "ATEM Port",
                    "default": 1,
                    "min": 0
                }
            },
            "required": ["number", "port"],
            "additionalProperties": false
        }
    },
    "additionalProperties": false
},

```

### Select multiple ATEM device mappings

```json
"mappingId": {
	"type": "array",
	"ui:title": "Mapping",
	"ui:description": "",
	"ui:summaryTitle": "Mapping",
	"items": {
		"type": "string",
		"ui:sofie-enum": "mappings",
		"ui:sofie-enum:filter": ["ATEM"],
	},
	"uniqueItems": true
},
```
