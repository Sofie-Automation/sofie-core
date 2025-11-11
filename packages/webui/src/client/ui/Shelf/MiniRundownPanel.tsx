import React, { memo, useEffect } from 'react'
import _ from 'underscore'
import ClassNames from 'classnames'
import {
	RundownLayoutBase,
	DashboardLayoutMiniRundown,
	RundownLayoutMiniRundown,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { dashboardElementStyle } from './DashboardPanel.js'
import { Meteor } from 'meteor/meteor'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIPartInstances } from '../Collections.js'
import { RundownPlaylistClientUtil } from '../../lib/rundownPlaylistUtil.js'

interface IMiniRundownPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutMiniRundown
	playlist: DBRundownPlaylist
}

interface MiniRundownSegment {
	identifier: string
	segmentName: string
	cssClass: string
}

const MiniRundownPanelClassesAndIds = {
	currentSegmentCssClass: 'current-segment',
	nextSegmentCssClass: 'next-segment',
	panelContainerId: 'mini-rundown-panel__container',
	nextSegmentId: 'mini-rundown__next-segment',
	currentSegmentId: 'mini-rundown__current-segment',
}

export const MiniRundownPanel = memo(
	function MiniRundownPanelInner2(props: IMiniRundownPanelProps) {
		// Trigger on mount, or when any props change
		useEffect(() => {
			Meteor.setTimeout(() => {
				const container = document.getElementById(MiniRundownPanelClassesAndIds.panelContainerId)
				if (!container) return
				const nextElement = document.getElementById(MiniRundownPanelClassesAndIds.nextSegmentId)
				const currentElement = document.getElementById(MiniRundownPanelClassesAndIds.currentSegmentId)
				if (nextElement) {
					container.scrollTop = nextElement.offsetTop - nextElement.clientHeight
				} else if (currentElement) {
					container.scrollTop = currentElement.offsetTop
				}
			}, 500)
		}, [...Object.values<any>(props)])

		const currentPartInstanceId: PartInstanceId | undefined = props.playlist.currentPartInfo?.partInstanceId
		const currentPartInstance = useTracker(
			() => currentPartInstanceId && UIPartInstances.findOne(currentPartInstanceId),
			[currentPartInstanceId]
		)

		const nextPartInstanceId: PartInstanceId | undefined = props.playlist.nextPartInfo?.partInstanceId
		const nextPartInstance = useTracker(
			() => nextPartInstanceId && UIPartInstances.findOne(nextPartInstanceId),
			[nextPartInstanceId]
		)

		const allSegments: DBSegment[] = useTracker(
			() => RundownPlaylistClientUtil.getSegments(props.playlist),
			[props.playlist._id, props.playlist.rundownIdsInOrder],
			[]
		)

		const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(props.layout)
		const style = getElementStyle(props, isDashboardLayout)

		const miniRundowns: MiniRundownSegment[] = getMiniRundownList(allSegments, currentPartInstance, nextPartInstance)

		return (
			<div
				key={'miniRundownContainer'}
				className={ClassNames('dashboard-panel mini-rundown-panel', getContainerClass(props, isDashboardLayout))}
				style={getContainerStyle(props, isDashboardLayout)}
			>
				<span className="mini-rundown-panel__name" style={style} key={'miniRundownHeader'}>
					{props.panel.name}{' '}
				</span>

				<div
					className={MiniRundownPanelClassesAndIds.panelContainerId}
					id={MiniRundownPanelClassesAndIds.panelContainerId}
				>
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
	},
	(prevProps, nextProps) => _.isEqual(prevProps, nextProps)
)

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
		return MiniRundownPanelClassesAndIds.currentSegmentCssClass
	}

	if (segment._id === nextPart?.segmentId) {
		return MiniRundownPanelClassesAndIds.nextSegmentCssClass
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
		case MiniRundownPanelClassesAndIds.nextSegmentCssClass:
			return { id: MiniRundownPanelClassesAndIds.nextSegmentId }
		case MiniRundownPanelClassesAndIds.currentSegmentCssClass:
			return { id: MiniRundownPanelClassesAndIds.currentSegmentId }
		default:
			return {}
	}
}
