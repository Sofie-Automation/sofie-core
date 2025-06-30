import classNames from 'classnames'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface IProps {
	isNext: boolean
	autoNext: boolean
	isQuickLoopStart: boolean
}

export const TakeLine: React.FC<IProps> = function TakeLine({ isNext, autoNext, isQuickLoopStart }) {
	const { t } = useTranslation()

	return (
		<div
			className={classNames('segment-opl__timeline-flag', 'segment-opl__take-line', {
				next: isNext,
				auto: autoNext,
				'quickloop-start': isQuickLoopStart,
			})}
		>
			{isNext && (
				<div
					className={classNames('segment-opl__timeline-flag__label', {
						'segment-opl__timeline-flag__label--autonext': autoNext,
					})}
				>
					{autoNext ? t('Auto') : t('Next')}
				</div>
			)}
			{!isNext && autoNext && <div className="segment-opl__timeline-flag__auto">{t('Auto')}</div>}
		</div>
	)
}
