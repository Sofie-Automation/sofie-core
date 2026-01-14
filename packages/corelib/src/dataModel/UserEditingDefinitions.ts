import type {
	UserEditingType,
	JSONBlob,
	JSONSchema,
	UserEditingSourceLayer,
	DefaultUserOperationsTypes,
} from '@sofie-automation/blueprints-integration'
import type { ITranslatableMessage } from '../TranslatableMessage.js'

export type CoreUserEditingDefinition =
	| CoreUserEditingDefinitionAction
	| CoreUserEditingDefinitionForm
	| CoreUserEditingDefinitionSofie

export interface CoreUserEditingDefinitionAction {
	type: UserEditingType.ACTION
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** Icon to show when this action is 'active'.
	 *
	 * This can either be a relative URL to an image in the Blueprints assets or a `data:` URL */
	icon?: string
	/** Icon to show when this action is 'disabled'.
	 *
	 * This can either be a relative URL to an image in the Blueprints assets or a `data:` URL */
	iconInactive?: string
	/** Whether this action should be indicated as being active */
	isActive?: boolean
}

/**
 * A simple form based operation
 */
export interface CoreUserEditingDefinitionForm {
	type: UserEditingType.FORM
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** The json schema describing the form to display */
	schema: JSONBlob<JSONSchema>
	/** Current values to populate the form with */
	currentValues: Record<string, any>
	/** Translation namespaces to use when rendering this form */
	translationNamespaces: string[]
}

export interface CoreUserEditingProperties {
	/**
	 * These properties are dependent on the (primary) piece type, the user will get the option
	 * to select the type of piece (from the SourceLayerTypes i.e. Camera or Split etc.) and then
	 * be presented the corresponding form
	 *
	 * example:
	 * {
	 * 	 schema: {
	 * 	   camera: '{ "type": "object", "properties": { "input": { "type": "number" } } }',
	 * 	   split: '{ "type": "object", ... }',
	 * 	 },
	 *   currentValue: {
	 *     type: 'camera',
	 *     value: {
	 *       input: 3
	 *     },
	 *   }
	 * }
	 */
	pieceTypeProperties?: {
		schema: Record<string, UserEditingSourceLayer>
		currentValue: { type: string; value: Record<string, any> }
	}

	/**
	 * These are properties that are available to edit regardless of the piece type, examples
	 * could be whether it an element is locked from NRCS updates
	 *
	 * if you do not want the piece type to be changed, then use only this field.
	 */
	globalProperties?: { schema: JSONBlob<JSONSchema>; currentValue: Record<string, any> }

	/**
	 * A list of id's of operations to be exposed on the properties panel as buttons. These operations
	 * must be available on the element
	 *
	 * note - perhaps these should have their own full definitions?
	 */
	operations?: CoreUserEditingDefinitionAction[]

	/** Translation namespaces to use when rendering this form */
	translationNamespaces: string[]
}

export interface CoreUserEditingDefinitionSofie {
	type: UserEditingType.SOFIE
	/** Id of this operation */
	id: DefaultUserOperationsTypes
	/**
	 * If true, the operation is limited to the current part.
	 * Only applicable for RETIME_PIECE
	 */
	limitToCurrentPart?: boolean
}
