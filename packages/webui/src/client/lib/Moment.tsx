import Moment, { MomentProps } from 'react-moment'
import moment from 'moment'
import { useCurrentTime } from './lib'

/**
 * Use instead of <Moment fromNow></Moment>, its result is synced with getCurrentTime()
 * @param args same as for Moment
 */
export function MomentFromNow(args: MomentProps): JSX.Element {
	const time = useCurrentTime(60000)

	return <Moment {...args} from={moment(time)} interval={0}></Moment>
}
