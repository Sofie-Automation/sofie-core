import { isProtectedString } from '../../lib/tempLib.js'
import { RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

enum RundownListDragDropTypes {
	RUNDOWN = 'rundown',
	PLAYLIST = 'playlist',
}

interface IRundownDragObject {
	id: RundownId
	rundownLayouts: Array<RundownLayoutBase>
	isOnlyRundownInPlaylist: boolean
}

function isRundownDragObject(obj: unknown): obj is IRundownDragObject {
	if (!obj) {
		return false
	}

	const { id } = obj as any

	return isProtectedString(id)
}

enum RundownPlaylistUiActionTypes {
	HANDLE_RUNDOWN_DROP = 'HANDLE_RUNDOWN_DROP',
	/* no-op to use when a drop is handled but no further action is necessary */
	NOOP = 'NOOP',
}

interface IRundownPlaylistUiAction {
	type: string
	rundownId: RundownId
	targetPlaylistId?: RundownPlaylistId
}

function isRundownPlaylistUiAction(obj: unknown): obj is IRundownPlaylistUiAction {
	if (!obj) {
		return false
	}

	const { type, rundownId, targetPlaylistId } = obj as any

	if (!isProtectedString(rundownId)) {
		return false
	}

	if (targetPlaylistId && !isProtectedString(targetPlaylistId)) {
		return false
	}

	return typeof type === 'string' && type in RundownPlaylistUiActionTypes
}

export { isRundownDragObject, isRundownPlaylistUiAction, RundownListDragDropTypes, RundownPlaylistUiActionTypes }

export type { IRundownDragObject, IRundownPlaylistUiAction }
