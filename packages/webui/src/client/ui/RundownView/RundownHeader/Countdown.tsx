import React from 'react'
import Moment from 'react-moment'
import classNames from 'classnames'
import './Countdown.scss'

const THRESHOLDS = [3600000, 60000, 1] // hours, minutes, seconds

interface IProps {
	label?: string
	time?: number
	className?: string
	children?: React.ReactNode
	ms?: number
	postfix?: React.ReactNode
}

function DimmedValue({ value, ms }: { readonly value: string; readonly ms?: number }): JSX.Element {
	const parts = value.split(':')
	const absDiff = ms !== undefined ? Math.abs(ms) : Infinity
	const isOvertime = /^[+\-\u2013]/.test(value)

	return (
		<>
			{parts.map((p, i) => {
				const offset = 3 - parts.length
				const isDimmed = !isOvertime && absDiff < THRESHOLDS[i + offset] && parseInt(p, 10) === 0
				return (
					<React.Fragment key={`${i}:${p}`}>
						<span className={classNames('countdown__digit', { 'countdown__digit--dimmed': isDimmed })}>{p}</span>
						{i < parts.length - 1 && (
							<span
								className={classNames('countdown__sep', {
									'countdown__sep--dimmed': isDimmed,
								})}
							>
								:
							</span>
						)}
					</React.Fragment>
				)
			})}
		</>
	)
}

function renderContent(time: number | undefined, ms: number | undefined, children: React.ReactNode): React.ReactNode {
	if (time !== undefined) {
		return <Moment interval={0} format="HH:mm:ss" date={time} />
	}
	if (typeof children === 'string') {
		return <DimmedValue value={children} ms={ms} />
	}
	return children
}

export function Countdown({ label, time, className, children, ms, postfix }: IProps): JSX.Element {
	const valueClassName = time === undefined ? 'countdown__counter' : 'countdown__timeofday'

	return (
		<span className={classNames('countdown', className)}>
			{label && <span className="countdown__label">{label}</span>}
			<span className={valueClassName}>
				{renderContent(time, ms, children)}
				{postfix}
			</span>
		</span>
	)
}
