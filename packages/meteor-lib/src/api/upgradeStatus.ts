import { ITranslatableMessage } from '@sofie-automation/blueprints-integration'
import { StudioId, ShowStyleBaseId, CoreSystemId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'

export type UIBlueprintUpgradeStatusId = ProtectedString<'UIBlueprintUpgradeStatus'>

export type UIBlueprintUpgradeStatus =
	| UIBlueprintUpgradeStatusCoreSystem
	| UIBlueprintUpgradeStatusStudio
	| UIBlueprintUpgradeStatusShowStyle

export interface UIBlueprintUpgradeStatusBase {
	_id: UIBlueprintUpgradeStatusId

	documentType: 'coreSystem' | 'studio' | 'showStyle'
	documentId: CoreSystemId | StudioId | ShowStyleBaseId

	name: string

	/**
	 * If set, there is something wrong that must be resolved before the config can be validated or applied
	 */
	invalidReason?: ITranslatableMessage

	/**
	 * Whether the 'fixup' must be run before the config can be validated or applied
	 */
	pendingRunOfFixupFunction: boolean

	/**
	 * User facing list of changes to be reviewed
	 */
	changes: ITranslatableMessage[]
}

export interface UIBlueprintUpgradeStatusCoreSystem extends UIBlueprintUpgradeStatusBase {
	documentType: 'coreSystem'
	documentId: CoreSystemId
}

export interface UIBlueprintUpgradeStatusStudio extends UIBlueprintUpgradeStatusBase {
	documentType: 'studio'
	documentId: StudioId
}
export interface UIBlueprintUpgradeStatusShowStyle extends UIBlueprintUpgradeStatusBase {
	documentType: 'showStyle'
	documentId: ShowStyleBaseId
}
