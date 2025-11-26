import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { useContext } from 'react'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { PreviewPopUpContextProvider } from '../PreviewPopUp/PreviewPopUpContext'
import { Shelf } from '../Shelf/Shelf'
import { UserPermissionsContext } from '../UserPermissions'
import { RundownSorensenContext } from './RundownSorensenContext'
import { RundownTimingProvider } from './RundownTiming/RundownTimingProvider'
import { Settings } from '../../lib/Settings'
import { RundownLayoutShelfBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'

interface RundownDetachedShelfProps {
	playlist: DBRundownPlaylist
	currentRundown: Rundown | undefined
	studio: UIStudio
	showStyleBase: UIShowStyleBase
	showStyleVariant: DBShowStyleVariant
	shelfLayout: RundownLayoutShelfBase | undefined
}

export function RundownDetachedShelf({
	playlist,
	currentRundown,
	studio,
	showStyleBase,
	showStyleVariant,
	shelfLayout,
}: RundownDetachedShelfProps): JSX.Element {
	const userPermissions = useContext(UserPermissionsContext)

	return (
		<RundownTimingProvider playlist={playlist} defaultDuration={Settings.defaultDisplayDuration}>
			<PreviewPopUpContextProvider>
				<ErrorBoundary>
					<Shelf
						isExpanded={true}
						playlist={playlist}
						showStyleBase={showStyleBase}
						showStyleVariant={showStyleVariant}
						rundownLayout={shelfLayout}
						studio={studio}
						fullViewport={true}
					/>
				</ErrorBoundary>
			</PreviewPopUpContextProvider>
			<ErrorBoundary>
				{userPermissions.studio && currentRundown && (
					<RundownSorensenContext
						studio={studio}
						playlist={playlist}
						currentRundown={currentRundown}
						showStyleBase={showStyleBase}
					/>
				)}
			</ErrorBoundary>
		</RundownTimingProvider>
	)
}
