import {
	ExpectedPackageId,
	ExpectedPackageWorkStatusId,
	MediaWorkFlowId,
	MediaWorkFlowStepId,
	PeripheralDeviceCommandId,
	PeripheralDeviceId,
	TimelineHash,
} from '../core/model/Ids.js'
import { PeripheralDeviceForDevice } from '../core/model/peripheralDevice.js'
import { IngestPlaylist, IngestRundown, IngestPart, IngestSegment } from './ingest.js'
import { MediaObjectRevision, MediaWorkFlowRevision, MediaWorkFlowStepRevision } from './mediaManager.js'
import {
	IMOSRunningOrder,
	IMOSRunningOrderBase,
	IMOSRunningOrderStatus,
	IMOSStoryStatus,
	IMOSItemStatus,
	IMOSStoryAction,
	IMOSROStory,
	IMOSItemAction,
	IMOSItem,
	IMOSROAction,
	IMOSROReadyToAir,
	IMOSROFullStory,
} from '@mos-connection/model'
import { IMOSString128 } from '@mos-connection/model'
import { ExpectedPackageStatusAPI } from '../package-manager/package.js'
import {
	PeripheralDeviceInitOptions,
	PeripheralDeviceStatusObject,
	TimelineTriggerTimeResult,
	DiffTimeResult,
	TimeDiff,
	PlayoutChangedResults,
} from './peripheralDeviceAPI.js'
import { MediaObject } from '../core/model/MediaObjects.js'
import { MediaWorkFlow } from '../core/model/MediaWorkFlows.js'
import { MediaWorkFlowStep } from '../core/model/MediaWorkFlowSteps.js'

export type UpdateExpectedPackageWorkStatusesChanges =
	| {
			id: ExpectedPackageWorkStatusId
			type: 'delete'
	  }
	| {
			id: ExpectedPackageWorkStatusId
			type: 'insert'
			status: ExpectedPackageStatusAPI.WorkStatus
	  }
	| {
			id: ExpectedPackageWorkStatusId
			type: 'update'
			status: Partial<ExpectedPackageStatusAPI.WorkStatus>
	  }

export type UpdatePackageContainerPackageStatusesChanges =
	| {
			containerId: string
			packageId: string
			type: 'delete'
	  }
	| {
			containerId: string
			packageId: string
			type: 'update'
			status: ExpectedPackageStatusAPI.PackageContainerPackageStatus
	  }

export type UpdatePackageContainerStatusesChanges =
	| {
			containerId: string
			type: 'delete'
	  }
	| {
			containerId: string
			type: 'update'
			status: ExpectedPackageStatusAPI.PackageContainerStatus
	  }

export interface NewPeripheralDeviceAPI {
	functionReply(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		commandId: PeripheralDeviceCommandId,
		err: any,
		result: any
	): Promise<void>
	initialize(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		options: PeripheralDeviceInitOptions
	): Promise<PeripheralDeviceId>
	unInitialize(deviceId: PeripheralDeviceId, deviceToken: string): Promise<PeripheralDeviceId>
	setStatus(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		status: PeripheralDeviceStatusObject
	): Promise<PeripheralDeviceStatusObject>
	ping(deviceId: PeripheralDeviceId, deviceToken: string): Promise<void>
	getPeripheralDevice(deviceId: PeripheralDeviceId, deviceToken: string): Promise<PeripheralDeviceForDevice>
	playoutPlaybackChanged(deviceId: PeripheralDeviceId, deviceToken: string, r: PlayoutChangedResults): Promise<void>
	pingWithCommand(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		message: string,
		cb?: (err: any | null, msg: any) => void
	): Promise<void>
	killProcess(deviceId: PeripheralDeviceId, deviceToken: string, really: boolean): Promise<boolean>
	testMethod(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		returnValue: string,
		throwError?: boolean
	): Promise<string>
	timelineTriggerTime(deviceId: PeripheralDeviceId, deviceToken: string, r: TimelineTriggerTimeResult): Promise<void>
	requestUserAuthToken(deviceId: PeripheralDeviceId, deviceToken: string, authUrl: string): Promise<void>
	storeAccessToken(deviceId: PeripheralDeviceId, deviceToken: string, authToken: string): Promise<void>
	removePeripheralDevice(deviceId: PeripheralDeviceId): Promise<void>
	reportResolveDone(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		timelineHash: TimelineHash,
		resolveDuration: number
	): Promise<void>

