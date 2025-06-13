import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import {
	RundownLayoutBase,
	DashboardLayoutMiniRundown,
	RundownLayoutMiniRundown,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { dashboardElementStyle } from './DashboardPanel'
import { Meteor } from 'meteor/meteor'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIPartInstances } from '../Collections'
import { RundownPlaylistClientUtil } from '../../lib/rundownPlaylistUtil'

interface IMiniRundownPanelProps {
	key: string
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutMiniRundown
	playlist: DBRundownPlaylist
}

interface IMiniRundownPanelTrackedProps {
	currentPartInstance?: PartInstance
	nextPartInstance?: PartInstance
	allSegments?: DBSegment[]
}

interface IState {}

interface MiniRundownSegment {
	identifier: string
	segmentName: string
	cssClass: string
}

export class MiniRundownPanelInner extends React.Component<IMiniRundownPanelProps & IMiniRundownPanelTrackedProps> {
	static currentSegmentCssClass = 'current-segment'
	static nextSegmentCssClass = 'next-segment'
	static panelContainerId = 'mini-rundown-panel__container'
	static nextSegmentId = 'mini-rundown__next-segment'
	static currentSegmentId = 'mini-rundown__current-segment'

	componentDidMount(): void {
		this.scrollIntoView()
	}

	componentDidUpdate(): void {
		this.scrollIntoView()
	}

	private scrollIntoView() {
		Meteor.setTimeout(() => {
			const container = document.getElementById(MiniRundownPanelInner.panelContainerId)
			if (!container) return
			const nextElement = document.getElementById(MiniRundownPanelInner.nextSegmentId)
			const currentElement = document.getElementById(MiniRundownPanelInner.currentSegmentId)
			if (nextElement) {
				container.scrollTop = nextElement.offsetTop - nextElement.clientHeight
			} else if (currentElement) {
				container.scrollTop = currentElement.offsetTop
			}
		}, 500)
	}

	render(): JSX.Element {
		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(this.props.layout)
		const style = getElementStyle(this.props, isDashboardLayout)

		const miniRundowns: MiniRundownSegment[] = getMiniRundownList(
			this.props.allSegments,
			this.props.currentPartInstance,
			this.props.nextPartInstance
		)

		return (
			<div
				key={'miniRundownContainer'}
				className={ClassNames('dashboard-panel mini-rundown-panel', getContainerClass(this.props, isDashboardLayout))}
				style={getContainerStyle(this.props, isDashboardLayout)}
			>
				<span className="mini-rundown-panel__name" style={style} key={'miniRundownHeader'}>
					{this.props.panel.name}{' '}
				</span>

				<div className={MiniRundownPanelInner.panelContainerId} id={MiniRundownPanelInner.panelContainerId}>
					{miniRundowns.map((miniRundown: MiniRundownSegment, index: number) => (
						<div
							className={miniRundown.cssClass}
							{...getIdAttributeForNextSegment(miniRundown.cssClass)}
							key={getElementKey('miniRundownElement', miniRundown.identifier, index)}
						>
							<span
								className="mini-rundown-panel__rank"
								key={getElementKey('miniRundownIdentifier', miniRundown.identifier, index)}
							>
								{miniRundown.identifier}
							</span>
							<span
								className="mini-rundown-panel__segment"
								style={style}
								key={getElementKey('miniRundownSegment', miniRundown.identifier, index)}
							>
								{miniRundown.segmentName}
							</span>
						</div>
					))}
				</div>
			</div>
		)
	}
}

export const MiniRundownPanel = withTracker<IMiniRundownPanelProps, IState, IMiniRundownPanelTrackedProps>(
	(props: IMiniRundownPanelProps & IMiniRundownPanelTrackedProps) => {
		let currentPartInstance: PartInstance | undefined = undefined
		let nextPartInstance: PartInstance | undefined = undefined

		const currentPartInstanceId: PartInstanceId | undefined = props.playlist.currentPartInfo?.partInstanceId
		if (currentPartInstanceId) {
			currentPartInstance = UIPartInstances.findOne(currentPartInstanceId)
		}

		if (props.playlist.nextPartInfo) {
			nextPartInstance = UIPartInstances.findOne(props.playlist.nextPartInfo.partInstanceId)
		}

		const allSegments: DBSegment[] = RundownPlaylistClientUtil.getSegments(props.playlist)

		return { currentPartInstance, nextPartInstance, allSegments }
	},
	(_data, props: IMiniRundownPanelProps, nextProps: IMiniRundownPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(MiniRundownPanelInner)

function getMiniRundownList(
	allSegments?: DBSegment[],
	currentPart?: PartInstance,
	nextPart?: PartInstance
): MiniRundownSegment[] {
	const miniRundownSegments: MiniRundownSegment[] = []

	allSegments?.forEach((segment: DBSegment) => {
		if (segment.isHidden) return
		miniRundownSegments.push({
			identifier: getSegmentIdentifier(segment),
			segmentName: getSegmentName(segment),
			cssClass: getSegmentCssClass(segment, currentPart, nextPart),
		})
	})

	return miniRundownSegments
}

function getSegmentCssClass(segment: DBSegment, currentPart?: PartInstance, nextPart?: PartInstance): string {
	if (segment._id === currentPart?.segmentId) {
		return MiniRundownPanelInner.currentSegmentCssClass
	}

	if (segment._id === nextPart?.segmentId) {
		return MiniRundownPanelInner.nextSegmentCssClass
	}

	return ''
}

function getContainerClass(props: IMiniRundownPanelProps, isDashboardLayout: boolean): string[] | undefined {
	return isDashboardLayout ? (props.panel as DashboardLayoutMiniRundown).customClasses : undefined
}

function getContainerStyle(props: IMiniRundownPanelProps, isDashboardLayout: boolean): React.CSSProperties {
	return _.extend(isDashboardLayout ? dashboardElementStyle({ ...(props.panel as DashboardLayoutMiniRundown) }) : {}, {
		visibility: props.visible ? 'visible' : 'hidden',
	})
}

function getElementStyle(props: IMiniRundownPanelProps, isDashboardLayout: boolean) {
	return {
		fontSize: isDashboardLayout ? ((props.panel as DashboardLayoutMiniRundown).scale || 1) + 'em' : undefined,
	}
}

function getSegmentName(segment: DBSegment | undefined): string {
	return segment?.name !== undefined ? segment?.name : ''
}

function getSegmentIdentifier(segment: DBSegment | undefined): string {
	return segment?.identifier !== undefined ? segment?.identifier : ''
}

function getElementKey(prefix: string, identifier: string, index: number): string {
	return prefix + identifier + 'index' + index
}

function getIdAttributeForNextSegment(cssClass: string) {
	switch (cssClass) {
		case MiniRundownPanelInner.nextSegmentCssClass:
			return { id: MiniRundownPanelInner.nextSegmentId }
		case MiniRundownPanelInner.currentSegmentCssClass:
			return { id: MiniRundownPanelInner.currentSegmentId }
		default:
			return {}
	}
}
