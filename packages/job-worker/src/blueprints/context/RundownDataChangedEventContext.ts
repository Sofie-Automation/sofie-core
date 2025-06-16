import {
	IRundownDataChangedEventContext,
	IBlueprintExternalMessageQueueObj,
} from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { unprotectObjectArray } from '@sofie-automation/corelib/dist/protectedString'
import { formatDateAsTimecode, formatDurationAsTimecode } from '@sofie-automation/corelib/dist/lib'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { getCurrentTime } from '../../lib/index.js'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { ContextInfo } from './CommonContext.js'
import { RundownContext } from './RundownContext.js'

export class RundownDataChangedEventContext extends RundownContext implements IRundownDataChangedEventContext {
	constructor(
		protected readonly context: JobContext,
		contextInfo: ContextInfo,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		rundown: ReadonlyDeep<DBRundown>
	) {
		super(
			contextInfo,
			context.studio,
			context.getStudioBlueprintConfig(),
			showStyleCompound,
			context.getShowStyleBlueprintConfig(showStyleCompound),
			rundown
		)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}

	/** Get all unsent and queued messages in the rundown */
	async getAllUnsentQueuedMessages(): Promise<Readonly<IBlueprintExternalMessageQueueObj[]>> {
		return unprotectObjectArray(
			await this.context.directCollections.ExternalMessageQueue.findFetch(
				{
					rundownId: this._rundown._id,
					queueForLaterReason: { $exists: true },
				},
				{
					sort: {
						created: 1,
					},
				}
			)
		)
	}

	formatDateAsTimecode(time: number): string {
		if (typeof time !== 'number') throw new Error(`formatDateAsTimecode: time must be a number`)
		return formatDateAsTimecode(this.context.studio.settings, new Date(time))
	}
	formatDurationAsTimecode(time: number): string {
		if (typeof time !== 'number') throw new Error(`formatDurationAsTimecode: time must be a number`)
		return formatDurationAsTimecode(this.context.studio.settings, time)
	}
}
