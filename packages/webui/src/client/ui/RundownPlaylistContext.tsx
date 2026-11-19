import React, { useContext } from 'react'
import type { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

/**
 * The id of the RundownPlaylist that the surrounding view is displaying.
 *
 * Mounted by every view that shows a playlist - the rundown view, the prompter, and each of the
 * clock views - so it deliberately belongs to none of them. Components that read it (part timers,
 * countdowns) render in several of those views already, which is why they cannot take this from a
 * view-scoped context.
 *
 * It carries only the id, and should keep carrying only the id. A RundownPlaylist changes on every
 * take and more often besides, and a context re-renders *every* consumer whenever its value changes
 * - so putting the playlist in here would re-render all of these on every take to deliver a value
 * that has not moved. Components needing more than the id should read the fields they actually use:
 *
 *     useTracker(() => RundownPlaylists.findOne(playlistId, { fields: { activationId: 1 } }), [playlistId])
 *
 * which is both the existing convention and finer-grained than a context can be.
 */
const RundownPlaylistIdContext = React.createContext<RundownPlaylistId | undefined>(undefined)

export function RundownPlaylistProvider({
	playlistId,
	children,
}: React.PropsWithChildren<{ playlistId: RundownPlaylistId | undefined }>): React.JSX.Element {
	return <RundownPlaylistIdContext.Provider value={playlistId}>{children}</RundownPlaylistIdContext.Provider>
}

/** The id of the RundownPlaylist the surrounding view is displaying, if it is showing one */
export function useRundownPlaylistId(): RundownPlaylistId | undefined {
	return useContext(RundownPlaylistIdContext)
}
