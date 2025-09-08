import React, { useState, useRef, useEffect, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import ClassNames from 'classnames'
import { RundownUtils } from '../../../lib/rundown.js'
import { ILayerItemRendererProps } from './ItemRendererFactory.js'
import { NoraContent, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { getElementDocumentOffset, OffsetPosition } from '../../../utils/positions.js'
import { getElementWidth } from '../../../utils/dimensions.js'
import { StyledTimecode } from '../../../lib/StyledTimecode.js'
import { assertNever } from '../../../lib/tempLib.js'
import { AdLibPieceUi } from '../../../lib/shelf.js'
import { ActionAdLibHotkeyPreview } from '../../../lib/triggers/ActionAdLibHotkeyPreview.js'
import {
	PreviewPopUpContext,
	IPreviewPopUpSession,
	convertSourceLayerItemToPreview,
} from '../../PreviewPopUp/PreviewPopUpContext.js'

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

	const previewContext = useContext(PreviewPopUpContext)
	const previewSession = useRef<IPreviewPopUpSession | null>(null)
	const { contents: previewContents, options: previewOptions } = convertSourceLayerItemToPreview(
		props.adLibListItem.sourceLayer?.type,
		props.adLibListItem,
		props.contentStatus
	)

	const handleOnMouseOver = (e: React.MouseEvent) => {
		if (itemIconPosition) {
			const left = e.pageX - itemIconPosition.left
			const unprocessedPercentage = left / itemIconPosition.width
			if (unprocessedPercentage <= 1 && !showMiniInspector) {
				setShowMiniInspector(true)
				previewSession.current = previewContext.requestPreview(e.target as any, previewContents, previewOptions)
			}
		}
	}

	const handleOnMouseMove = (e: React.MouseEvent) => {
		if (itemIconPosition) {
			const left = e.pageX - itemIconPosition.left
			const unprocessedPercentage = left / itemIconPosition.width
			if ((unprocessedPercentage > 1 || unprocessedPercentage < 0) && showMiniInspector) {
				setShowMiniInspector(false)
				if (previewSession.current) {
					previewSession.current.close()
					previewSession.current = null
				}
				return false
			} else if (unprocessedPercentage >= 0 && unprocessedPercentage <= 1 && !showMiniInspector) {
				setShowMiniInspector(true)
				previewSession.current = previewContext.requestPreview(e.target as any, previewContents, previewOptions)
			}
		}
	}

	const handleOnMouseLeave = () => {
		setShowMiniInspector(false)
		if (previewSession.current) {
			previewSession.current.close()
			previewSession.current = null
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
			<td className="adlib-panel__list-view__list__table__cell--name">{props.adLibListItem.name}</td>
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
