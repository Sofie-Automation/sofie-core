import classNames from 'classnames'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

function widthInBase(pieceMaxDuration: number, timelineBase: number): number {
	const size = Math.min(1, pieceMaxDuration / timelineBase)
	return size * 100
}

export function PartAutoNextMarker({
	partDuration,
	timelineBase,
}: Readonly<{
	partDuration: number
	timelineBase: number
}>): JSX.Element {
	const { t } = useTranslation()

	const style = useMemo<React.CSSProperties>(
		() => ({
			left: `${widthInBase(partDuration, timelineBase)}%`,
		}),
		[partDuration, timelineBase]
	)

	return (
		<div className={classNames('segment-opl__part-auto-next-marker')} style={style}>
			<div className="segment-opl__timeline-flag__label">{t('Auto')}</div>
		</div>
	)
}
