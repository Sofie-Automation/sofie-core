import { IRundownContext, IBlueprintSegmentRundown } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ProcessedStudioConfig, ProcessedShowStyleConfig } from '../config.js'
import { JobStudio, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { convertRundownToBlueprintSegmentRundown } from './lib.js'
import { ContextInfo } from './CommonContext.js'
import { ShowStyleContext } from './ShowStyleContext.js'

/** Rundown */

export class RundownContext extends ShowStyleContext implements IRundownContext {
	readonly rundownId: string
	readonly rundown: Readonly<IBlueprintSegmentRundown>
	readonly _rundown: ReadonlyDeep<DBRundown>
	readonly playlistId: string

	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<JobStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		rundown: ReadonlyDeep<DBRundown>
	) {
		super(contextInfo, studio, studioBlueprintConfig, showStyleCompound, showStyleBlueprintConfig)

		this.rundownId = unprotectString(rundown._id)
		this.rundown = convertRundownToBlueprintSegmentRundown(rundown)
		this._rundown = rundown
		this.playlistId = unprotectString(rundown.playlistId)
	}
}
