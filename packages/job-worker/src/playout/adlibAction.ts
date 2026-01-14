import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { ExecuteActionProps, ExecuteActionResult } from '@sofie-automation/corelib/dist/worker/studio'
import { WrappedShowStyleBlueprint } from '../blueprints/cache.js'
import { DatastoreActionExecutionContext, ActionExecutionContext } from '../blueprints/context/index.js'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages.js'
import { JobContext, ProcessedShowStyleCompound } from '../jobs/index.js'
import { getCurrentTime } from '../lib/index.js'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutModel, PlayoutModelPreInit } from './model/PlayoutModel.js'
import { runJobWithPlaylistLock } from './lock.js'
import { updateTimeline } from './timeline/generate.js'
import { performTakeToNextedPart } from './take.js'
import { ActionUserData } from '@sofie-automation/blueprints-integration'
import { DBRundownPlaylist, SelectedPartInstance } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { logger } from '../logging.js'
import {
	AdLibActionId,
	BlueprintId,
	BucketAdLibActionId,
	RundownBaselineAdLibActionId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PlayoutRundownModel } from './model/PlayoutRundownModel.js'
import { createPlayoutModelfromInitModel, loadPlayoutModelPreInit } from './model/implementation/LoadPlayoutModel.js'
import {
	ActionPartChange,
	PartAndPieceInstanceActionService,
	applyActionSideEffects,
} from '../blueprints/context/services/PartAndPieceInstanceActionService.js'
import { convertNoteToNotification } from '../notifications/util.js'
import type { INoteBase } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { NotificationsModelHelper } from '../notifications/NotificationsModelHelper.js'
import type { INotificationsModel } from '../notifications/NotificationsModel.js'
import { PersistentPlayoutStateStore } from '../blueprints/context/services/PersistantStateStore.js'

/**
 * Execute an AdLib Action
 */
export async function handleExecuteAdlibAction(
	context: JobContext,
	data: ExecuteActionProps
): Promise<ExecuteActionResult> {
	return runJobWithPlaylistLock(context, data, async (playlist, lock) => {
		// First load the minimum amount of data required to run the executeDataStoreAction handler
		if (!playlist) throw new Error(`Job playlist "${data.playlistId}" not found `)

		if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)
		if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart, undefined, 412)

		const initPlayoutModel = await loadPlayoutModelPreInit(context, lock, playlist, false)

		return executeAdlibActionAndSaveModel(context, playlist, initPlayoutModel, data)
	})
}

