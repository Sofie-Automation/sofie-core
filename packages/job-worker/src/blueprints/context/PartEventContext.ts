import type { IBlueprintPartInstance, IPartEventContext, Time } from '@sofie-automation/blueprints-integration'
import type { ReadonlyDeep } from 'type-fest'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import type { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { getCurrentTime } from '../../lib/index.js'
import type { JobContext, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { convertPartInstanceToBlueprints } from './lib.js'
import { RundownContext } from './RundownContext.js'
import { TTimersService } from './services/TTimersService.js'
import type { PlayoutModel } from '../../playout/model/PlayoutModel.js'
import type { IPlaylistTTimer } from '@sofie-automation/blueprints-integration/dist/context/tTimersContext'
import type { RundownTTimerIndex } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/TTimers'

export class PartEventContext extends RundownContext implements IPartEventContext {
	readonly #tTimersService: TTimersService
	readonly #startedPlayback: Time | undefined

	readonly part: Readonly<IBlueprintPartInstance>

	constructor(
		context: JobContext,
		playoutModel: PlayoutModel,
		eventName: string,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		rundown: ReadonlyDeep<DBRundown>,
		partInstance: ReadonlyDeep<DBPartInstance>
	) {
		super(
			{
				name: `Event: ${eventName}`,
				identifier: `rundownId=${rundown._id},blueprintId=${showStyleCompound.blueprintId}`,
			},
			context.studio,
			context.getStudioBlueprintConfig(),
			showStyleCompound,
			context.getShowStyleBlueprintConfig(showStyleCompound),
			rundown
		)

		this.#tTimersService = TTimersService.withPlayoutModel(playoutModel, context)
		this.part = convertPartInstanceToBlueprints(partInstance)
		this.#startedPlayback = playoutModel.playlist.startedPlayback
	}

	override get startedPlayback(): Time | undefined {
		return this.#startedPlayback
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}

	getTimer(index: RundownTTimerIndex): IPlaylistTTimer {
		return this.#tTimersService.getTimer(index)
	}
	clearAllTimers(): void {
		this.#tTimersService.clearAllTimers()
	}
}
