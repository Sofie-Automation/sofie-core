import type { JSONBlob } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import type { ITranslatableMessage } from './translations.js'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import { SourceLayerType } from './content.js'
import { DefaultUserOperationsTypes } from './ingest.js'

/**
 * Description of a user performed editing operation allowed on an document
 */
export type UserEditingDefinition =
	| UserEditingDefinitionAction
	| UserEditingDefinitionForm
	| UserEditingDefinitionSofieDefault

/**
 * A simple 'action' that can be performed
 */
export interface UserEditingDefinitionAction {
	type: UserEditingType.ACTION
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** Icon to show when this action is 'active'
	 *
	 * This can either be a relative URL to an image in the Blueprints assets or a `data:` URL
	 */
	icon?: string
	/** Icon to show when this action is 'disabled'
	 *
	 * This can either be a relative URL to an image in the Blueprints assets or a `data:` URL
	 */
	iconInactive?: string
	/** Whether this action should be indicated as being active */
	isActive?: boolean
}

/**
 * A simple form based operation
 */
export interface UserEditingDefinitionForm {
	type: UserEditingType.FORM
	/** Id of this operation */
	id: string
	/** Label to show to the user for this operation */
	label: ITranslatableMessage
	/** The json schema describing the form to display */
	schema: JSONBlob<JSONSchema>
	/** Current values to populate the form with */
	currentValues: Record<string, any>
}

/**
 * A built in Sofie User operation
 */
export interface UserEditingDefinitionSofieDefault {
	type: UserEditingType.SOFIE
	/** Id of this operation */
	id: DefaultUserOperationsTypes
	/**
	 * If true, the operation is limited to the current part.
	 * Only applicable for RETIME_PIECE
	 */
	limitToCurrentPart?: boolean
}

export enum UserEditingType {
	/** Action */
	ACTION = 'action',
	/** Form */
	FORM = 'form',
	/** Operation for the Built-in Sofie Rich Editing UI */
	SOFIE = 'sofie',
}

export interface UserEditingSourceLayer {
	sourceLayerLabel: string
	sourceLayerType: SourceLayerType
	schema: JSONBlob<JSONSchema>
	defaultValue?: Record<string, any>
}

export interface UserEditingProperties {
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
	 */
	operations?: UserEditingDefinitionAction[]
}
