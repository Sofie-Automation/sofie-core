import { NoticeLevel } from '../notifications/notifications.js'
import { CriticalIconSmall, WarningIconSmall } from './icons/notifications.js'

export interface IProps {
	noticeLevel: NoticeLevel
}

export function PieceStatusIcon(props: Readonly<IProps>): JSX.Element {
	return (
		<div className="piece__status-icon">
			{props.noticeLevel === NoticeLevel.CRITICAL ? (
				<CriticalIconSmall />
			) : props.noticeLevel === NoticeLevel.WARNING ? (
				<WarningIconSmall />
			) : null}
		</div>
	)
}
