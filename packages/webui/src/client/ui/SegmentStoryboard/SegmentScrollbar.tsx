import React, { useEffect, useRef, useState } from 'react'
import { LeftArrow, RightArrow } from '../../lib/ui/icons/segment'
import { getElementWidth } from '../../utils/dimensions'

interface IProps {
	scrollLeft: number
	maxScrollLeft: number
	onScrollLeftChange?: (scrollLeft: number) => void
	onScrollStart?: () => void
	onScrollEnd?: () => void
}

export function SegmentScrollbar({
	scrollLeft,
	maxScrollLeft,
	onScrollLeftChange,
	onScrollStart,
	onScrollEnd,
}: Readonly<IProps>): JSX.Element {
	const ref = useRef<HTMLDivElement>(null)
	const [grabbed, setGrabbed] = useState<{ pageX: number; pageY: number; initialScrollLeft: number } | null>(null)

	const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.stopPropagation()
		setGrabbed({ pageX: e.pageX, pageY: e.pageY, initialScrollLeft: scrollLeft })
		if (onScrollStart) onScrollStart()
	}

	useEffect(() => {
		if (!grabbed || !ref.current) return

		const trackTotalWidth = getElementWidth(ref.current)

		const onPointerUp = () => {
			setGrabbed(null)
			if (onScrollEnd) onScrollEnd()
		}
		const onPointerMove = (e: PointerEvent) => {
			if (onScrollLeftChange)
				onScrollLeftChange(scrollLeft + ((grabbed.pageX - e.pageX) / trackTotalWidth) * maxScrollLeft * -1)
		}

		document.addEventListener('pointerup', onPointerUp)
		document.addEventListener('pointercancel', onPointerUp)
		document.addEventListener('pointermove', onPointerMove)

		return () => {
			document.removeEventListener('pointerup', onPointerUp)
			document.removeEventListener('pointercancel', onPointerUp)
			document.removeEventListener('pointermove', onPointerMove)
		}
	}, [grabbed, ref.current])

	return (
		<div className="segment-timeline__zoom-area__controls" ref={ref}>
			<div
				className="segment-timeline__zoom-area__controls__selected-area"
				style={{
					left: Math.max((scrollLeft / maxScrollLeft) * 100, 0).toString() + '%',
				}}
				onPointerDown={onPointerDown}
			>
				<LeftArrow className="segment-timeline__zoom-area__controls__selected-area__left-arrow" />
				<div className="segment-timeline__zoom-area__controls__selected-area__center-handle"></div>
				<RightArrow className="segment-timeline__zoom-area__controls__selected-area__right-arrow" />
			</div>
		</div>
	)
}
