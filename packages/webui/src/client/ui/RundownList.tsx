import Tooltip from 'rc-tooltip'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { GENESIS_SYSTEM_VERSION } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getHelpMode } from '../lib/localStorage'
import { literal, unprotectString } from '../lib/tempLib'
import { useSubscription, useTracker } from '../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../lib/Spinner'
import { GettingStarted } from './RundownList/GettingStarted'
import { RegisterHelp } from './RundownList/RegisterHelp'
import { RundownDropZone } from './RundownList/RundownDropZone'
import { RundownListFooter } from './RundownList/RundownListFooter'
import RundownPlaylistDragLayer from './RundownList/RundownPlaylistDragLayer'
import { RundownPlaylistUi } from './RundownList/RundownPlaylistUi'
import { RundownLayoutsAPI } from '../lib/rundownLayouts'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { getCoreSystem, RundownLayouts, RundownPlaylists, Rundowns } from '../collections'
import { RundownPlaylistCollectionUtil } from '../collections/rundownPlaylistUtil'
import { useEffect, useMemo, useState, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CreateAdlibTestingRundownPanel } from './RundownList/CreateAdlibTestingRundownPanel'
import { UserPermissionsContext } from './UserPermissions'

export enum ToolTipStep {
	TOOLTIP_START_HERE = 'TOOLTIP_START_HERE',
	TOOLTIP_RUN_MIGRATIONS = 'TOOLTIP_RUN_MIGRATIONS',
	TOOLTIP_EXTRAS = 'TOOLTIP_EXTRAS',
}

export function RundownList(): JSX.Element {
	const { t } = useTranslation()

	const userPermissions = useContext(UserPermissionsContext)

	const playlistIds = useTracker(
		() =>
			RundownPlaylists.find(undefined, {
				projection: {
					_id: 1,
				},
			}).map((doc) => doc._id),
		[],
		[]
	)

	const showStyleBaseIds = useTracker(
		() =>
			Rundowns.find({ playlistId: { $in: playlistIds } }, { projection: { _id: 1, showStyleBaseId: 1 } }).map(
				(doc) => doc.showStyleBaseId
			),
		[playlistIds],
		[]
	)

	const showStyleVariantIds = useTracker(
		() =>
			Rundowns.find({ playlistId: { $in: playlistIds } }, { projection: { _id: 1, showStyleVariantId: 1 } }).map(
				(doc) => doc.showStyleVariantId
			),
		[playlistIds],
		[]
	)

	const baseSubsReady = [
		useSubscription(CorelibPubSub.rundownPlaylists, null, null),
		useSubscription(MeteorPubSub.uiStudio, null),
		useSubscription(MeteorPubSub.rundownLayouts, null),

		useSubscription(CorelibPubSub.rundownsInPlaylists, playlistIds),

		useSubscription(CorelibPubSub.showStyleBases, showStyleBaseIds),
		useSubscription(CorelibPubSub.showStyleVariants, null, showStyleVariantIds),
	].reduce((prev, current) => prev && current, true)

	const [subsReady, setSubsReady] = useState(false)

	useEffect(() => {
		if (baseSubsReady) setSubsReady(true)
	}, [baseSubsReady])

	const coreSystem = useTracker(() => getCoreSystem(), [])
	const rundownLayouts = useTracker(
		() =>
			RundownLayouts.find({
				$or: [{ exposeAsSelectableLayout: true }, { exposeAsStandalone: true }],
			}).fetch(),
		[],
		[]
	)
	const rundownPlaylists = useTracker(
		() =>
			RundownPlaylists.find({}, { sort: { created: -1 } }).map((playlist: DBRundownPlaylist) => {
				const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)

				const unsyncedRundowns = rundowns.filter((rundown) => !!rundown.orphaned)

				return literal<RundownPlaylistUi>({
					...playlist,
					rundowns,
					unsyncedRundowns,
				})
			}),
		[],
		[]
	)

	const step = useMemo(() => {
		let gotPlaylists = false

		for (const playlist of rundownPlaylists) {
			if (playlist.unsyncedRundowns.length > -1) {
				gotPlaylists = true
				break
			}
		}

		if (coreSystem?.version === GENESIS_SYSTEM_VERSION && gotPlaylists === true) {
			return userPermissions.configure ? ToolTipStep.TOOLTIP_RUN_MIGRATIONS : ToolTipStep.TOOLTIP_START_HERE
		} else {
			return ToolTipStep.TOOLTIP_EXTRAS
		}
	}, [coreSystem, rundownPlaylists, userPermissions])

	const showGettingStarted = coreSystem?.version === GENESIS_SYSTEM_VERSION && rundownPlaylists.length === 0

	function renderRundownPlaylists() {
		if (rundownPlaylists.length < 1) {
			return <p>{t('There are no rundowns ingested into Sofie.')}</p>
		}

		return (
			<ul className="rundown-playlists">
				{rundownPlaylists.map((playlist) => (
					<RundownPlaylistUi key={unprotectString(playlist._id)} playlist={playlist} rundownLayouts={rundownLayouts} />
				))}
			</ul>
		)
	}

	return (
		<div className="container-fluid header-clear">
			{coreSystem ? <RegisterHelp step={step} /> : null}

			{showGettingStarted === true ? <GettingStarted step={step} /> : null}

			<section className="mtl gutter has-statusbar">
				<header className="mvs">
					<h1>{t('Rundowns')}</h1>
				</header>
				{subsReady ? (
					<section className="mod mvl rundown-list" role="treegrid">
						<header className="rundown-list__header">
							<span className="rundown-list-item__name" role="columnheader">
								<Tooltip
									overlay={t('Click on a rundown to control your studio')}
									visible={getHelpMode()}
									placement="top"
								>
									<span>{t('Rundown')}</span>
								</Tooltip>
							</span>
							{/* <span className="rundown-list-item__problems">{t('Problems')}</span> */}
							<span role="columnheader">{t('Show Style')}</span>
							<span role="columnheader">{t('On Air Start Time')}</span>
							<span role="columnheader">{t('Duration')}</span>
							{rundownPlaylists.some(
								(p) =>
									!!PlaylistTiming.getExpectedEnd(p.timing) ||
									p.rundowns.some((r) => PlaylistTiming.getExpectedEnd(r.timing))
							) && <span role="columnheader">{t('Expected End Time')}</span>}
							<span role="columnheader">{t('Last updated')}</span>
							{rundownLayouts.some(
								(l) =>
									(RundownLayoutsAPI.isLayoutForShelf(l) && l.exposeAsStandalone) ||
									(RundownLayoutsAPI.isLayoutForRundownView(l) && l.exposeAsSelectableLayout)
							) && <span role="columnheader">{t('View Layout')}</span>}
							<span>&nbsp;</span>
						</header>
						{renderRundownPlaylists()}
						<footer>
							<RundownDropZone />
						</footer>
						<RundownPlaylistDragLayer />
					</section>
				) : (
					<Spinner />
				)}
			</section>

			{userPermissions.studio && <CreateAdlibTestingRundownPanel />}

			<RundownListFooter />
		</div>
	)
}
