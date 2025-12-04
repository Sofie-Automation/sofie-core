import { Switch, Route } from 'react-router-dom'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'

import { RundownTimingProvider } from '../RundownView/RundownTiming/RundownTimingProvider.js'

import { StudioScreenSaver } from '../StudioScreenSaver/StudioScreenSaver.js'
import { PresenterScreen } from './PresenterScreen.js'
import { DirectorScreen } from './DirectorScreen.js'
import { OverlayScreen } from './OverlayScreen.js'
import { OverlayScreenSaver } from './OverlayScreenSaver.js'
import { RundownPlaylists } from '../../collections/index.js'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CameraScreen } from './CameraScreen/index.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { useTranslation } from 'react-i18next'
import { ClockViewIndex } from './ClockViewIndex.js'
import { MultiviewScreen } from './MultiviewScreen.js'

export function ClockView({ studioId }: Readonly<{ studioId: StudioId }>): JSX.Element {
	useSubscription(MeteorPubSub.rundownPlaylistForStudio, studioId, true)
	const { t } = useTranslation()

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
					<StudioScreenSaver studioId={studioId} ownBackground={true} screenName={t('Presenter Screen')} />
				)}
			</Route>
			<Route path="/countdowns/:studioId/director">
				{playlist ? (
					<RundownTimingProvider playlist={playlist}>
						<DirectorScreen playlistId={playlist._id} studioId={studioId} />
					</RundownTimingProvider>
				) : (
					<StudioScreenSaver studioId={studioId} ownBackground={true} screenName={t("Director's Screen")} />
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
			<Route path="/countdowns/:studioId/multiview">
				<MultiviewScreen studioId={studioId} />
			</Route>
			<Route path="/countdowns/:studioId">
				<ClockViewIndex studioId={studioId} />
			</Route>
		</Switch>
	)
}
