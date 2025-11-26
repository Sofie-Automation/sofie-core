import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { logger } from '../../../logging'
import { APIFactory, APIRegisterHook, ServerAPIContext } from './types'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	AdLibActionId,
	BucketAdLibId,
	BucketId,
	PartId,
	PartInstanceId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Match, check } from '../../../lib/check'
import { PlaylistsRestAPI } from '../../../lib/rest/v1'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import {
	AdLibActions,
	AdLibPieces,
	BucketAdLibActions,
	BucketAdLibs,
	Buckets,
	Parts,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownPlaylists,
	Segments,
} from '../../../collections'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ServerClientAPI } from '../../client'
import { QueueNextSegmentResult, StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { getCurrentTime } from '../../../lib/lib'
import { TriggerReloadDataResponse } from '@sofie-automation/meteor-lib/dist/api/userActions'
import { ServerRundownAPI } from '../../rundown'
import { triggerWriteAccess } from '../../../security/securityVerify'

class PlaylistsServerAPI implements PlaylistsRestAPI {
	constructor(private context: ServerAPIContext) {}

	private async findPlaylist(playlistId: RundownPlaylistId) {
		const playlist = await RundownPlaylists.findOneAsync({
			$or: [{ _id: playlistId }, { externalId: playlistId }],
		})
		if (!playlist) {
			throw new Meteor.Error(404, `Playlist ID '${playlistId}' was not found`)
		}
		return playlist
	}

	private async findSegment(segmentId: SegmentId) {
		const segment = await Segments.findOneAsync({
			$or: [
				{
					_id: segmentId,
				},
				{
					externalId: segmentId,
				},
			],
		})
		if (!segment) {
			throw new Meteor.Error(404, `Segment ID '${segmentId}' was not found`)
		}
		return segment
	}

	private async findPart(partId: PartId) {
		const part = await Parts.findOneAsync({
			$or: [
				{ _id: partId },
				{
					externalId: partId,
				},
			],
		})
		if (!part) {
			throw new Meteor.Error(404, `Part ID '${partId}' was not found`)
		}
		return part
	}

	async getAllRundownPlaylists(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string; externalId: string }>>> {
		const rundownPlaylists = (await RundownPlaylists.findFetchAsync(
			{},
			{ projection: { _id: 1, externalId: 1 } }
		)) as Array<Pick<DBRundownPlaylist, '_id' | 'externalId'>>
		return ClientAPI.responseSuccess(
			rundownPlaylists.map((rundownPlaylist) => ({
				id: unprotectString(rundownPlaylist._id),
				externalId: rundownPlaylist.externalId,
			}))
		)
	}

	async activate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	): Promise<ClientAPI.ClientResponse<void>> {
		const playlist = await this.findPlaylist(rundownPlaylistId)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
				check(rehearsal, Boolean)
			},
			StudioJobs.ActivateRundownPlaylist,
			{
				playlistId: playlist._id,
				rehearsal,
			}
		)
	}

	async deactivate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		const playlist = await this.findPlaylist(rundownPlaylistId)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
			},
			StudioJobs.DeactivateRundownPlaylist,
			{
				playlistId: playlist._id,
			}
		)
	}

	async executeAdLib(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		adLibId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId,
		triggerMode?: string | null,
		adLibOptions?: { [key: string]: any }
	): Promise<ClientAPI.ClientResponse<object>> {
		const baselineAdLibPiece = RundownBaselineAdLibPieces.findOneAsync(adLibId as PieceId, {
			projection: { _id: 1 },
		})
		const segmentAdLibPiece = AdLibPieces.findOneAsync(adLibId as PieceId, { projection: { _id: 1 } })
		const bucketAdLibPiece = BucketAdLibs.findOneAsync(adLibId as BucketAdLibId, { projection: { _id: 1 } })
		const [baselineAdLibDoc, segmentAdLibDoc, bucketAdLibDoc, adLibAction, baselineAdLibAction] = await Promise.all(
			[
				baselineAdLibPiece,
				segmentAdLibPiece,
				bucketAdLibPiece,
				AdLibActions.findOneAsync(adLibId as AdLibActionId, {
					projection: { _id: 1, actionId: 1, userData: 1 },
				}),
				RundownBaselineAdLibActions.findOneAsync(adLibId as RundownBaselineAdLibActionId, {
					projection: { _id: 1, actionId: 1, userData: 1 },
				}),
			]
		)
		const adLibActionDoc = adLibAction ?? baselineAdLibAction
		const regularAdLibDoc = baselineAdLibDoc ?? segmentAdLibDoc ?? bucketAdLibDoc
		if (regularAdLibDoc) {
			// This is an AdLib Piece
			const pieceType = baselineAdLibDoc ? 'baseline' : segmentAdLibDoc ? 'normal' : 'bucket'
			const rundownPlaylist = await RundownPlaylists.findOneAsync(
				{ $or: [{ _id: rundownPlaylistId }, { externalId: rundownPlaylistId }] },
				{
					projection: { currentPartInfo: 1 },
				}
			)
			if (!rundownPlaylist)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist does not exist`),
						UserErrorMessage.RundownPlaylistNotFound,
						undefined,
						404
					)
				)
			if (rundownPlaylist.currentPartInfo === null)
				return ClientAPI.responseError(
					UserError.from(
						Error(`No active Part in ${rundownPlaylistId}`),
						UserErrorMessage.PartNotFound,
						undefined,
						412
					)
				)

			const result = await ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this.context.getMethodContext(connection),
				event,
				getCurrentTime(),
				rundownPlaylist._id,
				() => {
					check(rundownPlaylist._id, String)
					check(adLibId, Match.OneOf(String, null))
				},
				StudioJobs.AdlibPieceStart,
				{
					playlistId: rundownPlaylist._id,
					adLibPieceId: regularAdLibDoc._id,
					partInstanceId: rundownPlaylist.currentPartInfo.partInstanceId,
					pieceType,
				}
			)
			if (ClientAPI.isClientResponseError(result)) return result
			return ClientAPI.responseSuccess({})
		} else if (adLibActionDoc) {
			// This is an AdLib Action
			const rundownPlaylist = await RundownPlaylists.findOneAsync(
				{ $or: [{ _id: rundownPlaylistId }, { externalId: rundownPlaylistId }] },
				{
					projection: { currentPartInfo: 1, activationId: 1 },
				}
			)

			if (!rundownPlaylist)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist does not exist`),
						UserErrorMessage.RundownPlaylistNotFound,
						undefined,
						404
					)
				)
			if (!rundownPlaylist.activationId)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist ${rundownPlaylistId} is not currently active`),
						UserErrorMessage.InactiveRundown,
						undefined,
						412
					)
				)
			if (!rundownPlaylist.currentPartInfo)
				return ClientAPI.responseError(
					UserError.from(
						new Error(`Rundown playlist ${rundownPlaylistId} must be playing`),
						UserErrorMessage.NoCurrentPart,
						undefined,
						412
					)
				)

			return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this.context.getMethodContext(connection),
				event,
				getCurrentTime(),
				rundownPlaylist._id,
				() => {
					check(rundownPlaylist._id, String)
					check(adLibId, Match.OneOf(String, null))
				},
				StudioJobs.ExecuteAction,
				{
					playlistId: rundownPlaylist._id,
					actionDocId: adLibActionDoc._id,
					actionId: adLibActionDoc.actionId,
					userData: adLibActionDoc.userData,
					triggerMode: triggerMode ?? undefined,
					actionOptions: adLibOptions,
				}
			)
		} else {
			return ClientAPI.responseError(
				UserError.from(new Error(`No adLib with Id ${adLibId}`), UserErrorMessage.AdlibNotFound, undefined, 412)
			)
		}
	}

	async executeBucketAdLib(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		bucketId: BucketId,
		externalId: string,
		triggerMode?: string | null
	): Promise<ClientAPI.ClientResponse<object>> {
		const playlist = await this.findPlaylist(rundownPlaylistId)

		const bucketPromise = Buckets.findOneAsync(bucketId, { projection: { _id: 1 } })
		const bucketAdlibPromise = BucketAdLibs.findOneAsync({ bucketId, externalId }, { projection: { _id: 1 } })
		const bucketAdlibActionPromise = BucketAdLibActions.findOneAsync(
			{ bucketId, externalId },
			{
				projection: { _id: 1 },
			}
		)
		const [bucket, bucketAdlib, bucketAdlibAction] = await Promise.all([
			bucketPromise,
			bucketAdlibPromise,
			bucketAdlibActionPromise,
		])
		if (!bucket) {
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Bucket ${bucketId} not found`),
					UserErrorMessage.BucketNotFound,
					undefined,
					412
				)
			)
		}
		if (!bucketAdlib && !bucketAdlibAction) {
			return ClientAPI.responseError(
				UserError.from(
					new Error(`No adLib with Id ${externalId}, in bucket ${bucketId}`),
					UserErrorMessage.AdlibNotFound,
					undefined,
					412
				)
			)
		}

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
				check(bucketId, String)
				check(externalId, String)
			},
			StudioJobs.ExecuteBucketAdLibOrAction,
			{
				playlistId: playlist._id,
				bucketId,
				externalId,
				triggerMode: triggerMode ?? undefined,
			}
		)
	}

	async moveNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number,
		ignoreQuickLoop?: boolean
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		const playlist = await this.findPlaylist(rundownPlaylistId)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
				check(delta, Number)
			},
			StudioJobs.MoveNextPart,
			{
				playlistId: playlist._id,
				partDelta: delta,
				segmentDelta: 0,
				ignoreQuickLoop,
			}
		)
	}

	async moveNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		const playlist = await this.findPlaylist(rundownPlaylistId)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
				check(delta, Number)
			},
			StudioJobs.MoveNextPart,
			{
				playlistId: playlist._id,
				partDelta: 0,
				segmentDelta: delta,
			}
		)
	}

	async reloadPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		const playlist = await this.findPlaylist(rundownPlaylistId)

		return ServerClientAPI.runUserActionInLogForPlaylist<void>(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
			},
			'reloadPlaylist',
			{ rundownPlaylistId: playlist._id },
			async (access) => {
				const reloadResponse = await ServerRundownAPI.resyncRundownPlaylist(access)
				const success = !reloadResponse.rundownsResponses.reduce((missing, rundownsResponse) => {
					return missing || rundownsResponse.response === TriggerReloadDataResponse.MISSING
				}, false)
				if (!success)
					throw UserError.from(
						new Error(`Failed to reload playlist ${playlist._id}`),
						UserErrorMessage.InternalError
					)
			}
		)
	}

	async resetPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		const playlist = await this.findPlaylist(rundownPlaylistId)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
			},
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: playlist._id,
			}
		)
	}
	async setNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId
	): Promise<ClientAPI.ClientResponse<PartId>> {
		const playlist = await this.findPlaylist(rundownPlaylistId)
		const segment = await this.findSegment(segmentId)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
				check(segment._id, String)
			},
			StudioJobs.SetNextSegment,
			{
				playlistId: playlist._id,
				nextSegmentId: segment._id,
			}
		)
	}
	async setNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId
	): Promise<ClientAPI.ClientResponse<void>> {
		const playlist = await this.findPlaylist(rundownPlaylistId)
		const part = await this.findPart(partId)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
				check(part._id, String)
			},
			StudioJobs.SetNextPart,
			{
				playlistId: playlist._id,
				nextPartId: part._id,
			}
		)
	}

	async queueNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId
	): Promise<ClientAPI.ClientResponse<QueueNextSegmentResult>> {
		const playlist = await this.findPlaylist(rundownPlaylistId)
		const segment = await this.findSegment(segmentId)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
				check(segment._id, String)
			},
			StudioJobs.QueueNextSegment,
			{
				playlistId: playlist._id,
				queuedSegmentId: segment._id,
			}
		)
	}

	async take(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		fromPartInstanceId: PartInstanceId | undefined
	): Promise<ClientAPI.ClientResponse<void>> {
		triggerWriteAccess()
		const playlist = await this.findPlaylist(rundownPlaylistId)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
			},
			StudioJobs.TakeNextPart,
			{
				playlistId: playlist._id,
				fromPartInstanceId: fromPartInstanceId ?? playlist.currentPartInfo?.partInstanceId ?? null,
			}
		)
	}

	async clearSourceLayers(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerIds: string[]
	): Promise<ClientAPI.ClientResponse<void>> {
		const playlist = await this.findPlaylist(rundownPlaylistId)
		if (!playlist)
			return ClientAPI.responseError(
				UserError.from(
					Error(`Rundown playlist ${rundownPlaylistId} does not exist`),
					UserErrorMessage.RundownPlaylistNotFound,
					undefined,
					412
				)
			)
		if (!playlist.currentPartInfo?.partInstanceId || !playlist.activationId)
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Rundown playlist ${rundownPlaylistId} is not currently active`),
					UserErrorMessage.InactiveRundown,
					undefined,
					412
				)
			)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
				check(sourceLayerIds, [String])
			},
			StudioJobs.StopPiecesOnSourceLayers,
			{
				playlistId: playlist._id,
				partInstanceId: playlist.currentPartInfo.partInstanceId,
				sourceLayerIds: sourceLayerIds,
			}
		)
	}

	async recallStickyPiece(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		const playlist = await this.findPlaylist(rundownPlaylistId)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			playlist._id,
			() => {
				check(playlist._id, String)
				check(sourceLayerId, String)
			},
			StudioJobs.StartStickyPieceOnSourceLayer,
			{
				playlistId: playlist._id,
				sourceLayerId,
			}
		)
	}
}

class PlaylistsAPIFactory implements APIFactory<PlaylistsRestAPI> {
	createServerAPI(context: ServerAPIContext): PlaylistsRestAPI {
		return new PlaylistsServerAPI(context)
	}
}

export function registerRoutes(registerRoute: APIRegisterHook<PlaylistsRestAPI>): void {
	const playlistsAPIFactory = new PlaylistsAPIFactory()

	registerRoute<never, never, Array<{ id: string }>>(
		'get',
		'/playlists',
		new Map(),
		playlistsAPIFactory,
		async (serverAPI, connection, event, _params, _body) => {
			logger.info(`API GET: playlists`)
			return await serverAPI.getAllRundownPlaylists(connection, event)
		}
	)

	registerRoute<{ playlistId: string }, { rehearsal: boolean }, void>(
		'put',
		'/playlists/:playlistId/activate',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.RundownAlreadyActive]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const rehearsal = body.rehearsal
			logger.info(`API PUT: activate ${rundownPlaylistId} - ${rehearsal ? 'rehearsal' : 'live'}`)

			check(rundownPlaylistId, String)
			return await serverAPI.activate(connection, event, rundownPlaylistId, rehearsal)
		}
	)

	registerRoute<{ playlistId: string }, never, void>(
		'put',
		'/playlists/:playlistId/deactivate',
		new Map([[404, [UserErrorMessage.RundownPlaylistNotFound]]]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			logger.info(`API PUT: deactivate ${rundownPlaylistId}`)

			check(rundownPlaylistId, String)
			return await serverAPI.deactivate(connection, event, rundownPlaylistId)
		}
	)

	registerRoute<{ playlistId: string }, { adLibId: string; actionType?: string; adLibOptions?: any }, object>(
		'post',
		'/playlists/:playlistId/execute-adlib',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.InactiveRundown, UserErrorMessage.NoCurrentPart, UserErrorMessage.AdlibNotFound]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const adLibId = protectString<AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId>(
				body.adLibId
			)
			const actionTypeObj = body
			const triggerMode = actionTypeObj ? (actionTypeObj as { actionType: string }).actionType : undefined
			const adLibOptions = actionTypeObj ? actionTypeObj.adLibOptions : undefined
			logger.info(
				`API POST: execute-adlib ${rundownPlaylistId} ${adLibId} - actionType: ${triggerMode} - options: ${
					adLibOptions ? JSON.stringify(adLibOptions) : 'undefined'
				}`
			)

			check(adLibId, String)
			check(rundownPlaylistId, String)

			return await serverAPI.executeAdLib(
				connection,
				event,
				rundownPlaylistId,
				adLibId,
				triggerMode,
				adLibOptions
			)
		}
	)

	registerRoute<{ playlistId: string }, { bucketId: string; externalId: string; actionType?: string }, object>(
		'post',
		'/playlists/:playlistId/execute-bucket-adlib',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[
				412,
				[
					UserErrorMessage.InactiveRundown,
					UserErrorMessage.NoCurrentPart,
					UserErrorMessage.AdlibNotFound,
					UserErrorMessage.BucketNotFound,
				],
			],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const bucketId = protectString<BucketId>(body.bucketId)
			const adLibExternalId = body.externalId
			const actionTypeObj = body
			const triggerMode = actionTypeObj ? (actionTypeObj as { actionType: string }).actionType : undefined
			logger.info(
				`API POST: execute-bucket-adlib ${rundownPlaylistId} ${bucketId} ${adLibExternalId} - triggerMode: ${triggerMode}`
			)

			check(rundownPlaylistId, String)
			check(bucketId, String)
			check(adLibExternalId, String)

			return await serverAPI.executeBucketAdLib(
				connection,
				event,
				rundownPlaylistId,
				bucketId,
				adLibExternalId,
				triggerMode
			)
		}
	)

	registerRoute<{ playlistId: string }, { delta: number }, PartId | null>(
		'post',
		'/playlists/:playlistId/move-next-part',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.PartNotFound]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const delta = body.delta
			logger.info(`API POST: move-next-part ${rundownPlaylistId} ${delta}`)

			check(rundownPlaylistId, String)
			check(delta, Number)
			return await serverAPI.moveNextPart(connection, event, rundownPlaylistId, delta)
		}
	)

	registerRoute<{ playlistId: string }, { delta: number }, PartId | null>(
		'post',
		'/playlists/:playlistId/move-next-segment',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.PartNotFound]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const delta = body.delta
			logger.info(`API POST: move-next-segment ${rundownPlaylistId} ${delta}`)

			check(rundownPlaylistId, String)
			check(delta, Number)
			return await serverAPI.moveNextSegment(connection, event, rundownPlaylistId, delta)
		}
	)

	registerRoute<{ playlistId: string }, never, void>(
		'put',
		'/playlists/:playlistId/reload-playlist',
		new Map([[404, [UserErrorMessage.RundownPlaylistNotFound]]]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			logger.info(`API PUT: reload-playlist ${rundownPlaylistId}`)

			check(rundownPlaylistId, String)
			return await serverAPI.reloadPlaylist(connection, event, rundownPlaylistId)
		}
	)

	registerRoute<{ playlistId: string }, never, void>(
		'put',
		'/playlists/:playlistId/reset-playlist',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.RundownResetWhileActive]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			logger.info(`API PUT: reset-playlist ${rundownPlaylistId}`)

			check(rundownPlaylistId, String)
			return await serverAPI.resetPlaylist(connection, event, rundownPlaylistId)
		}
	)

	registerRoute<{ playlistId: string }, { partId: string }, void>(
		'put',
		'/playlists/:playlistId/set-next-part',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.PartNotFound]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const partId = protectString<PartId>(body.partId)
			logger.info(`API PUT: set-next-part ${rundownPlaylistId} ${partId}`)

			check(rundownPlaylistId, String)
			check(partId, String)
			return await serverAPI.setNextPart(connection, event, rundownPlaylistId, partId)
		}
	)

	registerRoute<{ playlistId: string }, { segmentId: string }, PartId | null>(
		'post',
		'/playlists/:playlistId/set-next-segment',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.PartNotFound]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const segmentId = protectString<SegmentId>(body.segmentId)
			logger.info(`API PUT: set-next-segment ${rundownPlaylistId} ${segmentId}`)

			check(rundownPlaylistId, String)
			check(segmentId, String)
			return await serverAPI.setNextSegment(connection, event, rundownPlaylistId, segmentId)
		}
	)

	registerRoute<{ playlistId: string }, { segmentId: string }, QueueNextSegmentResult>(
		'post',
		'/playlists/:playlistId/queue-next-segment',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.PartNotFound]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const segmentId = protectString<SegmentId>(body.segmentId)
			logger.info(`API POST: set-next-segment ${rundownPlaylistId} ${segmentId}`)

			check(rundownPlaylistId, String)
			check(segmentId, String)
			return await serverAPI.queueNextSegment(connection, event, rundownPlaylistId, segmentId)
		}
	)

	registerRoute<{ playlistId: string }, { fromPartInstanceId?: string }, void>(
		'post',
		'/playlists/:playlistId/take',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.TakeNoNextPart]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const rundownPlaylistId = protectString<RundownPlaylistId>(params.playlistId)
			const fromPartInstanceId = body.fromPartInstanceId
			logger.info(`API POST: take ${rundownPlaylistId}`)

			check(rundownPlaylistId, String)
			check(fromPartInstanceId, Match.Optional(String))
			return await serverAPI.take(connection, event, rundownPlaylistId, protectString(fromPartInstanceId))
		}
	)

	registerRoute<{ playlistId: string }, { sourceLayerIds: string[] }, void>(
		'put',
		'/playlists/:playlistId/clear-sourcelayers',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.InactiveRundown]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const playlistId = protectString<RundownPlaylistId>(params.playlistId)
			const sourceLayerIds = body?.sourceLayerIds
			logger.info(`API POST: clear-sourcelayers ${playlistId} ${sourceLayerIds}`)

			check(playlistId, String)
			check(sourceLayerIds, Array<string>)

			return await serverAPI.clearSourceLayers(connection, event, playlistId, sourceLayerIds)
		}
	)

	registerRoute<{ playlistId: string; sourceLayerId: string }, never, void>(
		'delete',
		'/playlists/:playlistId/sourceLayer/:sourceLayerId',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.InactiveRundown]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const playlistId = protectString<RundownPlaylistId>(params.playlistId)
			const sourceLayerId = params.sourceLayerId
			logger.info(`API DELETE: sourceLayer ${playlistId} ${sourceLayerId}`)

			check(playlistId, String)
			check(sourceLayerId, String)
			return await serverAPI.clearSourceLayers(connection, event, playlistId, [sourceLayerId])
		}
	)

	registerRoute<{ playlistId: string; sourceLayerId: string }, never, void>(
		'post',
		'/playlists/:playlistId/sourceLayer/:sourceLayerId/sticky',
		new Map([
			[404, [UserErrorMessage.RundownPlaylistNotFound]],
			[412, [UserErrorMessage.InactiveRundown]],
		]),
		playlistsAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const playlistId = protectString<RundownPlaylistId>(params.playlistId)
			const sourceLayerId = params.sourceLayerId
			logger.info(`API POST: sourceLayer recallSticky ${playlistId} ${sourceLayerId}`)

			check(playlistId, String)
			check(sourceLayerId, String)
			return await serverAPI.recallStickyPiece(connection, event, playlistId, sourceLayerId)
		}
	)
}
