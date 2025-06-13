import { Meteor } from 'meteor/meteor'
import { SnapshotId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'

export interface SnapshotsRestAPI {
	/**
	 * Store a System Snapshot.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param options Options of the Snapshot
	 */
	storeSystemSnapshot(
		connection: Meteor.Connection,
		event: string,
		options: APISystemSnapshotOptions
	): Promise<ClientAPI.ClientResponse<SnapshotId>>

	/**
	 * Store a Rundown Playlist snapshot
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param options Options of the Snapshot
	 */
	storePlaylistSnapshot(
		connection: Meteor.Connection,
		event: string,
		options: APIPlaylistSnapshotOptions
	): Promise<ClientAPI.ClientResponse<SnapshotId>>
}

export enum APISnapshotType {
	PLAYLIST = 'playlist',
	SYSTEM = 'system',
}

export interface APISystemSnapshotOptions {
	snapshotType: APISnapshotType.SYSTEM
	reason: string
	studioId?: string
	withDeviceSnapshots?: boolean
}

export interface APIPlaylistSnapshotOptions {
	snapshotType: APISnapshotType.PLAYLIST
	rundownPlaylistId: string
	reason: string
	withTimeline?: boolean
	withArchivedDocuments?: boolean
	withDeviceSnapshots?: boolean
}
