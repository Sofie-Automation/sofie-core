import { RundownTimingProvider } from './RundownTiming/RundownTimingProvider'
import { RundownPlaylistProvider } from '../RundownPlaylistContext'
import StudioContext from './StudioContext'
import { RundownPlaylistOperationsContextProvider } from './RundownHeader/useRundownPlaylistOperations.js'
import { PreviewPopUpContextProvider } from '../PreviewPopUp/PreviewPopUpContext'
import { SelectedElementProvider } from './SelectedElementsContext'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import type { UIStudio } from '@sofie-automation/corelib/src/dataModel/Studio'

export function RundownViewContextProviders({
	playlist,
	studio,
	currentRundown,
	onActivate,
	children,
}: React.PropsWithChildren<{
	playlist: DBRundownPlaylist
	studio: UIStudio
	currentRundown: Rundown
	onActivate: () => void
}>): React.JSX.Element {
	return (
		<RundownPlaylistProvider playlistId={playlist?._id}>
			<RundownTimingProvider playlist={playlist}>
				<StudioContext.Provider value={studio}>
					<RundownPlaylistOperationsContextProvider
						studio={studio}
						playlist={playlist}
						currentRundown={currentRundown}
						onActivate={onActivate}
					>
						<PreviewPopUpContextProvider>
							<SelectedElementProvider>{children}</SelectedElementProvider>
						</PreviewPopUpContextProvider>
					</RundownPlaylistOperationsContextProvider>
				</StudioContext.Provider>
			</RundownTimingProvider>
		</RundownPlaylistProvider>
	)
}
