import { IBlueprintActionManifest } from '@sofie-automation/blueprints-integration'
import { ArrayElement } from '../lib.js'
import { ITranslatableMessage } from '../TranslatableMessage.js'
import { ProtectedStringProperties } from '../protectedString.js'
import { RundownId, AdLibActionId, PartId } from './Ids.js'

/** The following extended interface allows assigning namespace information to the actions as they are stored in the
 *  database after being emitted from the blueprints
 */
export interface AdLibActionCommon extends ProtectedStringProperties<IBlueprintActionManifest, 'partId'> {
	rundownId: RundownId
	display: IBlueprintActionManifest['display'] & {
		// this property can be a string if the name is modified by the User
		label: ITranslatableMessage | string
		triggerLabel?: ITranslatableMessage
		description?: ITranslatableMessage
	}
	triggerModes?: (ArrayElement<IBlueprintActionManifest['triggerModes']> & {
		display: ArrayElement<IBlueprintActionManifest['triggerModes']>['display'] & {
			label: ITranslatableMessage
			description?: ITranslatableMessage
		}
	})[]

	/**
	 * String that can be used to identify adlibs that are equivalent to each other,
	 * if there are multiple Adlibs with the same uniquenessId,
	 * only one of them should be displayed in the GUI.
	 */
	uniquenessId?: string
}

export interface AdLibAction extends AdLibActionCommon {
	_id: AdLibActionId
	partId: PartId
}
