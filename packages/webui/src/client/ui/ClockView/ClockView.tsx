import { Switch, Route, Redirect } from 'react-router-dom'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'

import { RundownTimingProvider } from '../RundownView/RundownTiming/RundownTimingProvider'

import { StudioScreenSaver } from '../StudioScreenSaver/StudioScreenSaver'
import { PresenterScreen } from './PresenterScreen'
import { OverlayScreen } from './OverlayScreen'
import { OverlayScreenSaver } from './OverlayScreenSaver'
import { RundownPlaylists } from '../../collections'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CameraScreen } from './CameraScreen'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'

export function ClockView({ studioId }: Readonly<{ studioId: StudioId }>): JSX.Element {
	useSubscription(MeteorPubSub.rundownPlaylistForStudio, studioId, true)

	const playlist = useTracker(
		() =>
			RundownPlaylists.findOne({
				activationId: { $exists: true },
				studioId,
			}),
		[studioId]
	)

	return (
		<Switch>
			<Route path="/countdowns/:studioId/presenter">
				{playlist ? (
					<RundownTimingProvider playlist={playlist}>
						<PresenterScreen playlistId={playlist._id} studioId={studioId} />
					</RundownTimingProvider>
				) : (
					<StudioScreenSaver studioId={studioId} ownBackground={true} />
				)}
			</Route>
			<Route path="/countdowns/:studioId/overlay">
				{playlist ? (
					<RundownTimingProvider playlist={playlist}>
						<OverlayScreen playlistId={playlist._id} studioId={studioId} />
					</RundownTimingProvider>
				) : (
					<OverlayScreenSaver studioId={studioId} />
				)}
			</Route>
			<Route path="/countdowns/:studioId/camera">
				<RundownTimingProvider playlist={playlist}>
					<CameraScreen playlist={playlist} studioId={studioId} />
				</RundownTimingProvider>
			</Route>
			<Route>
				<Redirect to="/" />
			</Route>
		</Switch>
	)
}
