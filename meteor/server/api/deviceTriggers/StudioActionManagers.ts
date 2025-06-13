import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	ExecutableAction,
	ReactivePlaylistActionContext,
} from '@sofie-automation/meteor-lib/dist/triggers/actionFactory'
import { DeviceActionId } from '@sofie-automation/meteor-lib/dist/api/MountedTriggers'

/**
 * `StudioActionManager` allows to store the current, runtime ReactivePlaylistActionContext for a given studio
 * and also store the functions that need to be executed server-side, once an action is triggered. These functions
 * are compiled runtime, based on TriggeredAction configuration and it doesn't make sense to compile them when
 * they are triggered, which potentially can mean a lot of database queries.
 *
 * This also allows to store the "current" context, which is then injected into the actions so that they have a
 * summary of the state of a given Studio/Rundown Playlist.
 */
export class StudioActionManager {
	private allDeviceActions = new Map<DeviceActionId, ExecutableAction>()
	private currentStudioContext: ReactivePlaylistActionContext | undefined

	setAction(actionId: DeviceActionId, action: ExecutableAction): void {
		this.allDeviceActions.set(actionId, action)
	}

	deleteAction(actionId: DeviceActionId): void {
		this.allDeviceActions.delete(actionId)
	}

	getAction(actionId: DeviceActionId): ExecutableAction | undefined {
		return this.allDeviceActions.get(actionId)
	}

	deleteActionsOtherThan(actionId: DeviceActionId[]): void {
		const presentIds = this.allDeviceActions.keys()
		for (const id of presentIds) {
			if (!actionId.includes(id)) {
				this.allDeviceActions.delete(id)
			}
		}
	}

	setContext(context: ReactivePlaylistActionContext): void {
		this.currentStudioContext = context
	}

	deleteContext(): void {
		this.currentStudioContext = undefined
	}

	getContext(): ReactivePlaylistActionContext | undefined {
		return this.currentStudioContext
	}
}

/**
 * A collection of StudioActionManagers for every studio. Items are added and removed from this collection
 * by StudioDeviceTriggerManager instances. The context and cached actions are then used by `receiveInputDeviceTrigger()`
 * in `.\observer.ts`.
 */
export const StudioActionManagers: Map<StudioId, StudioActionManager> = new Map()
