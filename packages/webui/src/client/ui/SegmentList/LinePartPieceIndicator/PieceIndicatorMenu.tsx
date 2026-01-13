import React, { useEffect, useLayoutEffect, useState } from 'react'
import Escape from './../../../lib/Escape.js'
import { PieceExtended } from '../../../lib/RundownResolver.js'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { usePopper } from 'react-popper'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { StoryboardSecondaryPiece } from '../../SegmentStoryboard/StoryboardPartSecondaryPieces/StoryboardSecondaryPiece.js'
import StudioContext from '../../RundownView/StudioContext.js'
import { PieceUi } from '../../SegmentContainer/withResolvedSegment.js'
import { catchError } from '../../../lib/lib.js'

export function PieceIndicatorMenu({
	pieces,
	partId,
	parentEl,
	setIsOver,
	onPieceClick,
	onPieceDoubleClick,
}: {
	partId: PartId
	pieces: PieceExtended[]
	parentEl: HTMLDivElement | null
	setIsOver: (isOver: boolean) => void
	onPieceClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
}): JSX.Element | null {
	const [indicatorMenuEl, setIndicatorMenuEl] = useState<HTMLDivElement | null>(null)
	const { styles, attributes, update } = usePopper(parentEl, indicatorMenuEl, POPPER_OPTIONS)

	useLayoutEffect(() => {
		update?.().catch(catchError('pieceIndicatorMenu popper update'))
	}, [pieces.length])

	useEffect(() => {
		if (!indicatorMenuEl) return

		let timeout: NodeJS.Timeout | undefined = undefined

		function onMouseEnter() {
			clearTimeout(timeout)
			setIsOver(true)
		}

		function onMouseLeave() {
			clearTimeout(timeout)
			timeout = setTimeout(() => {
				setIsOver(false)
			}, AUTO_HIDE_TIMEOUT)
		}

		indicatorMenuEl.addEventListener('mouseenter', onMouseEnter)
		indicatorMenuEl.addEventListener('mouseleave', onMouseLeave)

		return () => {
			clearTimeout(timeout)
			indicatorMenuEl.removeEventListener('mouseenter', onMouseEnter)
			indicatorMenuEl.removeEventListener('mouseleave', onMouseLeave)
		}
	}, [indicatorMenuEl])

	useLayoutEffect(() => {
		if (!indicatorMenuEl) return

		const parentEl = indicatorMenuEl.parentElement
		if (!parentEl) return

		// This is a hack, due to the unfortunate architecture of react-escape that doesn't allow specifying the
		// zIndex of the escaping element.
		parentEl.style.zIndex = '999'
	}, [indicatorMenuEl])

	if (pieces.length === 0) return null

	return (
		<StudioContext.Consumer>
			{(studio) =>
				studio && (
					<Escape to="document">
						<div
							className="segment-opl__piece-indicator-menu"
							/** This is so that we avoid updating the state once the component has been unmounted */
							ref={(el) => el !== null && setIndicatorMenuEl(el)}
							style={styles.popper}
							{...attributes.popper}
						>
							{pieces.map(
								(piece) =>
									!!piece.sourceLayer && (
										<StoryboardSecondaryPiece
											key={unprotectString(piece.instance._id)}
											layer={piece.sourceLayer}
											piece={piece}
											partId={partId}
											studio={studio}
											isLiveLine={false}
											onClick={(e) => onPieceClick?.(piece, e)}
											onDoubleClick={(e) => onPieceDoubleClick?.(piece, e)}
										/>
									)
							)}
						</div>
					</Escape>
				)
			}
		</StudioContext.Consumer>
	)
}

const AUTO_HIDE_TIMEOUT = 7000
const VIEWPORT_PADDING = { right: 70 }

const POPPER_OPTIONS = {
	placement: 'bottom' as const,
	modifiers: [
		{
			name: 'flip',
			options: {
				fallbackPlacements: ['top'],
			},
		},
		{
			name: 'preventOverflow',
			options: {
				padding: VIEWPORT_PADDING,
			},
		},
		// sameWidth,
	],
}
