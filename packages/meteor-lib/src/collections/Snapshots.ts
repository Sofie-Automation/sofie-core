import { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { SnapshotId, StudioId, RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export enum SnapshotType {
	RUNDOWNPLAYLIST = 'rundownplaylist',
	SYSTEM = 'system',
	DEBUG = 'debug',
}

export interface SnapshotBase {
	_id: SnapshotId

	type: SnapshotType
	created: Time
	name: string
	description?: string
	/** Version of the system that took the snapshot */
	version: string
}

export interface SnapshotItem extends SnapshotBase {
	fileName: string
	comment: string

	studioId?: StudioId
	rundownId?: RundownId
	playlistId?: RundownPlaylistId
}

export interface SnapshotRundownPlaylist extends SnapshotBase {
	type: SnapshotType.RUNDOWNPLAYLIST
	studioId: StudioId
	playlistId: RundownPlaylistId
}
export interface SnapshotSystem extends SnapshotBase {
	type: SnapshotType.SYSTEM
}
export interface SnapshotDebug extends SnapshotBase {
	type: SnapshotType.DEBUG
}
