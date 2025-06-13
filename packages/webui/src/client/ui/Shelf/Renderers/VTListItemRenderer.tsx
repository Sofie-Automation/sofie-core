import React, { useState, useRef, useEffect } from 'react'
import ClassNames from 'classnames'
import { RundownUtils } from '../../../lib/rundown'
import { ILayerItemRendererProps } from './ItemRendererFactory'
import { VTContent, LiveSpeakContent } from '@sofie-automation/blueprints-integration'
import { VTFloatingInspector } from '../../FloatingInspectors/VTFloatingInspector'
import { getNoticeLevelForPieceStatus } from '../../../lib/notifications/notifications'
import { getElementDocumentOffset, OffsetPosition } from '../../../utils/positions'
import { getElementWidth } from '../../../utils/dimensions'
import { StyledTimecode } from '../../../lib/StyledTimecode'
import { ActionAdLibHotkeyPreview } from '../../../lib/triggers/ActionAdLibHotkeyPreview'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { HourglassIconSmall } from '../../../lib/ui/icons/notifications'

export const VTListItemRenderer: React.FunctionComponent<ILayerItemRendererProps> = (
	props: ILayerItemRendererProps
) => {
	const itemIcon = useRef<HTMLTableDataCellElement>(null)
	const [hoverScrubTimePosition, setHoverScrubTimePosition] = useState(0)
	const [showMiniInspector, setShowMiniInspector] = useState(false)
	const [itemIconPosition, setItemIconPosition] = useState<(OffsetPosition & { width: number }) | null>(null)

	const vtContent = props.adLibListItem.content as VTContent | LiveSpeakContent | undefined
	let sourceDuration: number | null = null

	if (vtContent) {
		sourceDuration = vtContent.sourceDuration || null
	}

	useEffect(() => {
		if (itemIcon.current) {
			const offset = getElementDocumentOffset(itemIcon.current)
			const width = getElementWidth(itemIcon.current)
			if (offset && width) {
				if (
					itemIconPosition &&
					itemIconPosition.width === width &&
					itemIconPosition.top === offset.top &&
					itemIconPosition.left === offset.left
				) {
					return
				}

				setItemIconPosition({
					...offset,
					width,
				})
			} else {
				if (itemIconPosition === null) {
					return
				}

				setItemIconPosition(null)
			}
		}
	})

	const handleOnMouseOver = (e: React.MouseEvent) => {
		if (itemIconPosition) {
			const left = e.pageX - itemIconPosition.left
			const unprocessedPercentage = left / itemIconPosition.width
			if (unprocessedPercentage <= 1 && !showMiniInspector) {
				setShowMiniInspector(true)
			}
		}
	}

	const handleOnMouseLeave = () => setShowMiniInspector(false)

	const handleOnMouseMove = (e: React.MouseEvent) => {
		if (itemIconPosition) {
			const left = e.pageX - itemIconPosition.left
			let unprocessedPercentage = left / itemIconPosition.width
			if ((unprocessedPercentage > 1 || unprocessedPercentage < 0) && showMiniInspector) {
				setShowMiniInspector(false)
				return false
			} else if (unprocessedPercentage >= 0 && unprocessedPercentage <= 1 && !showMiniInspector) {
				setShowMiniInspector(true)
			}
			unprocessedPercentage = (left - 5) / (itemIconPosition.width - 15)
			const percentage = Math.max(0, Math.min(1, unprocessedPercentage))
			setHoverScrubTimePosition(percentage * (sourceDuration || 0))
		}
	}

	const type = props.adLibListItem.isAction
		? props.adLibListItem.isGlobal
			? 'rundownBaselineAdLibAction'
			: 'adLibAction'
		: props.adLibListItem.isClearSourceLayer
		? 'clearSourceLayer'
		: props.adLibListItem.isSticky
		? 'sticky'
		: props.adLibListItem.isGlobal
		? 'rundownBaselineAdLibItem'
		: 'adLibPiece'

	return (
		<>
			<td
				className={ClassNames(
					'adlib-panel__list-view__list__table__cell--icon',
					props.layer && RundownUtils.getSourceLayerClassName(props.layer.type),
					props.status && RundownUtils.getPieceStatusClassName(props.status)
				)}
				ref={itemIcon}
				onMouseOver={handleOnMouseOver}
				onMouseLeave={handleOnMouseLeave}
				onMouseMove={handleOnMouseMove}
			>
				<div className="adlib-panel__list-view__list__table__cell--layer">
					{(props.layer && (props.layer.abbreviation || props.layer.name)) || null}
				</div>
			</td>
			<td className="adlib-panel__list-view__list__table__cell--shortcut">
				<ActionAdLibHotkeyPreview targetId={props.adLibListItem._id as any} type={type} />
			</td>
			<td className="adlib-panel__list-view__list__table__cell--output">
				{(props.outputLayer && props.outputLayer.name) || null}
			</td>
			<td className="adlib-panel__list-view__list__table__cell--name">
				{props.status === PieceStatusCode.SOURCE_NOT_READY && (
					<div className="piece__status-icon type-hourglass">
						<HourglassIconSmall />
					</div>
				)}
				{props.adLibListItem.name}
				<VTFloatingInspector
					status={props.status || PieceStatusCode.UNKNOWN}
					showMiniInspector={showMiniInspector}
					timePosition={hoverScrubTimePosition}
					content={vtContent}
					position={{
						top: itemIconPosition?.top ?? 0,
						left: itemIconPosition?.left ?? 0,
						anchor: 'start',
						position: 'top-start',
					}}
					typeClass={props.layer && RundownUtils.getSourceLayerClassName(props.layer.type)}
					itemElement={itemIcon.current}
					noticeMessages={props.messages || null}
					noticeLevel={getNoticeLevelForPieceStatus(props.status ?? undefined)}
					previewUrl={props.contentStatus?.previewUrl}
					studio={props.studio}
				/>
			</td>
			<td className="adlib-panel__list-view__list__table__cell--duration">
				{sourceDuration ? <StyledTimecode time={sourceDuration} studioSettings={props.studio?.settings} /> : null}
			</td>
			{/*<td className='adlib-panel__list-view__list__table__cell--data'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--resolution'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--fps'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--tc-start'>
			&nbsp;
		</td> */}
		</>
	)
}
