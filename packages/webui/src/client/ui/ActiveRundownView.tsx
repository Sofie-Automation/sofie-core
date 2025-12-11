import { NavLink, Route, Switch, useRouteMatch } from 'react-router-dom'
import { useSubscription, useTracker } from '../lib/ReactMeteorData/ReactMeteorData.js'

import { Spinner } from '../lib/Spinner.js'
import { RundownView } from './RundownView.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { UIStudios } from './Collections.js'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylists } from '../collections/index.js'
import { useTranslation } from 'react-i18next'
import { useSetDocumentClass, useSetDocumentDarkTheme } from './util/useSetDocumentClass.js'

export function ActiveRundownView({ studioId }: Readonly<{ studioId: StudioId }>): JSX.Element | null {
	const { t } = useTranslation()

	const { path } = useRouteMatch()

	const studioReady = useSubscription(MeteorPubSub.uiStudio, studioId)
	const playlistReady = useSubscription(MeteorPubSub.rundownPlaylistForStudio, studioId, true)

	const subsReady = studioReady && playlistReady

	const studio = useTracker(() => UIStudios.findOne(studioId), [studioId])
	const playlist = useTracker(
		() =>
			RundownPlaylists.findOne({
				activationId: { $exists: true },
				studioId,
			}),
		[studioId]
	)

	if (!subsReady) {
		return (
			<div className="rundown-view rundown-view--loading">
				<Spinner />
			</div>
		)
	} else if (playlist) {
		return (
			<Switch>
				<Route path={`${path}`} exact>
					<RundownView playlistId={playlist._id} inActiveRundownView={true} />
				</Route>
				<Route path={`${path}/shelf`} exact>
					<RundownView playlistId={playlist._id} inActiveRundownView={true} onlyShelf={true} />
				</Route>
			</Switch>
		)
	} else if (studio) {
		return <NotFoundMessage message={t('There is no rundown active in this studio.')} />
	} else if (studioId) {
		return <NotFoundMessage message={t("This studio doesn't exist.")} />
	} else {
		return <NotFoundMessage message={t('There are no active rundowns.')} />
	}
}

function NotFoundMessage({ message }: Readonly<{ message: string }>) {
	const { t } = useTranslation()

	useSetDocumentClass('dark', 'vertical-overflow-only')
	useSetDocumentDarkTheme()

	return (
		<div className="rundown-view rundown-view--unpublished">
			<div className="rundown-view__label">
				<p className="summary">{message}</p>
				<p>
					<NavLink to="/rundowns" className="btn btn-primary">
						{t('Return to list')}
					</NavLink>
				</p>
			</div>
		</div>
	)
}
