import { useTranslation } from 'react-i18next'
import { useCurrentTime } from '../../lib/lib.js'

function floorCeil(val: number) {
	return val < 0 ? Math.ceil(val) : Math.floor(val)
}

export function Countdown({
	expectedStart,
	className,
}: Readonly<{
	expectedStart: number
	className?: string | undefined
}>): JSX.Element {
	const { t } = useTranslation()
	const now = useCurrentTime()
	const diff = expectedStart - now

	const days = floorCeil(diff / 86400000)
	const hours = floorCeil((diff % 86400000) / 3600000)
	const minutes = floorCeil((diff % 3600000) / 60000)
	const seconds = floorCeil((diff % 60000) / 1000)

	return (
		<div className={className}>
			{days > 0
				? t('in {{days}} days, {{hours}} h {{minutes}} min {{seconds}} s', { days, hours, minutes, seconds })
				: hours > 0
					? t('in {{hours}} h {{minutes}} min {{seconds}} s', { days, hours, minutes, seconds })
					: minutes > 0
						? t('in {{minutes}} min {{seconds}} s', { days, hours, minutes, seconds })
						: seconds > 0
							? t('in {{seconds}} s', { days, hours, minutes, seconds })
							: days < 0
								? t('{{days}} days, {{hours}} h {{minutes}} min {{seconds}} s ago', {
										days: days * -1,
										hours: hours * -1,
										minutes: minutes * -1,
										seconds: seconds * -1,
									})
								: hours < 0
									? t('{{hours}} h {{minutes}} min {{seconds}} s ago', {
											days: days * -1,
											hours: hours * -1,
											minutes: minutes * -1,
											seconds: seconds * -1,
										})
									: minutes < 0
										? t('{{minutes}} min {{seconds}} s ago', {
												days: days * -1,
												hours: hours * -1,
												minutes: minutes * -1,
												seconds: seconds * -1,
											})
										: seconds <= 0
											? t('{{seconds}} s ago', {
													days: days * -1,
													hours: hours * -1,
													minutes: minutes * -1,
													seconds: seconds * -1,
												})
											: null}
		</div>
	)
}
