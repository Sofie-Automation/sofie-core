import React, { useMemo } from 'react'

function widthInBase(pieceMaxDuration: number, timelineBase: number): number {
	const size = Math.min(1, pieceMaxDuration / timelineBase)
	return size * 100
}

export function QuickLoopEnd({
	partDuration,
	timelineBase,
}: {
	partDuration: number
	timelineBase: number
}): JSX.Element {
	const style = useMemo<React.CSSProperties>(
		() => ({
			left: `${widthInBase(partDuration, timelineBase)}%`,
		}),
		[partDuration, timelineBase]
	)

	return <div className="segment-opl__take-line__quickloop-end" style={style}></div>
}
