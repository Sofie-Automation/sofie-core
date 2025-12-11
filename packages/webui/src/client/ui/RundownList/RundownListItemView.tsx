import Tooltip from 'rc-tooltip'
import React, { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Rundown, getRundownNrcsName } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownUtils } from '../../lib/rundown.js'
import { iconDragHandle, iconRemove, iconResync } from './icons.js'
import { DisplayFormattedTime } from './DisplayFormattedTime.js'
import { PathIcon } from '../../lib/ui/icons/rundownList.js'
import { LoopingIcon } from '../../lib/ui/icons/looping.js'
import { RundownViewLayoutSelection } from './RundownViewLayoutSelection.js'
import { RundownLayoutBase } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib.js'
import { Meteor } from 'meteor/meteor'
import { RundownPlaylists } from '../../collections/index.js'
import { isLoopDefined } from '../../lib/RundownResolver.js'
import { UserPermissionsContext } from '../UserPermissions.js'

interface IRundownListItemViewProps {
	isActive: boolean
	className: string
	htmlElementId: string
	connectDragSource: (content: HTMLElement | null) => void
	connectDropTarget: (content: HTMLElement | null) => void
	rundownViewUrl?: string
	rundown: Rundown
	rundownLayouts: Array<RundownLayoutBase>
	showStyleBaseURL?: string
	showStyleName: string | undefined
	confirmReSyncRundownHandler?: () => void
	confirmDeleteRundownHandler?: () => void
	isDragLayer: boolean
	renderTooltips: boolean
	isOnlyRundownInPlaylist?: boolean
}

