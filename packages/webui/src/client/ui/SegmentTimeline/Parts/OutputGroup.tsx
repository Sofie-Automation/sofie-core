import React from 'react'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ISourceLayerExtended } from '../../../lib/RundownResolver.js'
import { IContextMenuContext } from '../../RundownView.js'
import { IOutputLayerUi, PartUi, PieceUi, SegmentUi } from '../SegmentTimelineContainer.js'
import { FlattenedSourceLayers } from './FlattenedSourceLayers.js'
import { SourceLayer } from './SourceLayer.js'
import classNames from 'classnames'
import { DEBUG_MODE } from '../SegmentTimelineDebugMode.js'
import { RundownUtils } from '../../../lib/rundown.js'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'

interface IOutputGroupProps {
	layer: IOutputLayerUi
	sourceLayers: ISourceLayerExtended[]
	playlist: DBRundownPlaylist
	studio: UIStudio
	segment: SegmentUi
	part: PartUi
	startsAt: number
	duration: number
	displayDuration: number
	timeScale: number
	collapsedOutputs: {
		[key: string]: boolean
	}
	isLiveLine: boolean
	isNextLine: boolean
	isTooSmallForText: boolean
	onFollowLiveLine?: (state: boolean, event: any) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	followLiveLine: boolean
	liveLineHistorySize: number
	livePosition: number | null
	scrollLeft: number
	scrollWidth: number
	liveLinePadding: number
	autoNextPart: boolean
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	indexOffset: number
	isPreview: boolean
	showDurationSourceLayers?: Set<ISourceLayer['_id']>
}

export function OutputGroup(props: Readonly<IOutputGroupProps>): JSX.Element {
	const isCollapsed =
		props.collapsedOutputs[props.layer._id] !== undefined
			? props.collapsedOutputs[props.layer._id] === true
			: props.layer.isDefaultCollapsed

	function shouldShowDuration(sourceLayer: ISourceLayerExtended): boolean {
		return !!props.showDurationSourceLayers && props.showDurationSourceLayers.has(sourceLayer._id)
	}

	function renderInside(isOutputGroupCollapsed: boolean) {
		if (props.sourceLayers !== undefined) {
			if (!props.layer.isFlattened) {
				return props.sourceLayers.map((sourceLayer, index) => {
					return (
						<SourceLayer
							key={sourceLayer._id}
							studio={props.studio}
							layer={sourceLayer}
							playlist={props.playlist}
							outputLayer={props.layer}
							outputGroupCollapsed={isOutputGroupCollapsed}
							segment={props.segment}
							part={props.part}
							startsAt={props.startsAt}
							duration={props.duration}
							displayDuration={props.displayDuration}
							timeScale={props.timeScale}
							autoNextPart={props.autoNextPart}
							liveLinePadding={props.liveLinePadding}
							layerIndex={props.indexOffset + (isOutputGroupCollapsed ? 0 : index)}
							followLiveLine={props.followLiveLine}
							isLiveLine={props.isLiveLine}
							isNextLine={props.isLiveLine}
							isTooSmallForText={props.isTooSmallForText}
							liveLineHistorySize={props.liveLineHistorySize}
							livePosition={props.livePosition}
							scrollLeft={props.scrollLeft}
							scrollWidth={props.scrollWidth}
							onContextMenu={props.onContextMenu}
							onFollowLiveLine={props.onFollowLiveLine}
							onPieceClick={props.onPieceClick}
							onPieceDoubleClick={props.onPieceDoubleClick}
							isPreview={props.isPreview}
							showDuration={shouldShowDuration(sourceLayer)}
						/>
					)
				})
			} else {
				return (
					<FlattenedSourceLayers
						key={props.layer._id + '_flattened'}
						studio={props.studio}
						layers={props.sourceLayers}
						playlist={props.playlist}
						outputLayer={props.layer}
						outputGroupCollapsed={isOutputGroupCollapsed}
						segment={props.segment}
						part={props.part}
						startsAt={props.startsAt}
						duration={props.duration}
						displayDuration={props.displayDuration}
						timeScale={props.timeScale}
						autoNextPart={props.autoNextPart}
						liveLinePadding={props.liveLinePadding}
						layerIndex={props.indexOffset}
						followLiveLine={props.followLiveLine}
						isLiveLine={props.isLiveLine}
						isNextLine={props.isLiveLine}
						isTooSmallForText={props.isTooSmallForText}
						liveLineHistorySize={props.liveLineHistorySize}
						livePosition={props.livePosition}
						scrollLeft={props.scrollLeft}
						scrollWidth={props.scrollWidth}
						onContextMenu={props.onContextMenu}
						onFollowLiveLine={props.onFollowLiveLine}
						onPieceClick={props.onPieceClick}
						onPieceDoubleClick={props.onPieceDoubleClick}
						isPreview={props.isPreview}
						shouldShowDuration={shouldShowDuration}
					/>
				)
			}
		}
	}

	return (
		<div
			className={classNames(
				'segment-timeline__output-group',
				{
					collapsable: props.layer.sourceLayers && props.layer.sourceLayers.length > 1 && !props.layer.isFlattened,
					collapsed: isCollapsed,
					flattened: props.layer.isFlattened,
				},
				`layer-count-${props.layer.isFlattened ? 1 : isCollapsed ? 1 : props.sourceLayers?.length || 0}`
			)}
			data-layer-group-id={props.layer._id}
		>
			{DEBUG_MODE && (
				<div className="segment-timeline__debug-info red">
					{RundownUtils.formatTimeToTimecode(props.studio.settings, props.startsAt)}
				</div>
			)}
			{renderInside(!!isCollapsed)}
		</div>
	)
}
