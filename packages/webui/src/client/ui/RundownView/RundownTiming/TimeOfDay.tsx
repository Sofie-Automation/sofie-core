import Moment from 'react-moment'
import classNames from 'classnames'
import { useTimingNow } from './usePlaylistTimingValue.js'

export function TimeOfDay({ className }: Readonly<{ className?: string }>): JSX.Element {
	const now = useTimingNow()

	return (
		<span className={classNames('timing-clock time-now', className)}>
			<span className="countdown__value">
				<Moment interval={0} format="HH:mm:ss" date={now} />
			</span>
		</span>
	)
}
