import { check, Match } from '../lib/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { ServerPlayoutAPI } from './playout/playout'
import { NewUserActionAPI, UserActionAPIMethods } from '@sofie-automation/meteor-lib/dist/api/userActions'
import { EvaluationBase } from '@sofie-automation/meteor-lib/dist/collections/Evaluations'
import { IngestPart, IngestAdlib, ActionUserData, UserOperationTarget } from '@sofie-automation/blueprints-integration'
import { storeRundownPlaylistSnapshot } from './snapshot'
import { registerClassToMeteorMethods, ReplaceOptionalWithNullInMethodArguments } from '../methods'
import { ServerRundownAPI } from './rundown'
import { saveEvaluation } from './evaluations'
import { MOSDeviceActions } from './ingest/mosDevice/actions'
import { MethodContextAPI } from './methodContext'
import { ServerClientAPI } from './client'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { BucketsAPI } from './buckets'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { AdLibActionCommon } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import * as PackageManagerAPI from './packageManager'
import { ServerPeripheralDeviceAPI } from './peripheralDevice'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import {
	AdLibActionId,
	BucketAdLibActionId,
	BucketAdLibId,
	BucketId,
	PartId,
	PartInstanceId,
	PeripheralDeviceId,
	PieceId,
	PieceInstanceId,
	RundownBaselineAdLibActionId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { NrcsIngestDataCache, Parts, Pieces, Rundowns } from '../collections'
import { NrcsIngestCacheType } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import { verifyHashedToken } from './singleUseTokens'
import { QuickLoopMarker } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { runIngestOperation } from './ingest/lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { assertConnectionHasOneOfPermissions } from '../security/auth'
import { checkAccessToRundown } from '../security/check'

const PERMISSIONS_FOR_PLAYOUT_USERACTION: Array<keyof UserPermissions> = ['studio']
const PERMISSIONS_FOR_BUCKET_MODIFICATION: Array<keyof UserPermissions> = ['studio']
const PERMISSIONS_FOR_MEDIA_MANAGEMENT: Array<keyof UserPermissions> = ['studio', 'service', 'configure']
const PERMISSIONS_FOR_SYSTEM_ACTION: Array<keyof UserPermissions> = ['service', 'configure']

async function pieceSetInOutPoints(
	playlistId: RundownPlaylistId,
	partId: PartId,
	pieceId: PieceId,
	inPoint: number,
	duration: number
): Promise<void> {
	const part = await Parts.findOneAsync(partId)
	if (!part) throw new Meteor.Error(404, `Part "${partId}" not found!`)

	const rundown = await Rundowns.findOneAsync({
		_id: part.rundownId,
		playlistId: playlistId,
	})
	if (!rundown) throw new Meteor.Error(501, `Rundown "${part.rundownId}" not found!`)

	const partCache = await NrcsIngestDataCache.findOneAsync({
		rundownId: rundown._id,
		partId: part._id,
		type: NrcsIngestCacheType.PART,
	})
	if (!partCache) throw new Meteor.Error(404, `Part Cache for "${partId}" not found!`)
	const piece = await Pieces.findOneAsync(pieceId)
	if (!piece) throw new Meteor.Error(404, `Piece "${pieceId}" not found!`)

	// TODO: replace this with a general, non-MOS specific method

	await MOSDeviceActions.setPieceInOutPoint(
		rundown,
		piece,
		partCache.data as IngestPart,
		inPoint / 1000,
		duration / 1000
	) // MOS data is in seconds
}

class ServerUserActionAPI
	extends MethodContextAPI
	implements ReplaceOptionalWithNullInMethodArguments<NewUserActionAPI>
{
	async take(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		fromPartInstanceId: PartInstanceId | null
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(fromPartInstanceId, Match.OneOf(String, null))
			},
			StudioJobs.TakeNextPart,
			{
				playlistId: rundownPlaylistId,
				fromPartInstanceId,
			}
		)
	}
	async setNext(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		nextPartId: PartId,
		timeOffset: number | null
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(nextPartId, String)
			},
			StudioJobs.SetNextPart,
			{
				playlistId: rundownPlaylistId,
				nextPartId,
				setManually: true,
				nextTimeOffset: timeOffset ?? undefined,
			}
		)
	}
	async setNextSegment(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		nextSegmentId: SegmentId
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(nextSegmentId, String)
			},
			StudioJobs.SetNextSegment,
			{
				playlistId: rundownPlaylistId,
				nextSegmentId,
			}
		)
	}
	async queueNextSegment(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		queuedSegmentId: SegmentId | null
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(queuedSegmentId, Match.OneOf(String, null))
			},
			StudioJobs.QueueNextSegment,
			{
				playlistId: rundownPlaylistId,
				queuedSegmentId,
			}
		)
	}
	async moveNext(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partDelta: number,
		segmentDelta: number,
		ignoreQuickLoop: boolean | null
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partDelta, Number)
				check(segmentDelta, Number)
			},
			StudioJobs.MoveNextPart,
			{
				playlistId: rundownPlaylistId,
				partDelta: partDelta,
				segmentDelta: segmentDelta,
				ignoreQuickLoop: ignoreQuickLoop ?? undefined,
			}
		)
	}
	async prepareForBroadcast(userEvent: string, eventTime: Time, rundownPlaylistId: RundownPlaylistId) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.PrepareRundownForBroadcast,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async resetRundownPlaylist(userEvent: string, eventTime: Time, rundownPlaylistId: RundownPlaylistId) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async resetAndActivate(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean | null
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(rehearsal, Match.Maybe(Boolean))
			},
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				activate: rehearsal ? 'rehearsal' : 'active',
			}
		)
	}
	async activate(userEvent: string, eventTime: Time, rundownPlaylistId: RundownPlaylistId, rehearsal: boolean) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(rehearsal, Boolean)
			},
			StudioJobs.ActivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				rehearsal: rehearsal,
			}
		)
	}
	async deactivate(userEvent: string, eventTime: Time, rundownPlaylistId: RundownPlaylistId) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.DeactivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async forceResetAndActivate(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(rehearsal, Boolean)
			},
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				activate: rehearsal ? 'rehearsal' : 'active',
				forceActivate: true,
			}
		)
	}
	async disableNextPiece(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		undo: boolean | null
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(undo, Match.Maybe(Boolean))
			},
			StudioJobs.DisableNextPiece,
			{
				playlistId: rundownPlaylistId,
				undo: !!undo,
			}
		)
	}
	async pieceTakeNow(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partInstanceId, String)
				check(pieceInstanceIdOrPieceIdToCopy, String)
			},
			StudioJobs.TakePieceAsAdlibNow,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: partInstanceId,
				pieceInstanceIdOrPieceIdToCopy: pieceInstanceIdOrPieceIdToCopy,
			}
		)
	}
	async setInOutPoints(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId,
		pieceId: PieceId,
		inPoint: number,
		duration: number
	) {
		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partId, String)
				check(pieceId, String)
				check(inPoint, Number)
				check(duration, Number)
			},
			'pieceSetInOutPoints',
			{ rundownPlaylistId, partId, pieceId, inPoint, duration },
			async (playlist) => {
				return pieceSetInOutPoints(playlist._id, partId, pieceId, inPoint, duration)
			}
		)
	}
	async executeAction(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		actionDocId: AdLibActionId | RundownBaselineAdLibActionId | BucketAdLibActionId,
		actionId: string,
		userData: ActionUserData,
		triggerMode: string | null
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(actionDocId, String)
				check(actionId, String)
				check(userData, Match.Any)
				check(triggerMode, Match.Maybe(String))
			},
			StudioJobs.ExecuteAction,
			{
				playlistId: rundownPlaylistId,
				actionDocId,
				actionId,
				userData,
				triggerMode: triggerMode ?? undefined,
			}
		)
	}
	async segmentAdLibPieceStart(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adlibPieceId: PieceId,
		queue: boolean
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partInstanceId, String)
				check(adlibPieceId, String)
				check(queue, Boolean)
			},
			StudioJobs.AdlibPieceStart,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: partInstanceId,
				adLibPieceId: adlibPieceId,
				pieceType: 'normal',
				queue: !!queue,
			}
		)
	}
	async sourceLayerOnPartStop(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		sourceLayerIds: string[]
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partInstanceId, String)
				check(sourceLayerIds, [String])
			},
			StudioJobs.StopPiecesOnSourceLayers,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: partInstanceId,
				sourceLayerIds: sourceLayerIds,
			}
		)
	}
	async baselineAdLibPieceStart(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adlibPieceId: PieceId,
		queue: boolean
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partInstanceId, String)
				check(adlibPieceId, String)
				check(queue, Boolean)
			},
			StudioJobs.AdlibPieceStart,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: partInstanceId,
				adLibPieceId: adlibPieceId,
				pieceType: 'baseline',
				queue: !!queue,
			}
		)
	}
	async sourceLayerStickyPieceStart(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(sourceLayerId, String)
			},
			StudioJobs.StartStickyPieceOnSourceLayer,
			{
				playlistId: rundownPlaylistId,
				sourceLayerId: sourceLayerId,
			}
		)
	}
	async bucketAdlibImport(
		userEvent: string,
		eventTime: Time,
		bucketId: BucketId,
		showStyleBaseId: ShowStyleBaseId,
		ingestItem: IngestAdlib
	) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketAdlibImport',
			{ bucketId, showStyleBaseId, ingestItem },
			async () => {
				check(bucketId, String)
				check(showStyleBaseId, String)
				check(ingestItem, Object)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.importAdlibToBucket(bucketId, showStyleBaseId, undefined, ingestItem)
			}
		)
	}
	async bucketAdlibStart(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		bucketAdlibId: BucketAdLibId,
		queue: boolean | null
	) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
				check(partInstanceId, String)
				check(bucketAdlibId, String)
				check(queue, Match.Maybe(Boolean))
			},
			StudioJobs.AdlibPieceStart,
			{
				playlistId: rundownPlaylistId,
				partInstanceId: partInstanceId,
				adLibPieceId: bucketAdlibId,
				pieceType: 'bucket',
				queue: !!queue,
			}
		)
	}
	async activateHold(userEvent: string, eventTime: Time, rundownPlaylistId: RundownPlaylistId, undo: boolean | null) {
		if (undo) {
			return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this,
				userEvent,
				eventTime,
				rundownPlaylistId,
				() => {
					check(rundownPlaylistId, String)
				},
				StudioJobs.DeactivateHold,
				{
					playlistId: rundownPlaylistId,
				}
			)
		} else {
			return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this,
				userEvent,
				eventTime,
				rundownPlaylistId,
				() => {
					check(rundownPlaylistId, String)
				},
				StudioJobs.ActivateHold,
				{
					playlistId: rundownPlaylistId,
				}
			)
		}
	}
	async saveEvaluation(userEvent: string, eventTime: Time, evaluation: EvaluationBase) {
		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			eventTime,
			evaluation.playlistId,
			() => {
				//
			},
			'saveEvaluation',
			{ evaluation },
			async (playlist) => {
				return saveEvaluation(playlist, evaluation)
			}
		)
	}
	async storeRundownSnapshot(
		userEvent: string,
		eventTime: Time,
		hashedToken: string,
		playlistId: RundownPlaylistId,
		reason: string,
		full: boolean
	) {
		if (!verifyHashedToken(hashedToken)) {
			throw new Meteor.Error(401, `Idempotency token is invalid or has expired`)
		}
		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			eventTime,
			playlistId,
			() => {
				check(playlistId, String)
				check(reason, String)
			},
			'storeRundownSnapshot',
			{ playlistId, reason, full },
			async (playlist) => {
				return storeRundownPlaylistSnapshot(playlist, { withArchivedDocuments: full }, reason)
			}
		)
	}
	async removeRundownPlaylist(userEvent: string, eventTime: Time, rundownPlaylistId: RundownPlaylistId) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.RemovePlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async DEBUG_crashStudioWorker(userEvent: string, eventTime: Time, rundownPlaylistId: RundownPlaylistId) {
		// Make sure we never crash in production
		if (Meteor.isProduction) return ClientAPI.responseSuccess(undefined)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.DebugCrash,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async resyncRundownPlaylist(userEvent: string, eventTime: Time, playlistId: RundownPlaylistId) {
		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			eventTime,
			playlistId,
			() => {
				check(playlistId, String)
			},
			'resyncRundownPlaylist',
			{ playlistId },
			async (playlist) => {
				return ServerRundownAPI.resyncRundownPlaylist(playlist)
			}
		)
	}
	async unsyncRundown(userEvent: string, eventTime: Time, rundownId: RundownId) {
		return ServerClientAPI.runUserActionInLogForRundown(
			this,
			userEvent,
			eventTime,
			rundownId,
			() => {
				check(rundownId, String)
			},
			'unsyncRundown',
			{ rundownId },
			async (rundown) => {
				return ServerRundownAPI.unsyncRundown(rundown)
			}
		)
	}
	async removeRundown(userEvent: string, eventTime: Time, rundownId: RundownId) {
		return ServerClientAPI.runUserActionInLogForRundown(
			this,
			userEvent,
			eventTime,
			rundownId,
			() => {
				check(rundownId, String)
			},
			'removeRundown',
			{ rundownId },
			async (rundown) => {
				return ServerRundownAPI.removeRundown(rundown)
			}
		)
	}
	async resyncRundown(userEvent: string, eventTime: Time, rundownId: RundownId) {
		return ServerClientAPI.runUserActionInLogForRundown(
			this,
			userEvent,
			eventTime,
			rundownId,
			() => {
				check(rundownId, String)
			},
			'resyncRundown',
			{ rundownId },
			async (rundown) => {
				return ServerRundownAPI.resyncRundown(rundown)
			}
		)
	}
	async packageManagerRestartExpectation(
		userEvent: string,
		eventTime: Time,
		deviceId: PeripheralDeviceId,
		workId: string
	) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'packageManagerRestartExpectation',
			{ deviceId, workId },
			async () => {
				check(deviceId, String)
				check(workId, String)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_MEDIA_MANAGEMENT)

				return PackageManagerAPI.restartExpectation(deviceId, workId)
			}
		)
	}
	async packageManagerRestartAllExpectations(userEvent: string, eventTime: Time, studioId: StudioId) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'packageManagerRestartAllExpectations',
			{ studioId },
			async () => {
				check(studioId, String)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_MEDIA_MANAGEMENT)

				return PackageManagerAPI.restartAllExpectationsInStudio(studioId)
			}
		)
	}
	async packageManagerAbortExpectation(
		userEvent: string,
		eventTime: Time,
		deviceId: PeripheralDeviceId,
		workId: string
	) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'packageManagerAbortExpectation',
			{ deviceId, workId },
			async () => {
				check(deviceId, String)
				check(workId, String)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_MEDIA_MANAGEMENT)

				return PackageManagerAPI.abortExpectation(deviceId, workId)
			}
		)
	}
	async packageManagerRestartPackageContainer(
		userEvent: string,
		eventTime: Time,
		deviceId: PeripheralDeviceId,
		containerId: string
	) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'packageManagerRestartPackageContainer',
			{ deviceId, containerId },
			async () => {
				check(deviceId, String)
				check(containerId, String)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_MEDIA_MANAGEMENT)

				return PackageManagerAPI.restartPackageContainer(deviceId, containerId)
			}
		)
	}
	async regenerateRundownPlaylist(userEvent: string, eventTime: Time, rundownPlaylistId: RundownPlaylistId) {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, String)
			},
			StudioJobs.RegeneratePlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async restartCore(userEvent: string, eventTime: Time, hashedToken: string) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'restartCore',
			{ hashedToken },
			async () => {
				check(hashedToken, String)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_SYSTEM_ACTION)

				if (!verifyHashedToken(hashedToken)) {
					throw new Meteor.Error(401, `Restart token is invalid or has expired`)
				}

				setTimeout(() => {
					// eslint-disable-next-line n/no-process-exit
					process.exit(0)
				}, 3000)
				return `Restarting Core in 3s.`
			}
		)
	}

	async guiFocused(userEvent: string, eventTime: Time, viewInfo: unknown | null) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, eventTime, 'guiFocused', { viewInfo }, async () => {
			triggerWriteAccessBecauseNoCheckNecessary()
		})
	}
	async guiBlurred(userEvent: string, eventTime: Time, viewInfo: unknown | null) {
		return ServerClientAPI.runUserActionInLog(this, userEvent, eventTime, 'guiBlurred', { viewInfo }, async () => {
			triggerWriteAccessBecauseNoCheckNecessary()
		})
	}

	async bucketsRemoveBucket(userEvent: string, eventTime: Time, bucketId: BucketId) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsRemoveBucket',
			{ bucketId },
			async () => {
				check(bucketId, String)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.removeBucket(bucketId)
			}
		)
	}
	async bucketsModifyBucket(
		userEvent: string,
		eventTime: Time,
		bucketId: BucketId,
		bucketProps: Partial<Omit<Bucket, '_id'>>
	) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsModifyBucket',
			{ bucketId, bucketProps },
			async () => {
				check(bucketId, String)
				check(bucketProps, Object)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.modifyBucket(bucketId, bucketProps)
			}
		)
	}
	async bucketsEmptyBucket(userEvent: string, eventTime: Time, bucketId: BucketId) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsEmptyBucket',
			{ bucketId },
			async () => {
				check(bucketId, String)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.emptyBucket(bucketId)
			}
		)
	}
	async bucketsCreateNewBucket(userEvent: string, eventTime: Time, studioId: StudioId, name: string) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsCreateNewBucket',
			{ name, studioId },
			async () => {
				check(studioId, String)
				check(name, String)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.createNewBucket(studioId, name)
			}
		)
	}
	async bucketsRemoveBucketAdLib(userEvent: string, eventTime: Time, adlibId: BucketAdLibId) {
		check(adlibId, String)

		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsRemoveBucketAdLib',
			{ adlibId },
			async () => {
				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.removeBucketAdLib(adlibId)
			}
		)
	}
	async bucketsRemoveBucketAdLibAction(userEvent: string, eventTime: Time, actionId: BucketAdLibActionId) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsRemoveBucketAdLibAction',
			{ actionId },
			async () => {
				check(actionId, String)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.removeBucketAdLibAction(actionId)
			}
		)
	}
	async bucketsModifyBucketAdLib(
		userEvent: string,
		eventTime: Time,
		adlibId: BucketAdLibId,
		adlibProps: Partial<Omit<BucketAdLib, '_id'>>
	) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsModifyBucketAdLib',
			{ adlibId, adlibProps },
			async () => {
				check(adlibId, String)
				check(adlibProps, Object)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.modifyBucketAdLib(adlibId, adlibProps)
			}
		)
	}
	async bucketsModifyBucketAdLibAction(
		userEvent: string,
		eventTime: Time,
		actionId: BucketAdLibActionId,
		actionProps: Partial<Omit<BucketAdLibAction, '_id'>>
	) {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsModifyBucketAdLib',
			{ actionId, actionProps },
			async () => {
				check(actionId, String)
				check(actionProps, Object)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.modifyBucketAdLibAction(actionId, actionProps)
			}
		)
	}
	async bucketsSaveActionIntoBucket(
		userEvent: string,
		eventTime: Time,
		studioId: StudioId,
		bucketId: BucketId,
		action: AdLibActionCommon | BucketAdLibAction
	): Promise<ClientAPI.ClientResponse<BucketAdLibAction>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsSaveActionIntoBucket',
			{ studioId, bucketId, action },
			async () => {
				check(studioId, String)
				check(bucketId, String)
				check(action, Object)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.saveAdLibActionIntoBucket(bucketId, action)
			}
		)
	}
	async switchRouteSet(
		userEvent: string,
		eventTime: Time,
		studioId: StudioId,
		routeSetId: string,
		state: boolean | 'toggle'
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'switchRouteSet',
			{ studioId, routeSetId, state },
			async () => {
				check(studioId, String)
				check(routeSetId, String)
				check(state, Match.OneOf('toggle', Boolean))

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_PLAYOUT_USERACTION)

				return ServerPlayoutAPI.switchRouteSet(studioId, routeSetId, state)
			}
		)
	}
	async moveRundown(
		userEvent: string,
		eventTime: Time,
		rundownId: RundownId,
		intoPlaylistId: RundownPlaylistId | null,
		rundownsIdsInPlaylistInOrder: RundownId[]
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForRundownOnWorker(
			this,
			userEvent,
			eventTime,
			rundownId,
			() => {
				check(rundownId, String)
				check(intoPlaylistId, Match.OneOf(String, null))
				check(rundownsIdsInPlaylistInOrder, Array)
			},
			StudioJobs.OrderMoveRundownToPlaylist,
			{
				rundownId: rundownId,
				intoPlaylistId,
				rundownsIdsInPlaylistInOrder: rundownsIdsInPlaylistInOrder,
			}
		)
	}
	async restoreRundownOrder(
		userEvent: string,
		eventTime: Time,
		playlistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			playlistId,
			() => {
				check(playlistId, String)
			},
			StudioJobs.OrderRestoreToDefault,
			{
				playlistId: playlistId,
			}
		)
	}
	async disablePeripheralSubDevice(
		userEvent: string,
		eventTime: Time,
		peripheralDeviceId: PeripheralDeviceId,
		subDeviceId: string,
		disable: boolean
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'packageManagerRestartAllExpectations',
			{ peripheralDeviceId, subDeviceId, disable },
			async () => {
				check(peripheralDeviceId, String)
				check(subDeviceId, String)
				check(disable, Boolean)

				assertConnectionHasOneOfPermissions(
					this.connection,
					...PERMISSIONS_FOR_PLAYOUT_USERACTION,
					...PERMISSIONS_FOR_SYSTEM_ACTION
				)

				return ServerPeripheralDeviceAPI.disableSubDevice(peripheralDeviceId, subDeviceId, disable)
			}
		)
	}

	async activateAdlibTestingMode(
		userEvent: string,
		eventTime: number,
		playlistId: RundownPlaylistId,
		rundownId: RundownId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			playlistId,
			() => {
				check(playlistId, String)
				check(rundownId, String)
			},
			StudioJobs.ActivateAdlibTesting,
			{
				playlistId: playlistId,
				rundownId: rundownId,
			}
		)
	}

	async setQuickLoopStart(
		userEvent: string,
		eventTime: number,
		playlistId: RundownPlaylistId,
		marker: QuickLoopMarker | null
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			playlistId,
			() => {
				check(playlistId, String)
			},
			StudioJobs.SetQuickLoopMarker,
			{
				playlistId,
				marker,
				type: 'start',
			}
		)
	}

	async setQuickLoopEnd(
		userEvent: string,
		eventTime: number,
		playlistId: RundownPlaylistId,
		marker: QuickLoopMarker | null
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			playlistId,
			() => {
				check(playlistId, String)
			},
			StudioJobs.SetQuickLoopMarker,
			{
				playlistId,
				marker,
				type: 'end',
			}
		)
	}

	async executeUserChangeOperation(
		userEvent: string,
		eventTime: Time,
		rundownId: RundownId,
		operationTarget: UserOperationTarget,
		operation: { id: string; [key: string]: any }
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'executeUserChangeOperation',
			{ operationTarget, operation },
			async () => {
				const rundown = await checkAccessToRundown(this.connection, rundownId)

				await runIngestOperation(rundown.studioId, IngestJobs.UserExecuteChangeOperation, {
					rundownExternalId: rundown.externalId,
					operationTarget,
					operation,
				})
			}
		)
	}
	async clearQuickLoop(
		userEvent: string,
		eventTime: number,
		playlistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			playlistId,
			() => {
				check(playlistId, String)
			},
			StudioJobs.ClearQuickLoopMarkers,
			{
				playlistId,
			}
		)
	}

	async createAdlibTestingRundownForShowStyleVariant(
		userEvent: string,
		eventTime: number,
		studioId: StudioId,
		showStyleVariantId: ShowStyleVariantId
	) {
		const jobName = IngestJobs.CreateAdlibTestingRundownForShowStyleVariant
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			`worker.ingest.${jobName}`,
			{ showStyleVariantId },
			async (_credentials) => {
				check(studioId, String)
				check(showStyleVariantId, String)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_PLAYOUT_USERACTION)

				return runIngestOperation(studioId, IngestJobs.CreateAdlibTestingRundownForShowStyleVariant, {
					showStyleVariantId,
				})
			}
		)
	}
}
registerClassToMeteorMethods(UserActionAPIMethods, ServerUserActionAPI, false)
