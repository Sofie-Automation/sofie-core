import { useCallback, useContext, useEffect, useState } from 'react'
import Tooltip from 'rc-tooltip'
import ClassNames from 'classnames'
import { useTranslation } from 'react-i18next'
import { RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { unprotectString } from '../../lib/tempLib.js'
import { ActiveProgressBar } from './ActiveProgressBar.js'
import { RundownListItem } from './RundownListItem.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown, getRundownNrcsName } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons'
import { LoopingIcon } from '../../lib/ui/icons/looping.js'
import { getRundownPlaylistLink } from './util.js'
import { useDrop } from 'react-dnd'
import { IRundownDragObject, RundownListDragDropTypes } from './DragAndDropTypes.js'
import { MeteorCall } from '../../lib/meteorApi.js'
import { RundownUtils } from '../../lib/rundown.js'
import PlaylistRankResetButton from './PlaylistRankResetButton.js'
import { DisplayFormattedTime } from './DisplayFormattedTime.js'
import { doUserAction, UserAction } from '../../lib/clientUserAction.js'
import { RundownViewLayoutSelection } from './RundownViewLayoutSelection.js'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib.js'
import { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { isLoopDefined } from '../../lib/RundownResolver.js'
import { UserPermissionsContext } from '../UserPermissions.js'

export interface RundownPlaylistUi extends DBRundownPlaylist {
	rundowns: Rundown[]
	unsyncedRundowns: Rundown[]
}

export function RundownPlaylistUi({
	playlist,
	rundownLayouts,
}: Readonly<{
	playlist: RundownPlaylistUi
	rundownLayouts: RundownLayoutBase[]
}>): JSX.Element | null {
	const { t } = useTranslation()
	const [rundownOrder, setRundownOrder] = useState(playlist.rundowns.map((rundown) => rundown._id))

	const userPermissions = useContext(UserPermissionsContext)

	useEffect(() => {
		setRundownOrder(playlist.rundowns.map((rundown) => rundown._id))
	}, [playlist.rundowns.map((rundown) => rundown._id).join(',')])

	const [dropState, connectDropTarget] = useDrop<
		IRundownDragObject,
		void,
		{
			isOver: boolean
			isActiveDropZone: boolean
		}
	>(
		{
			accept: RundownListDragDropTypes.RUNDOWN,
			collect: (monitor) => {
				const dragObject = monitor.getItem<IRundownDragObject | null>()
				const draggingId = dragObject?.id
				const outsideRundownIsDragging =
					draggingId !== undefined && !playlist.rundowns.some(({ _id }) => draggingId === _id)

				return {
					isOver: monitor.isOver(),
					isActiveDropZone: outsideRundownIsDragging,
				}
			},
			drop: (item) => {
				const playlistId = playlist._id
				const newRundownOrder = rundownOrder.slice()

				const rundownId = item.id

				console.log('handleRundownDrop')

				if (playlist.rundowns.findIndex((rundown) => rundownId === rundown._id) > -1) {
					// finalize order from component state
					doUserAction(t, 'Drag and drop rundown playlist reorder', UserAction.RUNDOWN_ORDER_MOVE, (e, ts) =>
						MeteorCall.userAction.moveRundown(e, ts, rundownId, playlistId, newRundownOrder)
					)
				} else {
					// add rundown to playlist
					newRundownOrder.push(rundownId)

					doUserAction(t, 'Drag and drop add rundown to playlist', UserAction.RUNDOWN_ORDER_MOVE, (e, ts) =>
						MeteorCall.userAction.moveRundown(e, ts, rundownId, playlistId, newRundownOrder)
					)
				}
			},
		},
		[t, playlist, rundownOrder]
	)

	function handleResetRundownOrderClick() {
		doUserAction(
			t,
			'User clicked the playlist rundown order toggle to reset',
			UserAction.RUNDOWN_ORDER_RESET,
			(e, ts) => MeteorCall.userAction.restoreRundownOrder(e, ts, playlist._id)
		)
	}

	const playlistViewURL = getRundownPlaylistLink(playlist._id)
	const handleRundownSwap = useCallback((a: RundownId, b: RundownId) => {
		setRundownOrder((order) => {
			const aPos = order.indexOf(a)
			const bPos = order.indexOf(b)

			if (aPos > -1 && bPos > -1) {
				const newOrder = order.slice()
				newOrder[aPos] = b
				newOrder[bPos] = a
				return newOrder
			}
			return order
		})
	}, [])

	if (playlist.rundowns.length === 0) {
		// Playlist has no rundowns, aborting render
		return null
	}

	if (playlist.rundowns.length === 1 && playlist.name === playlist.rundowns[0].name) {
		// For the time being, playlists with only one rundown aren't considered
		// playlists. Therefore they are rendered without playlist markup/styling
		// and also won't be connected as drop targets (preventing other rundowns
		// from being dropped onto them and being added to them)
		// An exception is made for named playlists (which come from ENPS/blueprints,
		// and therefore should be preserved)
		return (
			<>
				<RundownListItem
					isActive={!!playlist.activationId}
					key={unprotectString(playlist.rundowns[0]._id)}
					rundown={playlist.rundowns[0]}
					rundownViewUrl={playlistViewURL}
					rundownLayouts={rundownLayouts}
					swapRundownOrder={handleRundownSwap}
					playlistId={playlist._id}
					isOnlyRundownInPlaylist={true}
				/>
				<RundownPlaylistProgressBar playlist={playlist} />
			</>
		)
	}

	const rundownListComponents = rundownOrder.map((rundownId) => {
		const rundown = playlist.rundowns.find((r) => r._id === rundownId)

		return rundown ? (
			<RundownListItem
				isActive={!!playlist.activationId}
				key={unprotectString(rundown._id)}
				rundown={rundown}
				rundownLayouts={rundownLayouts}
				swapRundownOrder={handleRundownSwap}
				playlistId={playlist._id}
				isOnlyRundownInPlaylist={false}
			/>
		) : null
	})

	const playlistExpectedDuration = PlaylistTiming.getExpectedDuration(playlist.timing)
	const playlistExpectedStart = PlaylistTiming.getExpectedStart(playlist.timing)
	const playlistExpectedEnd = PlaylistTiming.getExpectedEnd(playlist.timing)
	const isPlaylistLooping = isLoopDefined(playlist)

	const expectedDuration =
		playlistExpectedDuration !== undefined &&
		(isPlaylistLooping ? (
			<Tooltip
				overlay={t('This rundown will loop indefinitely')}
				mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
				placement="top"
			>
				<span>
					{t('({{timecode}})', {
						timecode: RundownUtils.formatDiffToTimecode(playlistExpectedDuration, false, true, true, false, true),
					})}
					&nbsp;
					<LoopingIcon />
				</span>
			</Tooltip>
		) : (
			RundownUtils.formatDiffToTimecode(playlistExpectedDuration, false, true, true, false, true)
		))

	return (
		<li
			className={ClassNames('rundown-playlist', { droptarget: dropState.isActiveDropZone })}
			ref={connectDropTarget}
			role="rowgroup"
		>
			{/* Drop target { droptarget: isActiveDropZone } */}
			<header className="rundown-playlist__header">
				<span>{/* Spacer */}</span>
				<span>
					<h2 className="rundown-playlist__heading" role="rowheader">
						<FontAwesomeIcon icon={faFolderOpen} />
						<span className="rundown-playlist__heading-text">
							<Link to={playlistViewURL}>
								{isPlaylistLooping && <LoopingIcon />}
								{playlist.name}
							</Link>
						</span>
					</h2>
					{userPermissions.studio ? (
						<PlaylistRankResetButton
							manualSortingActive={playlist.rundownRanksAreSetInSofie === true}
							nrcsName={getRundownNrcsName(playlist.rundowns[0])}
							toggleCallbackHandler={handleResetRundownOrderClick}
						/>
					) : null}
				</span>
				<span className="rundown-list-item__text" role="gridcell">
					{playlistExpectedStart ? (
						<DisplayFormattedTime displayTimestamp={playlistExpectedStart} t={t} />
					) : playlistExpectedEnd && playlistExpectedDuration ? (
						<DisplayFormattedTime displayTimestamp={playlistExpectedEnd - playlistExpectedDuration} t={t} />
					) : (
						<span className="dimmed">{t('Not set')}</span>
					)}
				</span>
				<span className="rundown-list-item__text" role="gridcell">
					{expectedDuration ? (
						expectedDuration
					) : isPlaylistLooping ? (
						<Tooltip
							mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
							overlay={t('This rundown will loop indefinitely')}
							placement="top"
						>
							<LoopingIcon />
						</Tooltip>
					) : (
						<span className="dimmed">{t('Not set')}</span>
					)}
				</span>
				<span className="rundown-list-item__text" role="gridcell">
					{playlistExpectedEnd ? (
						<DisplayFormattedTime displayTimestamp={playlistExpectedEnd} t={t} />
					) : playlistExpectedStart && playlistExpectedDuration ? (
						<DisplayFormattedTime displayTimestamp={playlistExpectedStart + playlistExpectedDuration} t={t} />
					) : (
						<span className="dimmed">{t('Not set')}</span>
					)}
				</span>
				<span className="rundown-list-item__text" role="gridcell">
					<DisplayFormattedTime displayTimestamp={playlist.modified} t={t} />
				</span>
				<span className="rundown-list-item__text" role="gridcell">
					{rundownLayouts.some(
						(l) =>
							(RundownLayoutsAPI.isLayoutForShelf(l) && l.exposeAsStandalone) ||
							(RundownLayoutsAPI.isLayoutForRundownView(l) && l.exposeAsSelectableLayout)
					) && (
						<RundownViewLayoutSelection
							rundowns={playlist.rundowns}
							rundownLayouts={rundownLayouts}
							playlistId={playlist._id}
						/>
					)}
				</span>
				<span className="rundown-list-item__actions" role="gridcell"></span>
			</header>
			<ol className="rundown-playlist__rundowns">{rundownListComponents}</ol>
			<footer>
				<RundownPlaylistProgressBar playlist={playlist} />
			</footer>
		</li>
	)
}

function RundownPlaylistProgressBar({ playlist }: Readonly<{ playlist: RundownPlaylistUi }>) {
	if (
		!playlist.activationId ||
		PlaylistTiming.getExpectedDuration(playlist.timing) === undefined ||
		!playlist.startedPlayback
	) {
		return null
	}

	return <ActiveProgressBar rundownPlaylist={playlist} />
}