	dataPlaylistGet(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		playlistExternalId: string
	): Promise<IngestPlaylist>
	dataRundownList(deviceId: PeripheralDeviceId, deviceToken: string): Promise<string[]>
	dataRundownGet(deviceId: PeripheralDeviceId, deviceToken: string, rundownExternalId: string): Promise<IngestRundown>
	dataRundownDelete(deviceId: PeripheralDeviceId, deviceToken: string, rundownExternalId: string): Promise<void>
	dataRundownCreate(deviceId: PeripheralDeviceId, deviceToken: string, ingestRundown: IngestRundown): Promise<void>
	dataRundownUpdate(deviceId: PeripheralDeviceId, deviceToken: string, ingestRundown: IngestRundown): Promise<void>
	dataRundownMetaDataUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		ingestRundown: Omit<IngestRundown, 'segments'>
	): Promise<void>
	dataSegmentGet(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	): Promise<IngestSegment>
	dataSegmentDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	): Promise<void>
	dataSegmentCreate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	): Promise<void>
	dataSegmentUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	): Promise<void>
	dataSegmentRanksUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		newRanks: { [segmentExternalId: string]: number }
	): Promise<void>
	dataPartDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		partExternalId: string
	): Promise<void>
	dataPartCreate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	): Promise<void>
	dataPartUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	): Promise<void>

	mosRoCreate(deviceId: PeripheralDeviceId, deviceToken: string, mosRunningOrder: IMOSRunningOrder): Promise<void>
	mosRoReplace(deviceId: PeripheralDeviceId, deviceToken: string, mosRunningOrder: IMOSRunningOrder): Promise<void>
	mosRoDelete(deviceId: PeripheralDeviceId, deviceToken: string, mosRunningOrderId: IMOSString128): Promise<void>
	mosRoMetadata(deviceId: PeripheralDeviceId, deviceToken: string, metadata: IMOSRunningOrderBase): Promise<void>
	mosRoStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: IMOSRunningOrderStatus): Promise<void>
	mosRoStoryStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: IMOSStoryStatus): Promise<void>
	mosRoItemStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: IMOSItemStatus): Promise<void>
	mosRoStoryInsert(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: IMOSStoryAction,
		Stories: Array<IMOSROStory>
	): Promise<void>
	mosRoItemInsert(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: IMOSItemAction,
		Items: Array<IMOSItem>
	): Promise<void>
	mosRoStoryReplace(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: IMOSStoryAction,
		Stories: Array<IMOSROStory>
	): Promise<void>
	mosRoItemReplace(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: IMOSItemAction,
		Items: Array<IMOSItem>
	): Promise<void>
	mosRoStoryMove(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: IMOSStoryAction,
		Stories: Array<IMOSString128>
	): Promise<void>
	mosRoItemMove(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: IMOSItemAction,
		Items: Array<IMOSString128>
	): Promise<void>
	mosRoStoryDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: IMOSROAction,
		Stories: Array<IMOSString128>
	): Promise<void>
	mosRoItemDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: IMOSStoryAction,
		Items: Array<IMOSString128>
	): Promise<void>
	mosRoStorySwap(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: IMOSROAction,
		StoryID0: IMOSString128,
		StoryID1: IMOSString128
	): Promise<void>
	mosRoItemSwap(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: IMOSStoryAction,
		ItemID0: IMOSString128,
		ItemID1: IMOSString128
	): Promise<void>
	mosRoReadyToAir(deviceId: PeripheralDeviceId, deviceToken: string, Action: IMOSROReadyToAir): Promise<void>
	mosRoFullStory(deviceId: PeripheralDeviceId, deviceToken: string, story: IMOSROFullStory): Promise<void>

	getMediaObjectRevisions(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		collectionId: string
	): Promise<MediaObjectRevision[]>
	updateMediaObject(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		collectionId: string,
		id: string,
		doc: MediaObject | null
	): Promise<void>
	clearMediaObjectCollection(deviceId: PeripheralDeviceId, deviceToken: string, collectionId: string): Promise<void>

	getMediaWorkFlowRevisions(deviceId: PeripheralDeviceId, deviceToken: string): Promise<MediaWorkFlowRevision[]>
	getMediaWorkFlowStepRevisions(
		deviceId: PeripheralDeviceId,
		deviceToken: string
	): Promise<MediaWorkFlowStepRevision[]>
	updateMediaWorkFlow(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		workFlowId: MediaWorkFlowId,
		obj: MediaWorkFlow | null
	): Promise<void>
	updateMediaWorkFlowStep(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		docId: MediaWorkFlowStepId,
		obj: MediaWorkFlowStep | null
	): Promise<void>

	updateExpectedPackageWorkStatuses(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		changes: UpdateExpectedPackageWorkStatusesChanges[]
	): Promise<void>
	removeAllExpectedPackageWorkStatusOfDevice(deviceId: PeripheralDeviceId, deviceToken: string): Promise<void>

	updatePackageContainerPackageStatuses(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		changes: UpdatePackageContainerPackageStatusesChanges[]
	): Promise<void>
	removeAllPackageContainerPackageStatusesOfDevice(deviceId: PeripheralDeviceId, deviceToken: string): Promise<void>

	updatePackageContainerStatuses(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		changes: UpdatePackageContainerStatusesChanges[]
	): Promise<void>
	removeAllPackageContainerStatusesOfDevice(deviceId: PeripheralDeviceId, deviceToken: string): Promise<void>

	fetchPackageInfoMetadata(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		type: string,
		packageIds: ExpectedPackageId[]
	): Promise<{ packageId: ExpectedPackageId; expectedContentVersionHash: string; actualContentVersionHash: string }[]>
	updatePackageInfo(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		type: string,
		packageId: ExpectedPackageId,
		expectedContentVersionHash: string,
		actualContentVersionHash: string,
		payload: any
	): Promise<void>
	removePackageInfo(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		type: string,
		packageId: ExpectedPackageId,
		removeDelay?: number
	): Promise<void>

	/**
	 * This method is being called by a Peripheral Device handling external triggers when it receives an external
	 * trigger event or an external input changes it's state (a knob changes it's rotation, a joystick is moved, etc.)
	 *
	 * @param {PeripheralDeviceId} deviceId
	 * @param {string} deviceToken
	 * @param {string} triggerDeviceId The ID of the actual input device providing this input.
	 * Can be shared across multiple physical devices in the system with the same characteristics: a primary and
	 * backup hardware controller, etc.
	 * @param {string} triggerId The ID of the trigger within the input device providing the input. An identifier of a
	 * button, control knob, GPI port, etc.
	 * @param {(Record<string, string | number | boolean> | null)} [values] An arbitrary map of values acompanying this
	 * input: voltage, pressure, position, etc.
	 * @memberof NewPeripheralDeviceAPI
	 */
	inputDeviceTrigger(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		triggerDeviceId: string,
		triggerId: string,
		values: Record<string, string | number | boolean> | null
	): Promise<void>

	determineDiffTime(): Promise<DiffTimeResult>
	getTimeDiff(): Promise<TimeDiff>
	getTime(): Promise<number>
}

