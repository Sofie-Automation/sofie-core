import type { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids.js'

export interface NewPlayoutAPI {
	updateStudioBaseline(studioId: StudioId): Promise<string | false>
	shouldUpdateStudioBaseline(studioId: StudioId): Promise<string | false>
}

export enum PlayoutAPIMethods {
	'updateStudioBaseline' = 'playout.updateStudioBaseline',
	'shouldUpdateStudioBaseline' = 'playout.shouldUpdateStudioBaseline',
}
