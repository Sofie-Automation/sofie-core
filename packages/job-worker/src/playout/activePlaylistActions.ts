import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { ReadonlyDeep } from 'type-fest'
import { RundownActivationContext } from '../blueprints/context/RundownActivationContext.js'
import { JobContext } from '../jobs/index.js'
import { getCurrentTime } from '../lib/index.js'
import { logger } from '../logging.js'
import { getActiveRundownPlaylistsInStudioFromDb } from '../studio/lib.js'
import { cleanTimelineDatastore } from './datastore.js'
import { getActivationContextState, resetRundownPlaylist } from './lib.js'
import { PlayoutModel } from './model/PlayoutModel.js'
import { selectNextPart } from './selectNextPart.js'
import { setNextPart } from './setNext.js'
import { updateStudioTimeline, updateTimeline } from './timeline/generate.js'

export async function activateRundownPlaylist(
	context: JobContext,
	playoutModel: PlayoutModel,
	rehearsal: boolean,
	forceReset?: boolean
): Promise<void> {
	logger.info('Activating rundown ' + playoutModel.playlist._id + (rehearsal ? ' (Rehearsal)' : ''))

	rehearsal = !!rehearsal

	const anyOtherActiveRundowns = await getActiveRundownPlaylistsInStudioFromDb(
		context,
		context.studio._id,
		playoutModel.playlist._id
	)
	if (anyOtherActiveRundowns.length) {
		// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
		const otherActiveIds = anyOtherActiveRundowns.map((playlist) => playlist._id)
		throw new Error(
			'Only one rundown can be active at the same time. Active rundown playlists: ' +
				JSON.stringify(otherActiveIds)
		)
	}
	// Get the ActivationContext state, for later use. (This must be done before any actions are done on the PlayoutModel)
	const previousState = getActivationContextState(playoutModel)

	if (!playoutModel.playlist.activationId || forceReset) {
		// Reset the playlist if it wasnt already active
		await resetRundownPlaylist(context, playoutModel)
	}

	const newActivationId = playoutModel.activatePlaylist(rehearsal)

	const currentPartInstance = playoutModel.currentPartInstance
	if (currentPartInstance && !rehearsal) {
		const rundownId = currentPartInstance.partInstance.rundownId
		const rundown = playoutModel.getRundown(rundownId)
		if (!rundown) throw new Error(`Could not find rundown "${rundownId}"`)
		const currentSegment = playoutModel.findSegment(currentPartInstance.partInstance.segmentId)
		if (!currentSegment) throw new Error(`Could not find segment "${currentPartInstance.partInstance.segmentId}"`)
		if (currentSegment.segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING) {
			currentPartInstance.markAsReset()
			rundown.removeAdlibTestingSegment()
		}
	}

	let rundown: ReadonlyDeep<DBRundown> | undefined

	if (!currentPartInstance || currentPartInstance.partInstance.reset) {
		playoutModel.clearSelectedPartInstances()

		// If we are not playing anything, then regenerate the next part
		const firstPart = selectNextPart(
			context,
			playoutModel.playlist,
			null,
			null,
			playoutModel.getAllOrderedSegments(),
			playoutModel.getAllOrderedParts(),
			{ ignoreUnplayable: true, ignoreQuickLoop: false }
		)
		await setNextPart(context, playoutModel, firstPart, false)

		if (firstPart) {
			rundown = playoutModel.getRundown(firstPart.part.rundownId)?.rundown
		}
	} else {
		// Otherwise preserve the active partInstances
		for (const partInstance of playoutModel.selectedPartInstances) {
			partInstance.setPlaylistActivationId(newActivationId)
		}

		const nextPartInstance = playoutModel.nextPartInstance
		if (nextPartInstance) {
			rundown = playoutModel.getRundown(nextPartInstance.partInstance.rundownId)?.rundown
			if (!rundown) throw new Error(`Could not find rundown "${nextPartInstance.partInstance.rundownId}"`)
		}
	}

	await updateTimeline(context, playoutModel)

	// Get the ActivationContext state, for later use. (This must be done after all actions are done on the PlayoutModel)
	const currentState = getActivationContextState(playoutModel)

	playoutModel.deferBeforeSave(async () => {
		if (!rundown) return // if the proper rundown hasn't been found, there's little point doing anything else
		const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)

		try {
			if (blueprint.blueprint.onRundownActivate) {
				const blueprintContext = new RundownActivationContext(context, {
					playoutModel,
					showStyle,
					rundown,
					previousState,
					currentState,
				})

				await blueprint.blueprint.onRundownActivate(blueprintContext)
			}
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.onRundownActivate: ${stringifyError(err)}`)
		}
	})
}
export async function deactivateRundownPlaylist(context: JobContext, playoutModel: PlayoutModel): Promise<void> {
	// Get the ActivationContext state, for later use. (This must be done before any actions are done on the PlayoutModel)
	const previousState = getActivationContextState(playoutModel)

	const rundown = await deactivateRundownPlaylistInner(context, playoutModel)

	await updateStudioTimeline(context, playoutModel)

	await cleanTimelineDatastore(context, playoutModel)

	// Get the ActivationContext state, for later use. (This must be done after all actions are done on the PlayoutModel)
	const currentState = getActivationContextState(playoutModel)

	playoutModel.deferBeforeSave(async () => {
		if (rundown) {
			const showStyle = await context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
			const blueprint = await context.getShowStyleBlueprint(showStyle._id)

			try {
				if (blueprint.blueprint.onRundownDeActivate) {
					const blueprintContext = new RundownActivationContext(context, {
						playoutModel,
						showStyle,
						rundown,
						previousState,
						currentState,
					})
					await blueprint.blueprint.onRundownDeActivate(blueprintContext)
				}
			} catch (err) {
				logger.error(`Error in showStyleBlueprint.onRundownDeActivate: ${stringifyError(err)}`)
			}
		}
	})
}
export async function deactivateRundownPlaylistInner(
	context: JobContext,
	playoutModel: PlayoutModel
): Promise<ReadonlyDeep<DBRundown> | undefined> {
	const span = context.startSpan('deactivateRundownPlaylistInner')
	logger.info(`Deactivating rundown playlist "${playoutModel.playlist._id}"`)

	const currentPartInstance = playoutModel.currentPartInstance
	const nextPartInstance = playoutModel.nextPartInstance

	let rundown: ReadonlyDeep<DBRundown> | undefined
	if (currentPartInstance) {
		rundown = playoutModel.getRundown(currentPartInstance.partInstance.rundownId)?.rundown
	} else if (nextPartInstance) {
		rundown = playoutModel.getRundown(nextPartInstance.partInstance.rundownId)?.rundown
	}

	playoutModel.deactivatePlaylist()

	await setNextPart(context, playoutModel, null, false)

	if (currentPartInstance) {
		// Set the current PartInstance as stopped
		currentPartInstance.setPlannedStoppedPlayback(getCurrentTime())
	}

	if (span) span.end()
	return rundown
}