export enum PeripheralDeviceAPIMethods {
	'functionReply' = 'peripheralDevice.functionReply',

	'testMethod' = 'peripheralDevice.testMethod',
	'setStatus' = 'peripheralDevice.status',
	'ping' = 'peripheralDevice.ping',
	'initialize' = 'peripheralDevice.initialize',
	'unInitialize' = 'peripheralDevice.unInitialize',
	'getPeripheralDevice' = 'peripheralDevice.getPeripheralDevice',
	'pingWithCommand' = 'peripheralDevice.pingWithCommand',
	'killProcess' = 'peripheralDevice.killProcess',
	'removePeripheralDevice' = 'peripheralDevice.removePeripheralDevice',
	'reportResolveDone' = 'peripheralDevice.reportResolveDone',

	'determineDiffTime' = 'systemTime.determineDiffTime',
	'getTimeDiff' = 'systemTime.getTimeDiff',
	'getTime' = 'systemTime.getTime',

	'timelineTriggerTime' = 'peripheralDevice.timeline.setTimelineTriggerTime',

	'playoutPlaybackChanged' = 'peripheralDevice.playout.playbackChanged',

	'getDebugStates' = 'peripheralDevice.playout.getDebugStates',

	// 'reportCommandError' = 'peripheralDevice.playout.reportCommandError',

