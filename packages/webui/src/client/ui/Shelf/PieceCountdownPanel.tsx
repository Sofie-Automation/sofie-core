import { useEffect, useState } from 'react'
import ClassNames from 'classnames'
import {
	RundownLayoutBase,
	RundownLayoutPieceCountdown,
	DashboardLayoutPieceCountdown,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { dashboardElementStyle } from './DashboardPanel.js'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { RundownUtils } from '../../lib/rundown.js'
import { RundownTiming, TimingEvent } from '../RundownView/RundownTiming/RundownTiming.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { getUnfinishedPieceInstancesReactive } from '../../lib/rundownLayouts.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { ReadonlyDeep } from 'type-fest'
interface IPieceCountdownPanelProps {
	visible?: boolean
	layout: RundownLayoutBase

	panel: RundownLayoutPieceCountdown
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
}

export function PieceCountdownPanel({
	visible,
	layout,
	panel,
	playlist,
	showStyleBase,
}: IPieceCountdownPanelProps): JSX.Element {
	const [displayTimecode, setDisplayTimecode] = useState(0)

	const livePieceInstance = useTracker(() => {
		const unfinishedPieces = getUnfinishedPieceInstancesReactive(playlist, showStyleBase)
		const livePieceInstance: ReadonlyDeep<PieceInstance> | undefined =
			panel.sourceLayerIds && panel.sourceLayerIds.length
				? unfinishedPieces.find((piece: ReadonlyDeep<PieceInstance>) => {
						return (
							(panel.sourceLayerIds || []).indexOf(piece.piece.sourceLayerId) !== -1 &&
							piece.partInstanceId === playlist.currentPartInfo?.partInstanceId
						)
					})
				: undefined
		return livePieceInstance
	}, [playlist, showStyleBase, panel.sourceLayerIds])

	useEffect(() => {
		const updateTimecode = (e: TimingEvent) => {
			let timecode = 0
			if (livePieceInstance && livePieceInstance.plannedStartedPlayback) {
				const vtContent = livePieceInstance.piece.content as VTContent | undefined
				const sourceDuration = vtContent?.sourceDuration || 0
				const seek = vtContent?.seek || 0
				const startedPlayback = livePieceInstance.plannedStartedPlayback
				if (startedPlayback && sourceDuration > 0) {
					timecode = e.detail.currentTime - (startedPlayback + sourceDuration - seek)
				}
			}
			setDisplayTimecode(timecode)
		}

		window.addEventListener(RundownTiming.Events.timeupdateLowResolution, updateTimecode)

		return () => {
			window.removeEventListener(RundownTiming.Events.timeupdateLowResolution, updateTimecode)
		}
	}, [livePieceInstance])

	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)
	return (
		<div
			className="piece-countdown-panel"
			style={{
				visibility: visible ? 'visible' : 'hidden',
				...(isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutPieceCountdown) : {}),
			}}
		>
			<span
				className={ClassNames('piece-countdown-panel__timecode', 'dashboard__panel--font-scaled', {
					overtime: Math.floor(displayTimecode / 1000) > 0,
				})}
			>
				{RundownUtils.formatDiffToTimecode(displayTimecode || 0, true, false, true, false, true, '', false, true)}
			</span>
		</div>
	)
}
