import { OnExternalEventsProps } from '@sofie-automation/corelib/dist/worker/studio'
import { PeripheralDeviceExternalEvent } from '@sofie-automation/shared-lib/dist/peripheralDevice/externalEvents'
import { logger } from '../logging.js'
import { JobContext } from '../jobs/index.js'
import { PlayoutModel } from './model/PlayoutModel.js'
import { runJobWithPlayoutModel } from './lock.js'
import { runJobWithStudioPlayoutModel } from '../studio/lock.js'
import { ActionExecutionContext } from '../blueprints/context/adlibActions.js'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages.js'
import { PartAndPieceInstanceActionService } from '../blueprints/context/services/PartAndPieceInstanceActionService.js'
import { PersistentPlayoutStateStore } from '../blueprints/context/services/PersistantStateStore.js'
import { applyAnyExecutionSideEffects, storeNotificationsForCategory } from './adlibAction.js'
import { getCurrentTime } from '../lib/index.js'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { BlueprintExternalEvent } from '@sofie-automation/blueprints-integration'

/**
 * Called by sofie-core when one or more external events have been received from a gateway.
 *
 * Events from multiple gateways, or from rapid bursts on a single gateway, are merged into a
 * single job invocation by the queue manager to prevent flooding.
 *
 * For each active playlist in the studio, the show-style blueprint's `onExternalEvent` handler
 * is invoked if it is defined.
 */
export async function handleOnExternalEvents(context: JobContext, data: OnExternalEventsProps): Promise<void> {
	if (!data.events.length) return

	logger.debug(`handleOnExternalEvents: received ${data.events.length} event(s)`)

	await runJobWithStudioPlayoutModel(context, async (studioPlayoutModel) => {
		const activePlaylists = studioPlayoutModel.getActiveRundownPlaylists()
		if (activePlaylists.length === 0) {
			logger.debug('handleOnExternalEvents: no active playlists — events discarded')
			return
		}

		for (const playlist of activePlaylists) {
			await runJobWithPlayoutModel(context, { playlistId: playlist._id }, null, async (playoutModel) => {
				await executeOnExternalEventsForPlaylist(context, playoutModel, data.events)
			})
		}
	})
}

async function executeOnExternalEventsForPlaylist(
	context: JobContext,
	playoutModel: PlayoutModel,
	wireEvents: PeripheralDeviceExternalEvent[]
): Promise<void> {
	const playlist = playoutModel.playlist

	const activePartInfo = playlist.currentPartInfo ?? playlist.nextPartInfo
	if (!activePartInfo) {
		logger.error(
			`handleOnExternalEvents: playlist "${playlist._id}" has neither currentPartInfo nor nextPartInfo — events will be lost`
		)
		return
	}

	const currentRundown = playoutModel.getRundown(activePartInfo.rundownId)
	if (!currentRundown) {
		logger.error(
			`executeOnExternalEventsForPlaylist: rundown "${activePartInfo.rundownId}" not found in playlist "${playlist._id}" — events will be lost`
		)
		return
	}

	const showStyle = await context.getShowStyleCompound(
		currentRundown.rundown.showStyleVariantId,
		currentRundown.rundown.showStyleBaseId
	)
	const blueprint = await context.getShowStyleBlueprint(showStyle._id)

	if (!blueprint.blueprint.onExternalEvent) {
		logger.debug(
			`executeOnExternalEventsForPlaylist: blueprint for show style "${showStyle._id}" has no onExternalEvent handler — events discarded`
		)
		return
	}

	logger.debug(
		`executeOnExternalEventsForPlaylist: invoking onExternalEvent for playlist "${playlist._id}" with ${wireEvents.length} event(s): ${wireEvents.map((e) => `${e.type}/${(e as { event?: string }).event ?? '?'}`).join(', ')}`
	)

	const now = getCurrentTime()

	// Future: This may want to become a different context, but for now the types align cleanly
	const actionContext = new ActionExecutionContext(
		{
			name: `${currentRundown.rundown.name}(${playlist.name})`,
			identifier: `playlist=${playlist._id},rundown=${currentRundown.rundown._id},activePartInstance=${
				activePartInfo.partInstanceId
			},execution=${getRandomId()}`,
		},
		context,
		playoutModel,
		showStyle,
		context.getShowStyleBlueprintConfig(showStyle),
		WatchedPackagesHelper.empty(context),
		new PartAndPieceInstanceActionService(context, playoutModel, showStyle, currentRundown)
	)

	const persistentState = new PersistentPlayoutStateStore(
		playlist.privatePlayoutPersistentState,
		playlist.publicPlayoutPersistentState
	)

	// Cast the wire events to blueprint events.
	// PeripheralDeviceExternalTSREvent has the same shape as BlueprintExternalTSREvent, but uses
	// `deviceType: string` (loose) rather than the strongly-typed TSR enum, to accommodate custom
	// TSR plugin device types that do not appear in the closed enum.
	const blueprintEvents = wireEvents as unknown as BlueprintExternalEvent[]

	await blueprint.blueprint.onExternalEvent(actionContext, persistentState, blueprintEvents)
	persistentState.saveToModel(playoutModel)

	storeNotificationsForCategory(
		playoutModel,
		`externalEvent:${getRandomId()}`,
		blueprint.blueprintId,
		actionContext.notes,
		playlist.currentPartInfo ?? playlist.nextPartInfo
	)

	await applyAnyExecutionSideEffects(context, playoutModel, actionContext, now)
}
