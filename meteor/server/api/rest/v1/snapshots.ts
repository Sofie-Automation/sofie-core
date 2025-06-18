import { Meteor } from 'meteor/meteor'
import { SnapshotId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check } from 'meteor/check'
import { APIFactory, APIRegisterHook, ServerAPIContext } from './types'
import { logger } from '../../../logging'
import { storeRundownPlaylistSnapshot, storeSystemSnapshot } from '../../snapshot'
import { makeIdempotent, makeRateLimited } from './middlewares'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { playlistSnapshotOptionsFrom, systemSnapshotOptionsFrom } from './typeConversion'
import {
	APIPlaylistSnapshotOptions,
	APISnapshotType,
	APISystemSnapshotOptions,
	SnapshotsRestAPI,
} from '../../../lib/rest/v1'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { checkAccessToPlaylist } from '../../../security/check'

export class SnapshotsServerAPI implements SnapshotsRestAPI {
	constructor(private context: ServerAPIContext) {}

	async storeSystemSnapshot(
		connection: Meteor.Connection,
		_event: string,
		options: APISystemSnapshotOptions
	): Promise<ClientAPI.ClientResponse<SnapshotId>> {
		check(options.reason, String)
		return ClientAPI.responseSuccess(
			await storeSystemSnapshot(
				this.context.getMethodContext(connection),
				systemSnapshotOptionsFrom(options),
				options.reason
			)
		)
	}

	async storePlaylistSnapshot(
		connection: Meteor.Connection,
		_event: string,
		options: APIPlaylistSnapshotOptions
	): Promise<ClientAPI.ClientResponse<SnapshotId>> {
		const playlistId = protectString(options.rundownPlaylistId)
		check(playlistId, String)
		check(options.reason, String)
		const access = await checkAccessToPlaylist(connection, playlistId)
		return ClientAPI.responseSuccess(
			await storeRundownPlaylistSnapshot(access, playlistSnapshotOptionsFrom(options), options.reason)
		)
	}
}

class SnapshotsAPIFactory implements APIFactory<SnapshotsRestAPI> {
	createServerAPI(context: ServerAPIContext): SnapshotsRestAPI {
		return new SnapshotsServerAPI(context)
	}
}

const SNAPSHOT_RESOURCE = 'snapshot'

export function registerRoutes(registerRoute: APIRegisterHook<SnapshotsRestAPI>): void {
	const snapshotsApiFactory = new SnapshotsAPIFactory()

	registerRoute<never, APISystemSnapshotOptions | APIPlaylistSnapshotOptions, SnapshotId>(
		'post',
		'/snapshots',
		new Map(),
		snapshotsApiFactory,
		makeRateLimited(
			makeIdempotent(async (serverAPI, connection, event, _params, body) => {
				if (body.snapshotType === APISnapshotType.SYSTEM) {
					logger.info(`API POST: Store System Snapshot`)
					return await serverAPI.storeSystemSnapshot(connection, event, body)
				} else if (body.snapshotType === APISnapshotType.PLAYLIST) {
					logger.info(`API POST: Store Playlist Snapshot`)
					return await serverAPI.storePlaylistSnapshot(connection, event, body)
				}
				throw new Meteor.Error(400, `Invalid snapshot type`)
			}),
			SNAPSHOT_RESOURCE
		)
	)
}
