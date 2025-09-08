import * as React from 'react'
import { withTranslation } from 'react-i18next'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { Translated } from '../../../lib/ReactMeteorData/react-meteor-data.js'
import { IngestDeviceSecretSettingsStatus } from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceSettings/ingestDevice'
import { NotificationCenter, Notification, NoticeLevel } from '../../../lib/notifications/notifications.js'
import { fetchFrom } from '../../../lib/lib.js'
import { createPrivateApiPath } from '../../../url.js'

interface IConfigManifestOAuthFlowComponentState {}
interface IConfigManifestOAuthFlowComponentProps {
	device: PeripheralDevice
}
export const ConfigManifestOAuthFlowComponent = withTranslation()(
	class ConfigManifestOAuthFlowComponent extends React.Component<
		Translated<IConfigManifestOAuthFlowComponentProps>,
		IConfigManifestOAuthFlowComponentState
	> {
		constructor(props: Translated<IConfigManifestOAuthFlowComponentProps>) {
			super(props)
			this.state = {}
		}
		onUploadCredentialsFile(e: React.ChangeEvent<HTMLInputElement>) {
			const { t } = this.props

			const file = e.target.files?.[0]
			if (!file) {
				return
			}

			const reader = new FileReader()
			reader.onload = (e2) => {
				// On file upload

				this.setState({
					uploadFileKey: Date.now(),
				})

				const uploadFileContents = (e2.target as any).result

				fetchFrom(createPrivateApiPath(`peripheralDevices/${this.props.device._id}/uploadCredentials`), {
					method: 'POST',
					body: uploadFileContents,
					headers: {
						'content-type': 'application/json',
					},
				})
					.then(() => {
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.NOTIFICATION,
								t('OAuth credentials succesfully uploaded.'),
								'ConfigManifestOAuthFlowComponent'
							)
						)
					})
					.catch((err) => {
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.WARNING,
								t('Failed to upload OAuth credentials: {{errorMessage}}', { errorMessage: err + '' }),
								'ConfigManifestOAuthFlowComponent'
							)
						)
					})
			}
			reader.readAsText(file)
		}

		resetAppCredentials() {
			const { t } = this.props

			fetchFrom(createPrivateApiPath(`peripheralDevices/${this.props.device._id}/resetAppCredentials`), {
				method: 'POST',
			})
				.then(() => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.NOTIFICATION,
							t('OAuth credentials successfuly reset'),
							'ConfigManifestOAuthFlowComponent'
						)
					)
				})
				.catch((err) => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('Failed to reset OAuth credentials: {{errorMessage}}', { errorMessage: err + '' }),
							'ConfigManifestOAuthFlowComponent'
						)
					)
				})
		}

		resetAuth() {
			const { t } = this.props

			fetchFrom(createPrivateApiPath(`peripheralDevices/${this.props.device._id}/resetAuth`), {
				method: 'POST',
			})
				.then(() => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.NOTIFICATION,
							t('OAuth credentials successfuly reset'),
							'ConfigManifestOAuthFlowComponent'
						)
					)
				})
				.catch((err) => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.WARNING,
							t('Failed to reset OAuth credentials: {{errorMessage}}', { errorMessage: err + '' }),
							'ConfigManifestOAuthFlowComponent'
						)
					)
				})
		}

		render(): JSX.Element | null {
			const { t } = this.props
			const secretStatus = (this.props.device.secretSettingsStatus || {}) as IngestDeviceSecretSettingsStatus
			const device = this.props.device

			if (!device.configManifest) return null

			return (
				<div>
					{secretStatus.accessToken ? (
						// If this is set, we have completed the authentication procedure.
						// A reset button is provided to begin the flow again if authorization is revoked by the user.
						<div className="m-2">
							<button className="btn btn-secondary btn-tight me-1" onClick={() => this.resetAppCredentials()}>
								{t('Reset App Credentials')}
							</button>

							<button className="btn btn-secondary btn-tight" onClick={() => this.resetAuth()}>
								{t('Reset User Credentials')}
							</button>
						</div>
					) : (
						<div className="m-2">
							{!secretStatus.credentials ? (
								<label className="field">
									<div className="my-2">{t('Application credentials')}</div>
									<div>
										<div>{t(device.configManifest.deviceOAuthFlow!.credentialsHelp)}</div>
										<div>
											<a href={device.configManifest.deviceOAuthFlow!.credentialsURL} target="_blank" rel="noreferrer">
												{device.configManifest.deviceOAuthFlow!.credentialsURL}
											</a>
										</div>

										<div className="my-2">
											<input
												type="file"
												accept="application/json,.json"
												onChange={(e) => this.onUploadCredentialsFile(e)}
											/>
										</div>
									</div>
								</label>
							) : (
								<label className="field">
									<div>
										<div className="my-2">
											{device.accessTokenUrl ? (
												<a className="btn btn-primary" href={device.accessTokenUrl} target="_blank" rel="noreferrer">
													{t('Authorize App Access')}
												</a>
											) : (
												t('Waiting for gateway to generate URL...')
											)}
										</div>
										<div className="my-2">
											<button className="btn btn-secondary btn-tight" onClick={() => this.resetAppCredentials()}>
												{t('Reset App Credentials')}
											</button>
										</div>
									</div>
								</label>
							)}
						</div>
					)}
				</div>
			)
		}
	}
)
