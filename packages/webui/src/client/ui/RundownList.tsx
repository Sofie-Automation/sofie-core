import Tooltip from 'rc-tooltip'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { GENESIS_SYSTEM_VERSION } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { getHelpMode } from '../lib/localStorage.js'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { useSubscription, useTracker } from '../lib/ReactMeteorData/react-meteor-data.js'
import { Spinner } from '../lib/Spinner.js'
import { GettingStarted } from './RundownList/GettingStarted.js'
import { RegisterHelp } from './RundownList/RegisterHelp.js'
import { RundownDropZone } from './RundownList/RundownDropZone.js'
import { RundownListFooter } from './RundownList/RundownListFooter.js'
import RundownPlaylistDragLayer from './RundownList/RundownPlaylistDragLayer.js'
import { RundownPlaylistUi } from './RundownList/RundownPlaylistUi.js'
import { RundownLayoutsAPI } from '../lib/rundownLayouts.js'
import { getCoreSystem, RundownLayouts, RundownPlaylists, Rundowns } from '../collections/index.js'
import { RundownPlaylistCollectionUtil } from '../collections/rundownPlaylistUtil.js'
import { useEffect, useMemo, useState, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CreateAdlibTestingRundownPanel } from './RundownList/CreateAdlibTestingRundownPanel.js'
import { UserPermissionsContext } from './UserPermissions.js'
import Container from 'react-bootstrap/esm/Container'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import type { RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'

export enum ToolTipStep {
	TOOLTIP_START_HERE = 'TOOLTIP_START_HERE',
	TOOLTIP_RUN_MIGRATIONS = 'TOOLTIP_RUN_MIGRATIONS',
	TOOLTIP_EXTRAS = 'TOOLTIP_EXTRAS',
}

/**
 * Get the time to use when sorting a Playlist by its editorial timing.
 * Returns undefined if the Playlist has no usable timing information.
 */
function getSortableStartTime(timing: RundownPlaylistTiming): number | undefined {
	// This already derives the start from the end and duration, when only those are known
	const expectedStart = PlaylistTiming.getExpectedStart(timing)
	if (expectedStart !== undefined) return expectedStart

	// If only an end time is known, treat that as the start time, as it is better than nothing
	return PlaylistTiming.getExpectedEnd(timing)
}

/**
 * Sort Playlists by their editorial start time, with any Playlists without timing information last.
 * Playlists which cannot be distinguished by their timing are ordered by creation time (newest first) and then name,
 * to give a stable ordering.
 */
function comparePlaylistsForDisplay(a: RundownPlaylistUi, b: RundownPlaylistUi): number {
	const aStart = getSortableStartTime(a.timing)
	const bStart = getSortableStartTime(b.timing)

	if (aStart !== undefined && bStart !== undefined) {
		if (aStart !== bStart) return aStart - bStart
	} else if (aStart !== undefined) {
		return -1
	} else if (bStart !== undefined) {
		return 1
	}

	// When no usable timing, fallback to something stable
	return (
		b.created - a.created ||
		a.name.localeCompare(b.name) ||
		unprotectString(a._id).localeCompare(unprotectString(b._id))
	)
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
			return <p className="px-2 py-2">{t('There are no rundowns ingested into Sofie.')}</p>
		}

		const sortedPlaylists = [...rundownPlaylists].sort(comparePlaylistsForDisplay)

		return (
			<ul className="rundown-playlists">
				{sortedPlaylists.map((playlist) => (
					<RundownPlaylistUi key={unprotectString(playlist._id)} playlist={playlist} rundownLayouts={rundownLayouts} />
				))}
			</ul>
		)
	}

	return (
		<Container fluid className="header-clear">
			{coreSystem ? <RegisterHelp step={step} /> : null}

			{showGettingStarted === true ? <GettingStarted step={step} /> : null}

			<section className="mt-5 mx-5 has-statusbar">
				<header className="my-2">
					<h1>{t('Rundowns')}</h1>
				</header>
				{subsReady ? (
					<section className="my-5 rundown-list" role="treegrid">
						<header className="rundown-list__header">
							<span>{/* Spacer */}</span>
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
							<span role="columnheader">{t('Expected End Time')}</span>
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
		</Container>
	)
}
