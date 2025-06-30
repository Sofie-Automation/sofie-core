import * as React from 'react'
import _ from 'underscore'
import ClassNames from 'classnames'
import {
	RundownLayoutBase,
	RundownLayoutPieceCountdown,
	DashboardLayoutPieceCountdown,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { dashboardElementStyle } from './DashboardPanel.js'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
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

interface IPieceCountdownPanelTrackedProps {
	livePieceInstance?: ReadonlyDeep<PieceInstance>
}

interface IState {
	displayTimecode: number
}

export class PieceCountdownPanelInner extends React.Component<
	IPieceCountdownPanelProps & IPieceCountdownPanelTrackedProps,
	IState
> {
	constructor(props: IPieceCountdownPanelProps & IPieceCountdownPanelTrackedProps) {
		super(props)
		this.state = {
			displayTimecode: 0,
		}
		this.updateTimecode = this.updateTimecode.bind(this)
	}

	componentDidMount(): void {
		window.addEventListener(RundownTiming.Events.timeupdateLowResolution, this.updateTimecode)
	}

	componentWillUnmount(): void {
		window.removeEventListener(RundownTiming.Events.timeupdateLowResolution, this.updateTimecode)
	}

	private updateTimecode(e: TimingEvent) {
		let timecode = 0
		if (this.props.livePieceInstance && this.props.livePieceInstance.plannedStartedPlayback) {
			const vtContent = this.props.livePieceInstance.piece.content as VTContent | undefined
			const sourceDuration = vtContent?.sourceDuration || 0
			const seek = vtContent?.seek || 0
			const startedPlayback = this.props.livePieceInstance.plannedStartedPlayback
			if (startedPlayback && sourceDuration > 0) {
				timecode = e.detail.currentTime - (startedPlayback + sourceDuration - seek)
			}
		}
		if (this.state.displayTimecode != timecode) {
			this.setState({
				displayTimecode: timecode,
			})
		}
	}

	render(): JSX.Element {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		return (
			<div
				className="piece-countdown-panel"
				style={{
					visibility: this.props.visible ? 'visible' : 'hidden',
					...(isDashboardLayout ? dashboardElementStyle(this.props.panel as DashboardLayoutPieceCountdown) : {}),
				}}
			>
				<span
					className={ClassNames('piece-countdown-panel__timecode', 'dashboard__panel--font-scaled', {
						overtime: Math.floor(this.state.displayTimecode / 1000) > 0,
					})}
				>
					{RundownUtils.formatDiffToTimecode(
						this.state.displayTimecode || 0,
						true,
						false,
						true,
						false,
						true,
						'',
						false,
						true
					)}
				</span>
			</div>
		)
	}
}

export const PieceCountdownPanel = withTracker<IPieceCountdownPanelProps, IState, IPieceCountdownPanelTrackedProps>(
	(props: IPieceCountdownPanelProps & IPieceCountdownPanelTrackedProps) => {
		const unfinishedPieces = getUnfinishedPieceInstancesReactive(props.playlist, props.showStyleBase)
		const livePieceInstance: ReadonlyDeep<PieceInstance> | undefined =
			props.panel.sourceLayerIds && props.panel.sourceLayerIds.length
				? unfinishedPieces.find((piece: ReadonlyDeep<PieceInstance>) => {
						return (
							(props.panel.sourceLayerIds || []).indexOf(piece.piece.sourceLayerId) !== -1 &&
							piece.partInstanceId === props.playlist.currentPartInfo?.partInstanceId
						)
					})
				: undefined
		return { livePieceInstance }
	},
	(_data, props: IPieceCountdownPanelProps, nextProps: IPieceCountdownPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(PieceCountdownPanelInner)
