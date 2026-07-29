import { Meteor } from 'meteor/meteor'
import { z } from 'zod'
import { check, zAnyArray, zPlainObject } from '../lib/check'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { ServerPlayoutAPI } from './playout/playout'
import {
	NewUserActionAPI,
	ReloadRundownPlaylistResponse,
	TriggerReloadDataResponse,
} from '@sofie-automation/meteor-lib/dist/api/userActions'
import { EvaluationBase } from '@sofie-automation/meteor-lib/dist/collections/Evaluations'
import { IngestPart, IngestAdlib, ActionUserData, UserOperationTarget } from '@sofie-automation/blueprints-integration'
import { storeRundownPlaylistSnapshot } from './snapshot'
import { ReplaceOptionalWithNullInMethodArguments } from '../methods'
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
import {
	ExecuteActionResult,
	QueueNextSegmentResult,
	StudioJobs,
	TakeNextPartResult,
} from '@sofie-automation/corelib/dist/worker/studio'
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
	SnapshotId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { NrcsIngestDataCache, Parts, Pieces, Rundowns } from '../collections'
import { NrcsIngestCacheType } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import { verifyHashedToken } from './singleUseTokens'
import { QuickLoopMarker } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { runIngestOperation } from './ingest/lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { assertConnectionHasOneOfPermissions } from '../security/auth'
import { checkAccessToRundown } from '../security/check'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { isInProductionMode } from '../lib'

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

