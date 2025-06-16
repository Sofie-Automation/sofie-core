import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface NewRundownAPI {
	rundownPlaylistNeedsResync(playlistId: RundownPlaylistId): Promise<string[]>
}

export enum RundownAPIMethods {
	'rundownPlaylistNeedsResync' = 'rundown.rundownPlaylistNeedsResync',
}
