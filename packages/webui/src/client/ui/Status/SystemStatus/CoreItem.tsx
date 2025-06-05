import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { unprotectString } from '../../../lib/tempLib'
import { doModalDialog } from '../../../lib/ModalDialog'
import { NotificationCenter, NoticeLevel, Notification } from '../../../lib/notifications/notifications'
import ClassNames from 'classnames'
import { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { StatusResponse } from '@sofie-automation/meteor-lib/dist/api/systemStatus'
import { doUserAction, UserAction } from '../../../lib/clientUserAction'
import { MeteorCall } from '../../../lib/meteorApi'
import { hashSingleUseToken } from '../../../lib/lib'
import { UserPermissionsContext } from '../../UserPermissions'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'

interface ICoreItemProps {
	systemStatus: StatusResponse | undefined
	coreSystem: ICoreSystem
}

export function CoreItem({ systemStatus, coreSystem }: ICoreItemProps): JSX.Element {
	const { t } = useTranslation()

	const userPermissions = useContext(UserPermissionsContext)

	return (
		<div key={unprotectString(coreSystem._id)} className="device-item">
			<div className="status-container">
				<div
					className={ClassNames(
						'device-status',
						systemStatus &&
							systemStatus.status && {
								'device-status--unknown': systemStatus.status === 'UNDEFINED',
								'device-status--good': systemStatus.status === 'OK',
								'device-status--warning': systemStatus.status === 'WARNING',
								'device-status--fatal': systemStatus.status === 'FAIL',
							}
					)}
				>
					<div className="value">
						<span className="pill device-status__label">
							<a
								href="#"
								title={
									systemStatus && systemStatus._internal.messages
										? systemStatus._internal.messages.join('\n')
										: undefined
								}
							>
								{systemStatus && systemStatus.status}
							</a>
						</span>
					</div>
				</div>
			</div>
			<div className="device-item__id">
				<div className="value">
					{t('Sofie Automation Server Core: {{name}}', { name: coreSystem.name || 'unnamed' })}
				</div>
			</div>
			<div className="device-item__version">
				<label>{t('Version')}: </label>
				<div className="value">{__APP_VERSION__ || 'UNSTABLE'}</div>
			</div>

			{(userPermissions.configure || userPermissions.developer) && (
				<div className="actions-container">
					<div className="device-item__actions">
						<button
							className="btn btn-secondary"
							onClick={(e) => {
								e.preventDefault()
								e.stopPropagation()

								doModalDialog({
									title: t('Restart this system?'),
									yes: t('Restart'),
									no: t('Cancel'),
									message: (
										<p>
											{t('Are you sure you want to restart this Sofie Automation Server Core: {{name}}?', {
												name: coreSystem.name || 'unnamed',
											})}
										</p>
									),
									onAccept: (e) => {
										doUserAction(
											t,
											e,
											UserAction.RESTART_CORE,
											(e, ts) =>
												MeteorCall.system.generateSingleUseToken().then((tokenResponse) => {
													if (ClientAPI.isClientResponseError(tokenResponse) || !tokenResponse.result)
														throw tokenResponse
													return MeteorCall.userAction.restartCore(e, ts, hashSingleUseToken(tokenResponse.result))
												}),
											(err, restartMessage) => {
												if (err || !restartMessage) {
													NotificationCenter.push(
														new Notification(
															undefined,
															NoticeLevel.CRITICAL,
															t('Could not restart core: {{err}}', { err }),
															'SystemStatus'
														)
													)
													return
												}
												let time = 'unknown'
												const match = restartMessage.match(/([\d.]+)s/)
												if (match) {
													time = match[1]
												}
												NotificationCenter.push(
													new Notification(
														undefined,
														NoticeLevel.WARNING,
														t('Sofie Automation Server Core will restart in {{time}}s...', { time }),
														'SystemStatus'
													)
												)
											}
										)
									},
								})
							}}
						>
							{t('Restart')}
						</button>
					</div>
				</div>
			)}

			<div className="clear"></div>
		</div>
	)
}
