import React from 'react'
import { RundownTimingProvider } from './RundownTiming/RundownTimingProvider'
import StudioContext from './StudioContext'
import { RundownPlaylistOperationsContextProvider } from './RundownHeader/useRundownPlaylistOperations'
import { PreviewPopUpContextProvider } from '../PreviewPopUp/PreviewPopUpContext'
import { SelectedElementProvider } from './SelectedElementsContext'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Settings } from '../../lib/Settings'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'

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
		<RundownTimingProvider playlist={playlist} defaultDuration={Settings.defaultDisplayDuration}>
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
	)
}
