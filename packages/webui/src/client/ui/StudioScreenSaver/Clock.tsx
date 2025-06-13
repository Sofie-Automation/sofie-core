import Moment from 'react-moment'
import { useCurrentTime } from '../../lib/lib.js'

export function Clock({ className }: Readonly<{ className?: string | undefined }>): JSX.Element {
	const now = useCurrentTime()

	return (
		<div className={className}>
			<Moment interval={0} format="HH:mm:ss" date={now} />
		</div>
	)
}
