import { TFunction } from 'i18next'
import { DisplayFormattedTimeInner } from './DisplayFormattedTimeInner.js'

interface IDisplayFormattedTimeProps {
	t: TFunction
	/** Timestamp to display */
	displayTimestamp: number
	/** Timestamp of "now", if omitted, defaults to "now" */
	nowTimestamp?: number
}

export function DisplayFormattedTime(props: Readonly<IDisplayFormattedTimeProps>): JSX.Element {
	return <span>{DisplayFormattedTimeInner(props.t, props.displayTimestamp, props.nowTimestamp)}</span>
}