export async function executeAdlibActionAndSaveModel(
	context: JobContext,
	playlist: DBRundownPlaylist,
	initPlayoutModel: PlayoutModelPreInit,
	data: ExecuteActionProps
): Promise<ExecuteActionResult> {
	if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)
	if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart, undefined, 412)

	const rundown = initPlayoutModel.getRundown(playlist.currentPartInfo.rundownId)
	if (!rundown) throw new Error(`Current Rundown "${playlist.currentPartInfo.rundownId}" could not be found`)

	const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)

	const blueprint = await context.getShowStyleBlueprint(showStyle._id)

	if (!blueprint.blueprint.executeAction && !blueprint.blueprint.executeDataStoreAction) {
		throw UserError.create(UserErrorMessage.ActionsNotSupported)
	}

	const [adLibAction, baselineAdLibAction, bucketAdLibAction] = await Promise.all([
		context.directCollections.AdLibActions.findOne(data.actionDocId as AdLibActionId, {
			projection: { _id: 1, privateData: 1 },
		}),
		context.directCollections.RundownBaselineAdLibActions.findOne(
			data.actionDocId as RundownBaselineAdLibActionId,
			{
				projection: { _id: 1, privateData: 1 },
			}
		),
		context.directCollections.BucketAdLibActions.findOne(data.actionDocId as BucketAdLibActionId, {
			projection: { _id: 1, privateData: 1 },
		}),
	])
	const adLibActionDoc = adLibAction ?? baselineAdLibAction ?? bucketAdLibAction

	let watchedPackages = WatchedPackagesHelper.empty(context)
	if (adLibActionDoc && 'rundownId' in adLibActionDoc) {
		watchedPackages = await WatchedPackagesHelper.create(context, adLibActionDoc.rundownId, null, {
			fromPieceType: {
				$in: [ExpectedPackageDBType.ADLIB_ACTION, ExpectedPackageDBType.BASELINE_ADLIB_ACTION],
			},
			pieceId: data.actionDocId,
		})
	} else if (adLibActionDoc && 'bucketId' in adLibActionDoc) {
		watchedPackages = await WatchedPackagesHelper.create(context, null, adLibActionDoc.bucketId, {
			fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION,
			pieceId: data.actionDocId,
		})
	}

	const actionParameters: ExecuteActionParameters = {
		actionId: data.actionId,
		userData: data.userData,
		triggerMode: data.triggerMode,
		privateData: adLibActionDoc?.privateData,
		publicData: adLibActionDoc?.publicData,
		actionOptions: data.actionOptions,
	}

	try {
		const dataStoreActionNotes = await executeDataStoreAction(
			context,
			playlist,
			rundown,
			showStyle,
			blueprint,
			watchedPackages,
			actionParameters
		)

		// Save the notes immediately, as they are not dependent on the action and want to be saved even if the action fails
		if (dataStoreActionNotes.length > 0) {
			const notificationHelper = new NotificationsModelHelper(context, `playout:${playlist._id}`, playlist._id)
			storeNotificationsForCategory(
				notificationHelper,
				`dataStoreAction:${getRandomId()}`, // Always append and leave existing notes
				blueprint.blueprintId,
				dataStoreActionNotes,
				playlist.currentPartInfo ?? playlist.nextPartInfo
			)

			// Save the notifications asynchonously
			notificationHelper.saveAllToDatabase().catch((err) => {
				logger.error(`Saving notifications from executeDatastoreAction failed: ${stringifyError(err)}`)
			})
		}
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.executeDatastoreAction: ${stringifyError(err)}`)
	}

	if (blueprint.blueprint.executeAction) {
		// load a full model for the regular actions & executet the handler
		const playoutModel = await createPlayoutModelfromInitModel(context, initPlayoutModel)

		const fullRundown = playoutModel.getRundown(rundown._id)
		if (!fullRundown) throw new Error(`Rundown "${rundown._id}" missing between models`)

		try {
			const res: ExecuteActionResult = await executeActionInner(
				context,
				playoutModel,
				fullRundown,
				showStyle,
				blueprint,
				watchedPackages,
				actionParameters
			)

			await playoutModel.saveAllToDatabase()

			return res
		} catch (err) {
			playoutModel.dispose()
			throw err
		}
	}

	// if we haven't returned yet, these defaults should be correct
	return {
		queuedPartInstanceId: undefined,
		taken: false,
	}
}

export interface ExecuteActionParameters {
	/** Id of the action */
	actionId: string
	/** Public-facing (and possibly even user-editable) properties defining the action behaviour */
	userData: ActionUserData
	/** Arbitraty data storage for internal use in the blueprints */
	privateData: unknown | undefined
	/** Optional arbitraty data used to modify the action parameters */
	publicData: unknown | undefined
	/** Optional arbitraty data used to modify the action parameters */
	actionOptions: { [key: string]: any } | undefined

	triggerMode: string | undefined
}

export async function executeActionInner(
	context: JobContext,
	playoutModel: PlayoutModel,
	rundown: PlayoutRundownModel,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	watchedPackages: WatchedPackagesHelper,
	actionParameters: ExecuteActionParameters
): Promise<ExecuteActionResult> {
	const now = getCurrentTime()

	const playlist = playoutModel.playlist

	const actionContext = new ActionExecutionContext(
		{
			name: `${rundown.rundown.name}(${playlist.name})`,
			identifier: `playlist=${playlist._id},rundown=${rundown.rundown._id},currentPartInstance=${
				playlist.currentPartInfo?.partInstanceId
			},execution=${getRandomId()}`,
		},
		context,
		playoutModel,
		showStyle,
		context.getShowStyleBlueprintConfig(showStyle),
		watchedPackages,
		new PartAndPieceInstanceActionService(context, playoutModel, showStyle, rundown)
	)

	// If any action cannot be done due to timings, that needs to be rejected by the context
	if (!blueprint.blueprint.executeAction) throw UserError.create(UserErrorMessage.ActionsNotSupported)

	logger.info(`Executing AdlibAction "${actionParameters.actionId}"`)
	logger.silly(
		`Executing AdlibAction Payload "${actionParameters.actionId}" Payload: ${JSON.stringify(
			actionParameters.userData
		)} (${actionParameters.triggerMode})`
	)

	try {
		const blueprintPersistentState = new PersistentPlayoutStateStore(playoutModel.playlist.previousPersistentState)

		await blueprint.blueprint.executeAction(
			actionContext,
			blueprintPersistentState,
			actionParameters.actionId,
			actionParameters.userData,
			actionParameters.triggerMode,
			actionParameters.privateData,
			actionParameters.publicData,
			actionParameters.actionOptions ?? {}
		)

		if (blueprintPersistentState.hasChanges) {
			playoutModel.setBlueprintPersistentState(blueprintPersistentState.getAll())
		}
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.executeAction: ${stringifyError(err)}`)
		throw UserError.fromUnknown(err)
	}

	// Store any notes generated by the action
	storeNotificationsForCategory(
		playoutModel,
		`adlibAction:${getRandomId()}`, // Always append and leave existing notes
		blueprint.blueprintId,
		actionContext.notes,
		playlist.currentPartInfo ?? playlist.nextPartInfo
	)

	await applyAnyExecutionSideEffects(context, playoutModel, actionContext, now)

	return {
		queuedPartInstanceId: actionContext.queuedPartInstanceId,
		taken: actionContext.takeAfterExecute,
	}
}

