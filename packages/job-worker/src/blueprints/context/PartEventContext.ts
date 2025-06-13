import { IBlueprintPartInstance, IPartEventContext } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { getCurrentTime } from '../../lib'
import { ProcessedStudioConfig, ProcessedShowStyleConfig } from '../config'
import { JobStudio, ProcessedShowStyleCompound } from '../../jobs'
import { convertPartInstanceToBlueprints } from './lib'
import { RundownContext } from './RundownContext'

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
