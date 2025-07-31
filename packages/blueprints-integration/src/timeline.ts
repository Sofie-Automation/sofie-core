import { TimelineObjectCoreExt } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import { TSR } from '@sofie-automation/shared-lib/dist/tsr'

export { TSR }

export {
	TimelineObjHoldMode,
	TimelineObjectCoreExt,
	TimelineKeyframeCoreExt,
} from '@sofie-automation/shared-lib/dist/core/model/Timeline'

export enum TimelineObjClassesCore {
	RundownRehearsal = 'rundown_rehersal',
	RundownActive = 'rundown_active',
	BeforeFirstPart = 'before_first_part',
	NoNextPart = 'last_part',
}

/** TimelineObject extension for additional fields needed by onTimelineGenerate */
export interface OnGenerateTimelineObj<
	TContent extends { deviceType: TSR.DeviceType },
	TMetadata = unknown,
	TKeyframeMetadata = unknown,
> extends TimelineObjectCoreExt<TContent, TMetadata, TKeyframeMetadata> {
	pieceInstanceId?: string
}
