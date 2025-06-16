import { DBStudio } from '../dataModel/Studio.js'
import { TimelineComplete } from '../dataModel/Timeline.js'
import { ReadonlyDeep } from 'type-fest'
import { unprotectString } from '../protectedString.js'
import { Blueprint } from '../dataModel/Blueprint.js'

export function shouldUpdateStudioBaselineInner(
	coreVersion: string,
	studio: Pick<DBStudio, 'blueprintId' | '_rundownVersionHash'>,
	studioTimeline: ReadonlyDeep<TimelineComplete> | null,
	studioBlueprint: Pick<Blueprint, 'blueprintVersion'> | null
): string | false {
	if (!studioTimeline) return 'noBaseline'

	const versionsContent = studioTimeline.generationVersions
	if (!versionsContent) return 'noVersion'

	if (versionsContent.core !== coreVersion) return 'coreVersion'

	if (versionsContent.studio !== (studio._rundownVersionHash || 0)) return 'studio'

	if (versionsContent.blueprintId !== unprotectString(studio.blueprintId)) return 'blueprintId'
	if (studio.blueprintId) {
		if (!studioBlueprint) return 'blueprintUnknown'
		if (versionsContent.blueprintVersion !== (studioBlueprint.blueprintVersion || 0)) return 'blueprintVersion'
	}

	return false
}
