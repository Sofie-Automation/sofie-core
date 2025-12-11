import { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { doModalDialog } from '../../../lib/ModalDialog.js'
import { NotificationCenter, NoticeLevel, Notification } from '../../../lib/notifications/notifications.js'
import ClassNames from 'classnames'
import { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { StatusResponse } from '@sofie-automation/meteor-lib/dist/api/systemStatus'
import { doUserAction, UserAction } from '../../../lib/clientUserAction.js'
import { MeteorCall } from '../../../lib/meteorApi.js'
import { hashSingleUseToken } from '../../../lib/lib.js'
import { UserPermissionsContext } from '../../UserPermissions.js'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import Button from 'react-bootstrap/Button'
import { UserError } from '@sofie-automation/corelib/dist/error'

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
								{systemStatus?.status ?? t('Unknown')}
							</a>
						</span>
					</div>
				</div>
			</div>
			<div className="device-item__id">
				<div className="value">
					{!coreSystem.name
						? t('Sofie Automation Server Core')
						: t('Sofie Automation Server Core: {{name}}', { name: coreSystem.name })}
				</div>
			</div>
			<div className="device-item__version">
				<label>{t('Version')}: </label>
				<div className="value">{__APP_VERSION__ || 'UNSTABLE'}</div>
			</div>

			{(userPermissions.configure || userPermissions.developer) && (
				<div className="actions-container">
					<div className="device-item__actions">
						<Button
							variant="outline-secondary"
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
													if (ClientAPI.isClientResponseError(tokenResponse))
														throw UserError.fromSerialized(tokenResponse.error)
													if (!tokenResponse.result) throw new Error('Failed to generate token')
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
						</Button>
					</div>
				</div>
			)}

			<div className="clear"></div>
		</div>
	)
}
