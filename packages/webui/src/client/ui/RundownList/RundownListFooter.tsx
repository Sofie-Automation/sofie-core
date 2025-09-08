import { useEffect, useState } from 'react'
import Tooltip from 'rc-tooltip'
import { getHelpMode } from '../../lib/localStorage.js'
import { StatusResponse } from '@sofie-automation/meteor-lib/dist/api/systemStatus'
import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib.js'
import { useTranslation } from 'react-i18next'
import { MeteorCall } from '../../lib/meteorApi.js'
import { NoticeLevel, Notification, NotificationCenter } from '../../lib/notifications/notifications.js'
import { APP_VERSION_EXTENDED } from '../../lib/Settings.js'

export function RundownListFooter(): JSX.Element {
	const { t } = useTranslation()

	const [systemStatus, setSystemStatus] = useState<StatusResponse | null>(null)
	useEffect(() => {
		const refreshSystemStatus = () => {
			MeteorCall.systemStatus
				.getSystemStatus()
				.then((systemStatus: StatusResponse) => {
					setSystemStatus(systemStatus)
				})
				.catch(() => {
					setSystemStatus(null)
					NotificationCenter.push(
						new Notification(
							'systemStatus_failed',
							NoticeLevel.CRITICAL,
							t('Could not get system status. Please consult system administrator.'),
							'RundownList'
						)
					)
				})
		}

		refreshSystemStatus()
		const interval = setInterval(() => refreshSystemStatus, 5000)

		return () => {
			clearInterval(interval)
		}
	}, [])

	const version = __APP_VERSION__ || 'UNSTABLE'
	const versionExtended = APP_VERSION_EXTENDED || version

	return (
		<div className="mt-5 mx-5 version-info">
			<p>
				{t('Sofie Automation')} {t('version')}:&nbsp;
				<Tooltip overlay={versionExtended} placement="top" mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}>
					<span>{version}</span>
				</Tooltip>
			</p>
			<div>
				{systemStatus ? (
					<>
						<div>
							{t('System Status')}:&nbsp;
							<Tooltip
								overlay={t('System has issues which need to be resolved')}
								mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
								visible={systemStatus.status === 'FAIL' && getHelpMode()}
								placement="top"
							>
								<span>{systemStatus.status}</span>
							</Tooltip>
							&nbsp;/&nbsp;{systemStatus._internal.statusCodeString}
						</div>
						{systemStatus._internal.messages.length ? (
							<div>
								{t('Status Messages:')}
								<ul>
									{systemStatus._internal.messages.map((message, i) => {
										return <li key={i}>{message}</li>
									})}
								</ul>
							</div>
						) : null}
					</>
				) : null}
			</div>
		</div>
	)
}