export default React.memo(function RundownListItemView({
	isActive,
	className,
	connectDragSource,
	connectDropTarget,
	htmlElementId,
	rundownViewUrl,
	showStyleBaseURL,
	showStyleName,
	rundown,
	rundownLayouts,
	confirmReSyncRundownHandler,
	confirmDeleteRundownHandler,
	isOnlyRundownInPlaylist,
	isDragLayer,
	renderTooltips,
}: IRundownListItemViewProps): JSX.Element | null {
	const { t } = useTranslation()

	const userPermissions = useContext(UserPermissionsContext)

	if (!rundown.playlistId) throw new Meteor.Error(500, 'Rundown is not a part of a rundown playlist!')
	const playlist = RundownPlaylists.findOne(rundown.playlistId)
	if (!playlist) throw new Meteor.Error(404, `Rundown Playlist "${rundown.playlistId}" not found!`)

	const rundownNameContent = rundownViewUrl ? (
		<Link to={rundownViewUrl}>
			{isOnlyRundownInPlaylist && isLoopDefined(playlist) && <LoopingIcon />}
			{rundown.name}
		</Link>
	) : (
		rundown.name
	)

	const expectedStart = PlaylistTiming.getExpectedStart(rundown.timing)
	const expectedDuration = PlaylistTiming.getExpectedDuration(rundown.timing)
	const expectedEnd = PlaylistTiming.getExpectedEnd(rundown.timing)

	return (
		<li
			id={htmlElementId}
			className={`${className} rundown-list-item ${isDragLayer ? 'dragging' : ''}`}
			ref={connectDropTarget}
			role="row"
		>
			{userPermissions.studio ? (
				<span className="rundown-list-item__draghandle" ref={connectDragSource}>
					<Tooltip
						overlay={t('Drag to reorder or move out of playlist')}
						placement="top"
						mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
						overlayStyle={{ display: renderTooltips ? undefined : 'none' }}
					>
						<button className="rundown-list-item__action" aria-label="Drag handle">
							{iconDragHandle()}
						</button>
					</Tooltip>
				</span>
			) : (
				<span></span>
			)}
			<span className="rundown-list-item__name" role="rowheader">
				<span className="rundown-name">{rundownNameContent}</span>
				{rundown.description ? (
					<Tooltip overlay={rundown.description} trigger={['hover']} placement="right">
						<span className="rundown-list-description__icon">
							<PathIcon />
						</span>
					</Tooltip>
				) : null}

				<span className="rundown-list-item__indicator">
					{isActive === true ? (
						<Tooltip
							overlay={t('This rundown is currently active')}
							mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
							placement="bottom"
						>
							<div className="origo-pulse small me-2">
								<div className="pulse-marker">
									<div className="pulse-rays"></div>
									<div className="pulse-rays delay"></div>
								</div>
							</div>
						</Tooltip>
					) : null}
				</span>
			</span>
			{/* <RundownListItemProblems warnings={warnings} errors={errors} /> */}
			<span className="rundown-list-item__text" role="gridcell">
				{showStyleBaseURL ? <Link to={showStyleBaseURL}>{showStyleName}</Link> : showStyleName || ''}
			</span>
			<span className="rundown-list-item__text" role="gridcell">
				{expectedStart ? (
					<DisplayFormattedTime displayTimestamp={expectedStart} t={t} />
				) : expectedEnd && expectedDuration ? (
					<DisplayFormattedTime displayTimestamp={expectedEnd - expectedDuration} t={t} />
				) : (
					<span className="dimmed">{t('Not set')}</span>
				)}
			</span>
			<span className="rundown-list-item__text" role="gridcell">
				{expectedDuration ? (
					isOnlyRundownInPlaylist && isLoopDefined(playlist) ? (
						<Tooltip
							overlay={t('This rundown will loop indefinitely')}
							mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
							placement="top"
						>
							<span>
								{t('({{timecode}})', {
									timecode: RundownUtils.formatDiffToTimecode(expectedDuration, false, true, true, false, true),
								})}
								&nbsp;
								<LoopingIcon />
							</span>
						</Tooltip>
					) : (
						RundownUtils.formatDiffToTimecode(expectedDuration, false, true, true, false, true)
					)
				) : isOnlyRundownInPlaylist && isLoopDefined(playlist) ? (
					<Tooltip
						overlay={t('This rundown will loop indefinitely')}
						mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
						placement="top"
					>
						<span>
							<LoopingIcon />
						</span>
					</Tooltip>
				) : (
					<span className="dimmed">{t('Not set')}</span>
				)}
			</span>
			<span className="rundown-list-item__text" role="gridcell">
				{expectedEnd ? (
					<DisplayFormattedTime displayTimestamp={expectedEnd} t={t} />
				) : expectedStart && expectedDuration ? (
					<DisplayFormattedTime displayTimestamp={expectedStart + expectedDuration} t={t} />
				) : (
					<span className="dimmed">{t('Not set')}</span>
				)}
			</span>
			<span className="rundown-list-item__text" role="gridcell">
				<DisplayFormattedTime displayTimestamp={rundown.modified} t={t} />
			</span>
			<span className="rundown-list-item__text" role="gridcell">
				{rundownLayouts.some(
					(l) =>
						(RundownLayoutsAPI.isLayoutForShelf(l) && l.exposeAsStandalone) ||
						(RundownLayoutsAPI.isLayoutForRundownView(l) && l.exposeAsSelectableLayout)
				) &&
					isOnlyRundownInPlaylist && (
						<RundownViewLayoutSelection
							rundowns={[rundown]}
							rundownLayouts={rundownLayouts}
							playlistId={rundown.playlistId}
						/>
					)}
			</span>
			<span className="rundown-list-item__actions" role="gridcell">
				{confirmReSyncRundownHandler ? (
					<Tooltip
						mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
						overlay={t('Re-sync rundown data with {{nrcsName}}', { nrcsName: getRundownNrcsName(rundown) })}
						placement="top"
					>
						<button className="rundown-list-item__action" onClick={() => confirmReSyncRundownHandler()}>
							{iconResync()}
						</button>
					</Tooltip>
				) : (
					<span className="rundown-list-item__action"></span>
				)}
				{confirmDeleteRundownHandler ? (
					<Tooltip mouseEnterDelay={TOOLTIP_DEFAULT_DELAY} overlay={t('Delete')} placement="top">
						<button className="rundown-list-item__action" onClick={() => confirmDeleteRundownHandler()}>
							{iconRemove()}
						</button>
					</Tooltip>
				) : null}
			</span>
		</li>
	)
})
