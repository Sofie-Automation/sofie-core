import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ClassNames from 'classnames'
import { RundownUtils } from '../../../lib/rundown'
import { ILayerItemRendererProps } from './ItemRendererFactory'
import { IBlueprintPieceType, NoraContent, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { getElementDocumentOffset, OffsetPosition } from '../../../utils/positions'
import { getElementWidth } from '../../../utils/dimensions'
import { StyledTimecode } from '../../../lib/StyledTimecode'
import { assertNever, protectString } from '../../../lib/tempLib'
import { L3rdFloatingInspector } from '../../FloatingInspectors/L3rdFloatingInspector'
import { PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { AdLibPieceUi } from '../../../lib/shelf'
import { ActionAdLibHotkeyPreview } from '../../../lib/triggers/ActionAdLibHotkeyPreview'

export const L3rdListItemRenderer: React.FunctionComponent<ILayerItemRendererProps> = (
	props: ILayerItemRendererProps
) => {
	const { t } = useTranslation()
	const itemIcon = useRef<HTMLTableDataCellElement>(null)
	const [showMiniInspector, setShowMiniInspector] = useState(false)
	const [itemIconPosition, setItemIconPosition] = useState<(OffsetPosition & { width: number }) | null>(null)

	const noraContent = props.adLibListItem.content as NoraContent | undefined
	let sourceDuration: string | number | null = null

	const itemAsPieceUi = props.adLibListItem as AdLibPieceUi

	if (noraContent) {
		switch (props.adLibListItem.lifespan) {
			case PieceLifespan.WithinPart:
				sourceDuration = t('Until next take')
				if (itemAsPieceUi.expectedDuration) {
					sourceDuration = itemAsPieceUi.expectedDuration!
				}
				break
			case PieceLifespan.OutOnSegmentChange:
				sourceDuration = t('Until next segment')
				break
			case PieceLifespan.OutOnSegmentEnd:
				sourceDuration = t('Until end of segment')
				break
			case PieceLifespan.OutOnRundownChange:
				sourceDuration = t('Until next rundown')
				break
			case PieceLifespan.OutOnRundownEnd:
				sourceDuration = t('Until end of rundown')
				break
			case PieceLifespan.OutOnShowStyleEnd:
				sourceDuration = t('Until end of showstyle')
				break
			default:
				assertNever(props.adLibListItem.lifespan)
		}
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

	const handleOnMouseMove = (e: React.MouseEvent) => {
		if (itemIconPosition) {
			const left = e.pageX - itemIconPosition.left
			const unprocessedPercentage = left / itemIconPosition.width
			if ((unprocessedPercentage > 1 || unprocessedPercentage < 0) && showMiniInspector) {
				setShowMiniInspector(false)
				return false
			} else if (unprocessedPercentage >= 0 && unprocessedPercentage <= 1 && !showMiniInspector) {
				setShowMiniInspector(true)
			}
		}
	}

	const handleOnMouseLeave = () => setShowMiniInspector(false)

	const virtualPiece: Omit<PieceInstancePiece, 'timelineObjectsString'> = useMemo(
		() => ({
			...props.adLibListItem,
			enable: {
				start: 'now',
			},
			startPartId: protectString(''),
			invalid: !!props.adLibListItem.invalid,
			pieceType: IBlueprintPieceType.Normal,
		}),
		[props.adLibListItem]
	)

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
				onMouseMove={handleOnMouseMove}
				onMouseLeave={handleOnMouseLeave}
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
				{props.adLibListItem.name}
				<L3rdFloatingInspector
					showMiniInspector={showMiniInspector}
					content={noraContent}
					position={{
						top: itemIconPosition?.top ?? 0,
						left: itemIconPosition?.left ?? 0,
						anchor: 'start',
						position: 'top-start',
					}}
					typeClass={props.layer && RundownUtils.getSourceLayerClassName(props.layer.type)}
					itemElement={itemIcon.current}
					piece={virtualPiece}
					pieceRenderedDuration={itemAsPieceUi.expectedDuration || null}
					pieceRenderedIn={null}
				/>
			</td>
			<td className="adlib-panel__list-view__list__table__cell--duration">
				{typeof sourceDuration === 'string' ? (
					sourceDuration
				) : typeof sourceDuration === 'number' ? (
					<StyledTimecode time={sourceDuration} studioSettings={props.studio?.settings} />
				) : (
					sourceDuration
				)}
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
