import { IEventContext } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { getCurrentTime } from '../../lib'
import { ProcessedStudioConfig, ProcessedShowStyleConfig } from '../config'
import { JobStudio, ProcessedShowStyleCompound } from '../../jobs'
import { RundownContext } from './RundownContext'

export class RundownEventContext extends RundownContext implements IEventContext {
	constructor(
		studio: ReadonlyDeep<JobStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		rundown: ReadonlyDeep<DBRundown>
	) {
		super(
			{
				name: rundown.name,
				identifier: `rundownId=${rundown._id},blueprintId=${showStyleCompound.blueprintId}`,
			},
			studio,
			studioBlueprintConfig,
			showStyleCompound,
			showStyleBlueprintConfig,
			rundown
		)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}
}
