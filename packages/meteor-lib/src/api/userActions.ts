import { ClientAPI } from './client.js'
import { EvaluationBase } from '../collections/Evaluations.js'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { IngestAdlib, ActionUserData, UserOperationTarget } from '@sofie-automation/blueprints-integration'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { AdLibActionCommon } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { Time } from '@sofie-automation/blueprints-integration'
import {
	ExecuteActionResult,
	QueueNextSegmentResult,
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
import { QuickLoopMarker } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

export interface NewUserActionAPI {
	take(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		fromPartInstanceId: PartInstanceId | null
	): Promise<ClientAPI.ClientResponse<TakeNextPartResult>>
	setNext(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId,
		timeOffset?: number
	): Promise<ClientAPI.ClientResponse<void>>
	setNextSegment(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId
	): Promise<ClientAPI.ClientResponse<PartId>>
	queueNextSegment(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId | null
	): Promise<ClientAPI.ClientResponse<QueueNextSegmentResult>>
	moveNext(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partDelta: number,
		segmentDelta: number,
		ignoreQuickLoop?: boolean
	): Promise<ClientAPI.ClientResponse<PartId | null>>
	prepareForBroadcast(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	resetRundownPlaylist(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	resetAndActivate(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal?: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	activate(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	deactivate(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	forceResetAndActivate(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	disableNextPiece(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		undo?: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	pieceTakeNow(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		pieceInstanceIdOrPieceIdToCopy: PieceInstanceId | PieceId
	): Promise<ClientAPI.ClientResponse<void>>
	setInOutPoints(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId,
		pieceId: PieceId,
		inPoint: number,
		duration: number
	): Promise<ClientAPI.ClientResponse<void>>
	executeAction(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		actionDocId: AdLibActionId | RundownBaselineAdLibActionId | BucketAdLibActionId | null,
		actionId: string,
		userData: ActionUserData | null,
		triggerMode?: string
	): Promise<ClientAPI.ClientResponse<ExecuteActionResult>>
	segmentAdLibPieceStart(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adLibPieceId: PieceId,
		queue: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	sourceLayerOnPartStop(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		sourceLayerIds: string[]
	): Promise<ClientAPI.ClientResponse<void>>
	baselineAdLibPieceStart(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		adlibPieceId: PieceId,
		queue: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	sourceLayerStickyPieceStart(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>>
	bucketAdlibImport(
		_userEvent: string,
		eventTime: Time,
		bucketId: BucketId,
		showStyleBaseId: ShowStyleBaseId,
		ingestItem: IngestAdlib
	): Promise<ClientAPI.ClientResponse<void>>
	bucketAdlibStart(
		_userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		partInstanceId: PartInstanceId,
		bucketAdlibId: BucketAdLibId,
		queue?: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	activateHold(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		undo?: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	saveEvaluation(
		userEvent: string,
		eventTime: Time,
		evaluation: EvaluationBase
	): Promise<ClientAPI.ClientResponse<void>>
	storeRundownSnapshot(
		userEvent: string,
		eventTime: Time,
		token: string,
		playlistId: RundownPlaylistId,
		reason: string,
		full: boolean
	): Promise<ClientAPI.ClientResponse<SnapshotId>>
	removeRundownPlaylist(
		userEvent: string,
		eventTime: Time,
		playlistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	resyncRundownPlaylist(
		userEvent: string,
		eventTime: Time,
		playlistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<ReloadRundownPlaylistResponse>>
	DEBUG_crashStudioWorker(
		userEvent: string,
		eventTime: Time,
		playlistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	removeRundown(userEvent: string, eventTime: Time, rundownId: RundownId): Promise<ClientAPI.ClientResponse<void>>
	resyncRundown(
		userEvent: string,
		eventTime: Time,
		rundownId: RundownId
	): Promise<ClientAPI.ClientResponse<TriggerReloadDataResponse>>
	unsyncRundown(userEvent: string, eventTime: Time, rundownId: RundownId): Promise<ClientAPI.ClientResponse<void>> //
	packageManagerRestartExpectation(
		userEvent: string,
		eventTime: Time,
		deviceId: PeripheralDeviceId,
		workId: string
	): Promise<ClientAPI.ClientResponse<void>>
	packageManagerRestartAllExpectations(
		userEvent: string,
		eventTime: Time,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<void>>
	packageManagerAbortExpectation(
		userEvent: string,
		eventTime: Time,
		deviceId: PeripheralDeviceId,
		workId: string
	): Promise<ClientAPI.ClientResponse<void>>
	packageManagerRestartPackageContainer(
		userEvent: string,
		eventTime: Time,
		deviceId: PeripheralDeviceId,
		containerId: string
	): Promise<ClientAPI.ClientResponse<void>>
	regenerateRundownPlaylist(
		userEvent: string,
		eventTime: Time,
		playlistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	restartCore(userEvent: string, eventTime: Time, token: string): Promise<ClientAPI.ClientResponse<string>>
	guiFocused(userEvent: string, eventTime: Time, viewInfo?: unknown): Promise<ClientAPI.ClientResponse<void>>
	guiBlurred(userEvent: string, eventTime: Time, viewInfo?: unknown): Promise<ClientAPI.ClientResponse<void>>
	bucketsRemoveBucket(userEvent: string, eventTime: Time, id: BucketId): Promise<ClientAPI.ClientResponse<void>>
	bucketsModifyBucket(
		userEvent: string,
		eventTime: Time,
		id: BucketId,
		bucket: Partial<Omit<Bucket, '_id'>>
	): Promise<ClientAPI.ClientResponse<void>>
	bucketsEmptyBucket(userEvent: string, eventTime: Time, id: BucketId): Promise<ClientAPI.ClientResponse<void>>
	bucketsCreateNewBucket(
		userEvent: string,
		eventTime: Time,
		studioId: StudioId,
		name: string
	): Promise<ClientAPI.ClientResponse<Bucket>>
	bucketsRemoveBucketAdLib(
		userEvent: string,
		eventTime: Time,
		id: BucketAdLibId
	): Promise<ClientAPI.ClientResponse<void>>
	bucketsRemoveBucketAdLibAction(
		userEvent: string,
		eventTime: Time,
		id: BucketAdLibActionId
	): Promise<ClientAPI.ClientResponse<void>>
	bucketsModifyBucketAdLib(
		userEvent: string,
		eventTime: Time,
		id: BucketAdLibId,
		bucket: Partial<Omit<BucketAdLib, '_id'>>
	): Promise<ClientAPI.ClientResponse<void>>
	bucketsModifyBucketAdLibAction(
		userEvent: string,
		eventTime: Time,
		id: BucketAdLibActionId,
		action: Partial<Omit<BucketAdLibAction, '_id'>>
	): Promise<ClientAPI.ClientResponse<void>>
	bucketsSaveActionIntoBucket(
		userEvent: string,
		eventTime: Time,
		studioId: StudioId,
		bucketId: BucketId,
		action: AdLibActionCommon | BucketAdLibAction
	): Promise<ClientAPI.ClientResponse<BucketAdLibAction>>
	switchRouteSet(
		userEvent: string,
		eventTime: Time,
		studioId: StudioId,
		routeSetId: string,
		state: boolean | 'toggle'
	): Promise<ClientAPI.ClientResponse<void>>
	moveRundown(
		userEvent: string,
		eventTime: Time,
		rundownId: RundownId,
		intoPlaylistId: RundownPlaylistId | null,
		rundownsIdsInPlaylistInOrder: RundownId[]
	): Promise<ClientAPI.ClientResponse<void>>
	restoreRundownOrder(
		userEvent: string,
		eventTime: Time,
		playlistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	disablePeripheralSubDevice(
		userEvent: string,
		eventTime: Time,
		peripheralDeviceId: PeripheralDeviceId,
		subDeviceId: string,
		disable: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	activateAdlibTestingMode(
		userEvent: string,
		eventTime: number,
		playlistId: RundownPlaylistId,
		rundownId: RundownId
	): Promise<ClientAPI.ClientResponse<void>>
	executeUserChangeOperation(
		userEvent: string,
		eventTime: Time,
		rundownId: RundownId,
		operationTarget: UserOperationTarget,
		operation: { id: string; [key: string]: any }
	): Promise<ClientAPI.ClientResponse<void>>

	createAdlibTestingRundownForShowStyleVariant(
		userEvent: string,
		eventTime: Time,
		studioId: StudioId,
		showStyleVariantId: ShowStyleVariantId
	): Promise<ClientAPI.ClientResponse<RundownId>>

	setQuickLoopStart(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		marker: QuickLoopMarker | null
	): Promise<ClientAPI.ClientResponse<void>>
	setQuickLoopEnd(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId,
		marker: QuickLoopMarker | null
	): Promise<ClientAPI.ClientResponse<void>>
	clearQuickLoop(
		userEvent: string,
		eventTime: Time,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
}

export enum UserActionAPIMethods {
	'take' = 'userAction.take',
	'setNext' = 'userAction.setNext',
	'setNextSegment' = 'userAction.setNextSegment',
	'queueNextSegment' = 'userAction.queueNextSegment',
	'moveNext' = 'userAction.moveNext',

	'prepareForBroadcast' = 'userAction.prepareForBroadcast',
	'resetRundownPlaylist' = 'userAction.resetRundownPlaylist',
	'resetAndActivate' = 'userAction.resetAndActivate',
	'forceResetAndActivate' = 'userAction.forceResetAndActivate',
	'activate' = 'userAction.activate',
	'deactivate' = 'userAction.deactivate',
	'unsyncRundown' = 'userAction.unsyncRundown',

	'disableNextPiece' = 'userAction.disableNextPiece',
	'pieceTakeNow' = 'userAction.pieceTakeNow',
	'setInOutPoints' = 'userAction.pieceSetInOutPoints',
	'executeAction' = 'userAction.executeAction',

	'bucketAdlibImport' = 'userAction.bucketAdlibImport',
	'bucketAdlibStart' = 'userAction.bucketAdlibStart',

	'bucketsCreateNewBucket' = 'userAction.createBucket',
	'bucketsRemoveBucket' = 'userAction.removeBucket',
	'bucketsEmptyBucket' = 'userAction.emptyBucket',
	'bucketsModifyBucket' = 'userAction.modifyBucket',
	'bucketsRemoveBucketAdLib' = 'userAction.removeBucketAdLib',
	'bucketsRemoveBucketAdLibAction' = 'userAction.removeBucketAdLibAction',
	'bucketsModifyBucketAdLib' = 'userAction.bucketsModifyBucketAdLib',
	'bucketsModifyBucketAdLibAction' = 'userAction.bucketsModifyBucketAdLibAction',
	'bucketsSaveActionIntoBucket' = 'userAction.bucketsSaveActionIntoBucket',

	'segmentAdLibPieceStart' = 'userAction.segmentAdLibPieceStart',
	'sourceLayerOnPartStop' = 'userAction.sourceLayerOnPartStop',
	'baselineAdLibPieceStart' = 'userAction.baselineAdLibPieceStart',

	'sourceLayerStickyPieceStart' = 'userAction.sourceLayerStickyPieceStart',

	'activateHold' = 'userAction.activateHold',

	'saveEvaluation' = 'userAction.saveEvaluation',

	'storeRundownSnapshot' = 'userAction.storeRundownSnapshot',

	'removeRundownPlaylist' = 'userAction.removeRundownPlaylist',
	'resyncRundownPlaylist' = 'userAction.resyncRundownPlaylist',

	'DEBUG_crashStudioWorker' = 'userAction.DEBUG_crashStudioWorker',

	'removeRundown' = 'userAction.removeRundown',
	'resyncRundown' = 'userAction.resyncRundown',

	'moveRundown' = 'userAction.moveRundown',
	'restoreRundownOrder' = 'userAction.restoreRundownOrder',

	'packageManagerRestartExpectation' = 'userAction.packagemanager.restartExpectation',
	'packageManagerRestartAllExpectations' = 'userAction.packagemanager.restartAllExpectations',
	'packageManagerAbortExpectation' = 'userAction.packagemanager.abortExpectation',
	'packageManagerRestartPackageContainer' = 'userAction.packagemanager.restartPackageContainer',

	'regenerateRundownPlaylist' = 'userAction.ingest.regenerateRundownPlaylist',
	'restartCore' = 'userAction.system.restartCore',

	'guiFocused' = 'userAction.focused',
	'guiBlurred' = 'userAction.blurred',

	'switchRouteSet' = 'userAction.switchRouteSet',

	'disablePeripheralSubDevice' = 'userAction.system.disablePeripheralSubDevice',

	'executeUserChangeOperation' = 'userAction.executeUserChangeOperation',
	'activateAdlibTestingMode' = 'userAction.activateAdlibTestingMode',

	'createAdlibTestingRundownForShowStyleVariant' = 'userAction.createAdlibTestingRundownForShowStyleVariant',

	'setQuickLoopStart' = 'userAction.setQuickLoopStart',
	'setQuickLoopEnd' = 'userAction.setQuickLoopEnd',
	'clearQuickLoop' = 'userAction.clearQuickLoop',
}

export interface ReloadRundownPlaylistResponse {
	rundownsResponses: {
		rundownId: RundownId
		response: TriggerReloadDataResponse
	}[]
}

export enum TriggerReloadDataResponse {
	/** When reloading has been successfully completed */
	COMPLETED = 'ok',
	/** When reloading has successfully started, and will finish asynchronously */
	WORKING = 'working',
	/** When reloading cannot continue, because the rundown is missing */
	MISSING = 'missing',
}

export const SINGLE_USE_TOKEN_SALT = 'token_'
