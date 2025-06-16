import { IBlueprintPartInstance, IPartEventContext } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { getCurrentTime } from '../../lib/index.js'
import { ProcessedStudioConfig, ProcessedShowStyleConfig } from '../config.js'
import { JobStudio, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { convertPartInstanceToBlueprints } from './lib.js'
import { RundownContext } from './RundownContext.js'

export class PartEventContext extends RundownContext implements IPartEventContext {
	readonly part: Readonly<IBlueprintPartInstance>

	constructor(
		eventName: string,
		studio: ReadonlyDeep<JobStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		rundown: ReadonlyDeep<DBRundown>,
		partInstance: ReadonlyDeep<DBPartInstance>
	) {
		super(
			{
				name: `Event: ${eventName}`,
				identifier: `rundownId=${rundown._id},blueprintId=${showStyleCompound.blueprintId}`,
			},
			studio,
			studioBlueprintConfig,
			showStyleCompound,
			showStyleBlueprintConfig,
			rundown
		)

		this.part = convertPartInstanceToBlueprints(partInstance)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}
