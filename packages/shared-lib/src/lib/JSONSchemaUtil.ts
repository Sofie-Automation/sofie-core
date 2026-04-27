import { JSONSchema, TypeName } from './JSONSchemaTypes.js'

/**
 * The custom JSONSchema properties we can use for building the UI
 */
export enum SchemaFormUIField {
	/**
	 * Category of the property
	 */
	Category = 'ui:category',
	/**
	 * Title of the property
	 */
	Title = 'ui:title',
	/**
	 * Icon to use for the property, for widgets that support them: `oneOfButtons` in `oneOf` array members
	 */
	Icon = 'ui:icon',
	/**
	 * Description/hint for the property
	 */
	Description = 'ui:description',
	/**
	 * If set, when in a table this property will be used as part of the summary with this label
	 */
	SummaryTitle = 'ui:summaryTitle',
	/**
	 * If an integer property, whether to treat it as zero-based
	 */
	ZeroBased = 'ui:zeroBased',
	/**
	 * Whether the property is read-only. This will disable the input and hide any buttons for modifying the value.
	 */
	ReadOnly = 'ui:readOnly',
	/**
	 * Override the presentation with a special mode.
	 * Currently only valid for:
	 * - object properties. Valid values are `json`, `oneOfButtons`.
	 * 	 - `oneOfButtons` uses a `oneOf` list of possible variants of the object, with a `ui:oneOf:discriminant` field
	 *     to determine which variant is selected.
	 * - string properties. Valid values are `base64-image`.
	 * - boolean properties. Valid values are `switch`.
	 * - number properties. Valid values are `timeMs`.
	 * - array properties with items.type string. Valid values are `bread-crumbs`.
	 */
	DisplayType = 'ui:displayType',
	/**
	 * When using `oneOf` for an object, the discriminant field is used  to determine which variant is selected.
	 * The value of this field must be a property that has a unique const value for each variant in the oneOf
	 */
	OneOfDiscriminant = 'ui:oneOf:discriminant',
	/**
	 * Name of the enum values as generated for the typescript enum.
	 * Future: a new field should probably be added for the UI to use.
	 */
	TsEnumNames = 'tsEnumNames',
	/**
	 * Use a Sofie enum type
	 * Only valid for string properties or arrays of strings
	 * Valid values are 'mappings' and 'source-layers', any other value will result in an empty dropdown
	 */
	SofieEnum = 'ui:sofie-enum',
	/**
	 * When using `ui:sofie-enum`, filter the options by type
	 */
	SofieEnumFilter = 'ui:sofie-enum:filter',
	/**
	 * Whether a table supports being imported and exported
	 * Valid only for tables
	 */
	SupportsImportExport = 'ui:import-export',
}

export function getSchemaUIField(schema: JSONSchema, field: SchemaFormUIField): any {
	return (schema as any)[field]
}

export function getSchemaDefaultValues(schema: JSONSchema | undefined): any {
	switch (schema?.type) {
		case TypeName.Object: {
			const object: any = {}

			for (const [index, prop] of Object.entries<JSONSchema>(schema.properties || {})) {
				object[index] = getSchemaDefaultValues(prop)
			}

			return object
		}
		default:
			return schema?.default
	}
}