	'mosRoCreate' = 'peripheralDevice.mos.roCreate',
	'mosRoReplace' = 'peripheralDevice.mos.roReplace',
	'mosRoDelete' = 'peripheralDevice.mos.roDelete',
	'mosRoDeleteForce' = 'peripheralDevice.mos.roDeleteForce',
	'mosRoMetadata' = 'peripheralDevice.mos.roMetadata',
	'mosRoStatus' = 'peripheralDevice.mos.roStatus',
	'mosRoStoryStatus' = 'peripheralDevice.mos.roStoryStatus',
	'mosRoItemStatus' = 'peripheralDevice.mos.roItemStatus',
	'mosRoStoryInsert' = 'peripheralDevice.mos.roStoryInsert',
	'mosRoStoryReplace' = 'peripheralDevice.mos.roStoryReplace',
	'mosRoStoryMove' = 'peripheralDevice.mos.roStoryMove',
	'mosRoStoryDelete' = 'peripheralDevice.mos.roStoryDelete',
	'mosRoStorySwap' = 'peripheralDevice.mos.roStorySwap',
	'mosRoItemInsert' = 'peripheralDevice.mos.roItemInsert',
	'mosRoItemReplace' = 'peripheralDevice.mos.roItemReplace',
	'mosRoItemMove' = 'peripheralDevice.mos.roItemMove',
	'mosRoItemDelete' = 'peripheralDevice.mos.roItemDelete',
	'mosRoItemSwap' = 'peripheralDevice.mos.roItemSwap',
	'mosRoReadyToAir' = 'peripheralDevice.mos.roReadyToAir',
	'mosRoFullStory' = 'peripheralDevice.mos.roFullStory',

	'dataPlaylistGet' = 'peripheralDevice.playlist.playlistGet',
	'dataRundownList' = 'peripheralDevice.rundown.rundownList',
	'dataRundownGet' = 'peripheralDevice.rundown.rundownGet',
	'dataRundownDelete' = 'peripheralDevice.rundown.rundownDelete',
	'dataRundownCreate' = 'peripheralDevice.rundown.rundownCreate',
	'dataRundownUpdate' = 'peripheralDevice.rundown.rundownUpdate',
	'dataRundownMetaDataUpdate' = 'peripheralDevice.rundown.rundownMetaDataUpdate',
	'dataSegmentGet' = 'peripheralDevice.rundown.segmentGet',
	'dataSegmentDelete' = 'peripheralDevice.rundown.segmentDelete',
	'dataSegmentCreate' = 'peripheralDevice.rundown.segmentCreate',
	'dataSegmentUpdate' = 'peripheralDevice.rundown.segmentUpdate',
	'dataSegmentRanksUpdate' = 'peripheralDevice.rundown.segmentRanksUpdate',
	'dataPartDelete' = 'peripheralDevice.rundown.partDelete',
	'dataPartCreate' = 'peripheralDevice.rundown.partCreate',
	'dataPartUpdate' = 'peripheralDevice.rundown.partUpdate',

	'getMediaObjectRevisions' = 'peripheralDevice.mediaScanner.getMediaObjectRevisions',
	'updateMediaObject' = 'peripheralDevice.mediaScanner.updateMediaObject',
	'clearMediaObjectCollection' = 'peripheralDevice.mediaScanner.clearMediaObjectCollection',

	'getMediaWorkFlowRevisions' = 'peripheralDevice.mediaManager.getMediaWorkFlowRevisions',
	'updateMediaWorkFlow' = 'peripheralDevice.mediaManager.updateMediaWorkFlow',
	'getMediaWorkFlowStepRevisions' = 'peripheralDevice.mediaManager.getMediaWorkFlowStepRevisions',
	'updateMediaWorkFlowStep' = 'peripheralDevice.mediaManager.updateMediaWorkFlowStep',

	'updateExpectedPackageWorkStatuses' = 'peripheralDevice.packageManager.updateExpectedPackageWorkStatuses',
	'removeAllExpectedPackageWorkStatusOfDevice' = 'peripheralDevice.packageManager.removeAllExpectedPackageWorkStatusOfDevice',

	'updatePackageContainerPackageStatuses' = 'peripheralDevice.packageManager.updatePackageContainerPackageStatuses',
	'removeAllPackageContainerPackageStatusesOfDevice' = 'peripheralDevice.packageManager.removeAllPackageContainerPackageStatusesOfDevice',

	'updatePackageContainerStatuses' = 'peripheralDevice.packageManager.updatePackageContainerStatuses',
	'removeAllPackageContainerStatusesOfDevice' = 'peripheralDevice.packageManager.removeAllPackageContainerStatusesOfDevice',

	'fetchPackageInfoMetadata' = 'peripheralDevice.packageManager.fetchPackageInfoMetadata',
	'updatePackageInfo' = 'peripheralDevice.packageManager.updatePackageInfo',
	'removePackageInfo' = 'peripheralDevice.packageManager.removePackageInfo',

	'requestUserAuthToken' = 'peripheralDevice.spreadsheet.requestUserAuthToken',
	'storeAccessToken' = 'peripheralDevice.spreadsheet.storeAccessToken',

	'inputDeviceTrigger' = 'peripheralDevice.input.inputDeviceTrigger',
}
