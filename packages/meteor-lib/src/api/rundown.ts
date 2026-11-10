import type { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids.js'

export interface NewRundownAPI {
	rundownPlaylistNeedsResync(playlistId: RundownPlaylistId): Promise<string[]>
}

export enum RundownAPIMethods {
	'rundownPlaylistNeedsResync' = 'rundown.rundownPlaylistNeedsResync',
}