async function applyAnyExecutionSideEffects(
	context: JobContext,
	playoutModel: PlayoutModel,
	actionContext: ActionExecutionContext,
	now: number
) {
	await applyActionSideEffects(context, playoutModel, actionContext)

	if (actionContext.takeAfterExecute) {
		await performTakeToNextedPart(context, playoutModel, now)
	} else if (
		actionContext.forceRegenerateTimeline ||
		actionContext.currentPartState !== ActionPartChange.NONE ||
		actionContext.nextPartState !== ActionPartChange.NONE
	) {
		await updateTimeline(context, playoutModel)
	}
}

async function executeDataStoreAction(
	context: JobContext,
	playlist: DBRundownPlaylist,
	rundown: DBRundown,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	watchedPackages: WatchedPackagesHelper,
	actionParameters: ExecuteActionParameters
): Promise<INoteBase[]> {
	const executeDataStoreAction = blueprint.blueprint.executeDataStoreAction
	if (!executeDataStoreAction) return []

	// now we can execute any datastore actions
	const actionContext = new DatastoreActionExecutionContext(
		{
			name: `${rundown.name}(${playlist.name})`,
			identifier: `playlist=${playlist._id},rundown=${rundown._id},currentPartInstance=${
				playlist.currentPartInfo?.partInstanceId
			},execution=${getRandomId()}`,
		},
		context,
		showStyle,
		watchedPackages
	)
	logger.info(`Executing Datastore AdlibAction "${actionParameters.actionId}"`)
	logger.silly(
		`Datastore AdlibAction "${actionParameters.actionId}" Payload: ${JSON.stringify(actionParameters.userData)}`
	)

	try {
		await executeDataStoreAction(
			actionContext,
			actionParameters.actionId,
			actionParameters.userData,
			actionParameters.triggerMode
		)

		return actionContext.notes
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.executeDatastoreAction: ${stringifyError(err)}`)
		throw err
	}
}

function storeNotificationsForCategory(
	notificationHelper: INotificationsModel,
	notificationCategory: string,
	blueprintId: BlueprintId,
	notes: INoteBase[],
	partInstanceInfo: SelectedPartInstance | null
) {
	for (const note of notes) {
		notificationHelper.setNotification(notificationCategory, {
			...convertNoteToNotification(note, [blueprintId]),
			relatedTo: partInstanceInfo
				? {
						type: 'partInstance',
						rundownId: partInstanceInfo.rundownId,
						partInstanceId: partInstanceInfo.partInstanceId,
					}
				: {
						type: 'playlist',
					},
		})
	}
}
