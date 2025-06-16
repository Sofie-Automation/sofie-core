import classNames from 'classnames'
import React, { useCallback, useEffect, useState } from 'react'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { ISourceLayerExtended } from '../../../lib/RundownResolver.js'
import { RundownUtils } from '../../../lib/rundown.js'
import { AdLibPieceUi } from '../../../lib/shelf.js'
import { PieceUi } from '../../SegmentContainer/withResolvedSegment.js'

interface IProps {
	overlay?: (ref: HTMLDivElement | null, setIsOver: (isOver: boolean) => void) => React.ReactNode
	count: number
	hasOriginInPreceedingPart: boolean
	allSourceLayers: ISourceLayerExtended[]
	thisSourceLayer?: ISourceLayerExtended
	label?: string
	piece?: AdLibPieceUi | PieceUi
	studio: UIStudio
	onClick?: React.EventHandler<React.MouseEvent<HTMLDivElement>>
	onDoubleClick?: React.EventHandler<React.MouseEvent<HTMLDivElement>>
}

export function LinePartIndicator({
	overlay,
	count,
	allSourceLayers,
	thisSourceLayer,
	hasOriginInPreceedingPart,
	label,
	onClick: onClickExternal,
	onDoubleClick,
}: IProps): JSX.Element {
	let typeClass = thisSourceLayer?.type ? RundownUtils.getSourceLayerClassName(thisSourceLayer.type) : undefined
	const [element, setElement] = useState<HTMLDivElement | null>(null)
	const [isMenuOpen, setIsMenuOpen] = useState(false)

	if ((typeClass === undefined || typeClass === '') && thisSourceLayer?.isGuestInput) {
		typeClass = 'guest'
	}

	const onClickAway = useCallback(
		function onClickAway(e: MouseEvent) {
			if (!element) return
			const composedPath = e.composedPath()
			if (composedPath.includes(element)) return
			if (
				composedPath.find(
					(el) => el instanceof HTMLElement && el.classList.contains('segment-opl__piece-indicator-menu')
				)
			)
				return
			setIsMenuOpen(false)
			window.removeEventListener('mousedown', onClickAway)
		},
		[element]
	)

	function onClick(e: React.MouseEvent<HTMLDivElement>) {
		const shouldBeOpen = !isMenuOpen
		setIsMenuOpen(shouldBeOpen)
		onClickExternal?.(e)
		window.addEventListener('mousedown', onClickAway)
	}

	useEffect(() => {
		return () => {
			window.removeEventListener('mousedown', onClickAway)
		}
	}, [])

	return (
		<>
			<div
				className={classNames('segment-opl__piece-indicator-placeholder', {
					multiple: count > 1,
					'multiple--2': count === 2,
					'multiple--3': count > 2,
				})}
				data-source-layer-ids={allSourceLayers.map((sourceLayer) => sourceLayer._id).join(' ')}
				ref={setElement}
				onClick={onClick}
				onDoubleClick={onDoubleClick}
			>
				{count === 0 && (
					<div className={classNames('segment-opl__piece-indicator', 'segment-opl__piece-indicator--no-piece')}></div>
				)}
				{count > 1 && <div className={classNames('segment-opl__piece-indicator', typeClass)}></div>}
				{count > 0 && (
					<div
						className={classNames('segment-opl__piece-indicator', typeClass, {
							continuation: hasOriginInPreceedingPart,
						})}
					>
						{label}
					</div>
				)}
			</div>
			{isMenuOpen && !!overlay && overlay(element, setIsMenuOpen)}
		</>
	)
}