export class ServerUserActionAPI
	extends MethodContextAPI
	implements ReplaceOptionalWithNullInMethodArguments<NewUserActionAPI>
{
	async take(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		fromPartInstanceId: PartInstanceId | null
	): Promise<ClientAPI.ClientResponse<TakeNextPartResult>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(fromPartInstanceId, z.string().nullable())
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
		nextPartOrInstanceId: PartId | PartInstanceId,
		timeOffset: number | null,
		isInstance: boolean | null
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(nextPartOrInstanceId, z.string())
			},
			StudioJobs.SetNextPart,
			{
				playlistId: rundownPlaylistId,
				nextPartId: isInstance ? undefined : protectString<PartId>(unprotectString(nextPartOrInstanceId)),
				nextPartInstanceId: isInstance
					? protectString<PartInstanceId>(unprotectString(nextPartOrInstanceId))
					: undefined,
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
	): Promise<ClientAPI.ClientResponse<PartId>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(nextSegmentId, z.string())
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
	): Promise<ClientAPI.ClientResponse<QueueNextSegmentResult>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(queuedSegmentId, z.string().nullable())
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
	): Promise<ClientAPI.ClientResponse<PartId | null>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(partDelta, z.number())
				check(segmentDelta, z.number())
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
	async prepareForBroadcast(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
			},
			StudioJobs.PrepareRundownForBroadcast,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async resetRundownPlaylist(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(rehearsal, z.boolean().nullish())
			},
			StudioJobs.ResetRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				activate: rehearsal ? 'rehearsal' : 'active',
			}
		)
	}
	async activate(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(rehearsal, z.boolean())
			},
			StudioJobs.ActivateRundownPlaylist,
			{
				playlistId: rundownPlaylistId,
				rehearsal: rehearsal,
			}
		)
	}
	async deactivate(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(rehearsal, z.boolean())
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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(undo, z.boolean().nullish())
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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(partInstanceId, z.string())
				check(pieceInstanceIdOrPieceIdToCopy, z.string())
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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(partId, z.string())
				check(pieceId, z.string())
				check(inPoint, z.number())
				check(duration, z.number())
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
		actionDocId: AdLibActionId | RundownBaselineAdLibActionId | BucketAdLibActionId | null,
		actionId: string,
		userData: ActionUserData | null,
		triggerMode: string | null
	): Promise<ClientAPI.ClientResponse<ExecuteActionResult>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(actionDocId, z.string().nullish())
				check(actionId, z.string())
				check(userData, z.any())
				check(triggerMode, z.string().nullish())
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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(partInstanceId, z.string())
				check(adlibPieceId, z.string())
				check(queue, z.boolean())
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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(partInstanceId, z.string())
				check(sourceLayerIds, z.array(z.string()))
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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(partInstanceId, z.string())
				check(adlibPieceId, z.string())
				check(queue, z.boolean())
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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(sourceLayerId, z.string())
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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketAdlibImport',
			{ bucketId, showStyleBaseId, ingestItem },
			async () => {
				check(bucketId, z.string())
				check(showStyleBaseId, z.string())
				check(ingestItem, zPlainObject)

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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
				check(partInstanceId, z.string())
				check(bucketAdlibId, z.string())
				check(queue, z.boolean().nullish())
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
	async activateHold(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		undo: boolean | null
	): Promise<ClientAPI.ClientResponse<void>> {
		if (undo) {
			return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
				this,
				userEvent,
				eventTime,
				rundownPlaylistId,
				() => {
					check(rundownPlaylistId, z.string())
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
					check(rundownPlaylistId, z.string())
				},
				StudioJobs.ActivateHold,
				{
					playlistId: rundownPlaylistId,
				}
			)
		}
	}
	async saveEvaluation(
		userEvent: string,
		eventTime: Time,
		evaluation: EvaluationBase
	): Promise<ClientAPI.ClientResponse<void>> {
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
	): Promise<ClientAPI.ClientResponse<SnapshotId>> {
		if (!verifyHashedToken(hashedToken)) {
			throw new Meteor.Error(401, `Idempotency token is invalid or has expired`)
		}
		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			eventTime,
			playlistId,
			() => {
				check(playlistId, z.string())
				check(reason, z.string())
			},
			'storeRundownSnapshot',
			{ playlistId, reason, full },
			async (playlist) => {
				return storeRundownPlaylistSnapshot(playlist, { withArchivedDocuments: full }, reason)
			}
		)
	}
	async removeRundownPlaylist(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
			},
			StudioJobs.RemovePlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async DEBUG_crashStudioWorker(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		// Make sure we never crash in production
		if (isInProductionMode()) return ClientAPI.responseSuccess(undefined)

		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
			},
			StudioJobs.DebugCrash,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async resyncRundownPlaylist(
		userEvent: string,
		eventTime: Time,
		playlistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<ReloadRundownPlaylistResponse>> {
		return ServerClientAPI.runUserActionInLogForPlaylist(
			this,
			userEvent,
			eventTime,
			playlistId,
			() => {
				check(playlistId, z.string())
			},
			'resyncRundownPlaylist',
			{ playlistId },
			async (playlist) => {
				return ServerRundownAPI.resyncRundownPlaylist(playlist)
			}
		)
	}
	async unsyncRundown(
		userEvent: string,
		eventTime: Time,
		rundownId: RundownId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForRundown(
			this,
			userEvent,
			eventTime,
			rundownId,
			() => {
				check(rundownId, z.string())
			},
			'unsyncRundown',
			{ rundownId },
			async (rundown) => {
				return ServerRundownAPI.unsyncRundown(rundown)
			}
		)
	}
	async removeRundown(
		userEvent: string,
		eventTime: Time,
		rundownId: RundownId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForRundown(
			this,
			userEvent,
			eventTime,
			rundownId,
			() => {
				check(rundownId, z.string())
			},
			'removeRundown',
			{ rundownId },
			async (rundown) => {
				return ServerRundownAPI.removeRundown(rundown)
			}
		)
	}
	async resyncRundown(
		userEvent: string,
		eventTime: Time,
		rundownId: RundownId
	): Promise<ClientAPI.ClientResponse<TriggerReloadDataResponse>> {
		return ServerClientAPI.runUserActionInLogForRundown(
			this,
			userEvent,
			eventTime,
			rundownId,
			() => {
				check(rundownId, z.string())
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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'packageManagerRestartExpectation',
			{ deviceId, workId },
			async () => {
				check(deviceId, z.string())
				check(workId, z.string())

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_MEDIA_MANAGEMENT)

				return PackageManagerAPI.restartExpectation(deviceId, workId)
			}
		)
	}
	async packageManagerRestartAllExpectations(
		userEvent: string,
		eventTime: Time,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'packageManagerRestartAllExpectations',
			{ studioId },
			async () => {
				check(studioId, z.string())

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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'packageManagerAbortExpectation',
			{ deviceId, workId },
			async () => {
				check(deviceId, z.string())
				check(workId, z.string())

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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'packageManagerRestartPackageContainer',
			{ deviceId, containerId },
			async () => {
				check(deviceId, z.string())
				check(containerId, z.string())

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_MEDIA_MANAGEMENT)

				return PackageManagerAPI.restartPackageContainer(deviceId, containerId)
			}
		)
	}
	async regenerateRundownPlaylist(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLogForPlaylistOnWorker(
			this,
			userEvent,
			eventTime,
			rundownPlaylistId,
			() => {
				check(rundownPlaylistId, z.string())
			},
			StudioJobs.RegeneratePlaylist,
			{
				playlistId: rundownPlaylistId,
			}
		)
	}
	async restartCore(
		userEvent: string,
		eventTime: Time,
		hashedToken: string
	): Promise<ClientAPI.ClientResponse<string>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'restartCore',
			{ hashedToken },
			async () => {
				check(hashedToken, z.string())

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

	async guiFocused(
		userEvent: string,
		eventTime: Time,
		viewInfo: unknown | null
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(this, userEvent, eventTime, 'guiFocused', { viewInfo }, async () => {
			triggerWriteAccessBecauseNoCheckNecessary()
		})
	}
	async guiBlurred(
		userEvent: string,
		eventTime: Time,
		viewInfo: unknown | null
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(this, userEvent, eventTime, 'guiBlurred', { viewInfo }, async () => {
			triggerWriteAccessBecauseNoCheckNecessary()
		})
	}

	async bucketsRemoveBucket(
		userEvent: string,
		eventTime: Time,
		bucketId: BucketId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsRemoveBucket',
			{ bucketId },
			async () => {
				check(bucketId, z.string())

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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsModifyBucket',
			{ bucketId, bucketProps },
			async () => {
				check(bucketId, z.string())
				check(bucketProps, zPlainObject)

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.modifyBucket(bucketId, bucketProps)
			}
		)
	}
	async bucketsEmptyBucket(
		userEvent: string,
		eventTime: Time,
		bucketId: BucketId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsEmptyBucket',
			{ bucketId },
			async () => {
				check(bucketId, z.string())

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.emptyBucket(bucketId)
			}
		)
	}
	async bucketsCreateNewBucket(
		userEvent: string,
		eventTime: Time,
		studioId: StudioId,
		name: string
	): Promise<ClientAPI.ClientResponse<Bucket>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsCreateNewBucket',
			{ name, studioId },
			async () => {
				check(studioId, z.string())
				check(name, z.string())

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)
				return BucketsAPI.createNewBucket(studioId, name)
			}
		)
	}
	async bucketsRemoveBucketAdLib(
		userEvent: string,
		eventTime: Time,
		adlibId: BucketAdLibId
	): Promise<ClientAPI.ClientResponse<void>> {
		check(adlibId, z.string())

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
	async bucketsRemoveBucketAdLibAction(
		userEvent: string,
		eventTime: Time,
		actionId: BucketAdLibActionId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsRemoveBucketAdLibAction',
			{ actionId },
			async () => {
				check(actionId, z.string())

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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsModifyBucketAdLib',
			{ adlibId, adlibProps },
			async () => {
				check(adlibId, z.string())
				check(adlibProps, zPlainObject)

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
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			'bucketsModifyBucketAdLib',
			{ actionId, actionProps },
			async () => {
				check(actionId, z.string())
				check(actionProps, zPlainObject)

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
				check(studioId, z.string())
				check(bucketId, z.string())
				check(action, zPlainObject)

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
				check(studioId, z.string())
				check(routeSetId, z.string())
				check(state, z.union([z.literal('toggle'), z.boolean()]))

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
				check(rundownId, z.string())
				check(intoPlaylistId, z.string().nullable())
				check(rundownsIdsInPlaylistInOrder, zAnyArray)
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
				check(playlistId, z.string())
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
				check(peripheralDeviceId, z.string())
				check(subDeviceId, z.string())
				check(disable, z.boolean())

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
				check(playlistId, z.string())
				check(rundownId, z.string())
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
				check(playlistId, z.string())
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
				check(playlistId, z.string())
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
				check(playlistId, z.string())
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
	): Promise<ClientAPI.ClientResponse<RundownId>> {
		const jobName = IngestJobs.CreateAdlibTestingRundownForShowStyleVariant
		return ServerClientAPI.runUserActionInLog(
			this,
			userEvent,
			eventTime,
			`worker.ingest.${jobName}`,
			{ showStyleVariantId },
			async (_credentials) => {
				check(studioId, z.string())
				check(showStyleVariantId, z.string())

				assertConnectionHasOneOfPermissions(this.connection, ...PERMISSIONS_FOR_PLAYOUT_USERACTION)

				return runIngestOperation(studioId, IngestJobs.CreateAdlibTestingRundownForShowStyleVariant, {
					showStyleVariantId,
				})
			}
		)
	}
}
