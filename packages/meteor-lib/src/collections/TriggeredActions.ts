import { ITranslatableMessage, SomeAction, SomeBlueprintTrigger } from '@sofie-automation/blueprints-integration'

import { ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ObjectWithOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

export type DBBlueprintTrigger = SomeBlueprintTrigger

export interface UITriggeredActionsObj {
	_id: TriggeredActionId
	/** Rank number for visually ordering the hotkeys */
	_rank: number

	/** Optional label to specify what this triggered action is supposed to do, a comment basically */
	name?: ITranslatableMessage | string

	/** Id of parent ShowStyleBase. If null, this is a system-wide triggered action */
	showStyleBaseId: ShowStyleBaseId | null

	/** Triggers, with attached device info alongside */
	triggers: Record<string, DBBlueprintTrigger>

	/** A list of actions to execute */
	actions: Record<string, SomeAction>

	/** Space separated list of class names to use when displaying this triggered actions */
	styleClassNames?: string
}

export interface DBTriggeredActions {
	_id: TriggeredActionId
	/** Rank number for visually ordering the hotkeys */
	_rank: number

	/** Optional label to specify what this triggered action is supposed to do, a comment basically */
	name?: ITranslatableMessage | string

	/** Id of parent ShowStyleBase. If null, this is a system-wide triggered action */
	showStyleBaseId: ShowStyleBaseId | null

	/** Identifier given by the blueprints for this document. Set to null if owned by the user */
	blueprintUniqueId: string | null

	/** Triggers, with attached device info alongside */
	triggersWithOverrides: ObjectWithOverrides<Record<string, DBBlueprintTrigger>>

	/** A list of actions to execute */
	actionsWithOverrides: ObjectWithOverrides<Record<string, SomeAction>>

	/** Space separated list of class names to use when displaying this triggered actions */
	styleClassNames?: string
}

/** Note: Use DBTriggeredActions instead */
export type TriggeredActionsObj = DBTriggeredActions
