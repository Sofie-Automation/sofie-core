import React, { useContext } from 'react'
import {
	PeripheralDevice,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { TFunction, useTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getCurrentTime } from '../../../lib/systemTime.js'
import { Link } from 'react-router-dom'
import Tooltip from 'rc-tooltip'
import { faTrash, faEye } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { doModalDialog } from '../../../lib/ModalDialog.js'
import { callPeripheralDeviceAction, PeripheralDevicesAPI } from '../../../lib/clientAPI.js'
import { NotificationCenter, NoticeLevel, Notification } from '../../../lib/notifications/notifications.js'
import { getHelpMode } from '../../../lib/localStorage.js'
import ClassNames from 'classnames'
import { TSR } from '@sofie-automation/blueprints-integration'
import { MeteorCall } from '../../../lib/meteorApi.js'
import { DEFAULT_TSR_ACTION_TIMEOUT_TIME } from '@sofie-automation/shared-lib/dist/core/constants'
import { SubdeviceAction } from '@sofie-automation/shared-lib/dist/core/deviceConfigManifest'
import { StatusCodePill } from '../StatusCodePill.js'
import { isTranslatableMessage, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { i18nTranslator } from '../../i18n.js'
import { SchemaFormInPlace } from '../../../lib/forms/SchemaFormInPlace.js'
import { PeripheralDevices } from '../../../collections/index.js'
import { DebugStateTable } from '../DebugState.js'
import { JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { catchError } from '../../../lib/lib.js'
import { UserPermissionsContext } from '../../UserPermissions.js'
import Button from 'react-bootstrap/Button'

interface IDeviceItemProps {
	parentDevice: PeripheralDevice | null
	device: PeripheralDevice
	showRemoveButtons?: boolean
	hasChildren?: boolean

	debugState: object | undefined
}

export function DeviceItem({
	parentDevice,
	device,
	showRemoveButtons,
	hasChildren,
	debugState,
}: IDeviceItemProps): JSX.Element {
	const { t } = useTranslation()

	const userPermissions = useContext(UserPermissionsContext)

	const namespaces = ['peripheralDevice_' + device._id]

	const configManifest = (parentDevice ?? device)?.configManifest?.subdeviceManifest?.[device.subType]

	return (
		<div key={unprotectString(device._id)} className="device-item">
			<div className="status-container">
				<StatusCodePill
					connected={device.connected}
					statusCode={device?.status.statusCode}
					messages={device?.status.messages}
				/>

				<div className="device-item__last-seen">
					<label>{t('Last seen')}: </label>
					<div className="value">
						<Moment from={getCurrentTime()} date={device.lastSeen} />
					</div>
				</div>
			</div>
			<div className="device-item__id">
				<Tooltip
					overlay={t('Connect some devices to the playout gateway')}
					visible={
						getHelpMode() &&
						device.type === PeripheralDeviceType.PLAYOUT &&
						!parentDevice &&
						!hasChildren &&
						hasChildren !== undefined
					}
					placement="right"
				>
					{userPermissions.configure ? (
						<div className="value">
							<Link to={'/settings/peripheralDevice/' + device._id}>{device.name}</Link>
						</div>
					) : (
						<div className="value">{device.name}</div>
					)}
				</Tooltip>
			</div>
			{device.versions ? (
				<div className="device-item__version">
					<label>{t('Version')}: </label>
					<div className="value">
						<a title={getDeviceVersionsString(device)} href="#">
							{device.versions._process || 'N/A'}
						</a>
					</div>
				</div>
			) : null}

			{debugState ? <DebugStateTable debugState={debugState} /> : null}

			<div className="actions-container">
				<div className="device-item__actions">
					{configManifest?.actions?.map((action) => (
						<React.Fragment key={action.id}>
							<Button
								variant="outline-secondary"
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									onExecuteAction(e, t, device, action)
								}}
							>
								{translateMessage({ key: action.name, namespaces }, i18nTranslator)}
							</Button>
						</React.Fragment>
					))}
					{userPermissions.developer ? (
						<Button
							variant="outline-secondary"
							key="button-ignore"
							className={ClassNames({
								warn: device.ignore,
							})}
							onClick={(e) => {
								e.preventDefault()
								e.stopPropagation()
								onToggleIgnore(device)
							}}
							title={device.ignore ? 'Click to show device status to users' : 'Click to hide device status from users'}
						>
							<FontAwesomeIcon icon={faEye} />
						</Button>
					) : null}
					{showRemoveButtons ? (
						<Button
							variant="primary"
							key="button-device"
							onClick={(e) => {
								e.preventDefault()
								e.stopPropagation()

								doModalDialog({
									title: t('Delete'),
									message: (
										<p>
											{t('Are you sure you want to delete this device: "{{deviceId}}"?', {
												deviceId: device.name || device._id,
											})}
										</p>
									),
									onAccept: () => {
										MeteorCall.peripheralDevice
											.removePeripheralDevice(device._id)
											.catch(catchError('peripheralDevice.removePeripheralDevice'))
									},
								})
							}}
						>
							<FontAwesomeIcon icon={faTrash} />
						</Button>
					) : null}
					{userPermissions.studio && device.subType === PERIPHERAL_SUBTYPE_PROCESS ? (
						<React.Fragment>
							<Button
								variant="outline-secondary"
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									e.persist()

									doModalDialog({
										message: t('Are you sure you want to restart this device?'),
										title: t('Restart this Device?'),
										yes: t('Restart'),
										no: t('Cancel'),
										onAccept: () => {
											PeripheralDevicesAPI.restartDevice(device, e)
												.then(() => {
													NotificationCenter.push(
														new Notification(
															undefined,
															NoticeLevel.NOTIFICATION,
															t('Device "{{deviceName}}" restarting...', {
																deviceName: device.name,
															}),
															'SystemStatus'
														)
													)
												})
												.catch((err) => {
													NotificationCenter.push(
														new Notification(
															undefined,
															NoticeLevel.WARNING,
															t('Failed to restart device: "{{deviceName}}": {{errorMessage}}', {
																deviceName: device.name,
																errorMessage: err + '',
															}),
															'SystemStatus'
														)
													)
												})
										},
									})
								}}
							>
								{t('Restart')}
							</Button>
						</React.Fragment>
					) : null}
				</div>
			</div>

			<div className="clear"></div>
		</div>
	)
}

function getDeviceVersionsString(device: PeripheralDevice): string | undefined {
	const versions = device.versions
	if (!versions) return undefined

	return Object.entries<string>(versions)
		.map((version, packageName) => `${packageName}: ${version}`)
		.join('\n')
}

function onExecuteAction(event: any, t: TFunction, device: PeripheralDevice, action: SubdeviceAction) {
	const namespaces = ['peripheralDevice_' + device._id]

	const processResponse = (r: TSR.ActionExecutionResult) => {
		if (r?.result === TSR.ActionExecutionResultCode.Error) {
			throw new Error(
				r.response && isTranslatableMessage(r.response)
					? translateMessage(r.response, i18nTranslator)
					: t('Unknown error')
			)
		}
		NotificationCenter.push(
			new Notification(
				undefined,
				NoticeLevel.NOTIFICATION,
				r?.response && isTranslatableMessage(r.response)
					? t('Executed {{actionName}} on device "{{deviceName}}": {{response}}', {
							actionName: action.name,
							deviceName: device.name,
							response: translateMessage(r.response, i18nTranslator),
						})
					: t('Executed {{actionName}} on device "{{deviceName}}"...', {
							actionName: action.name,
							deviceName: device.name,
						}),
				'SystemStatus'
			)
		)
	}
	const processError = (err: any) => {
		NotificationCenter.push(
			new Notification(
				undefined,
				NoticeLevel.WARNING,
				t('Failed to execute {{actionName}} on device: "{{deviceName}}": {{errorMessage}}', {
					actionName: action.name,
					deviceName: device.name,
					errorMessage: err,
				}),
				'SystemStatus'
			)
		)
	}

	if (action.destructive || action.payload) {
		const payload = {}
		doModalDialog({
			title: translateMessage({ key: action.name, namespaces }, i18nTranslator),
			yes: t('Execute'),
			no: t('Cancel'),
			message: action.payload ? (
				<SchemaFormInPlace schema={JSONBlobParse(action.payload)} object={payload} translationNamespaces={namespaces} />
			) : (
				t('Do you want to execute {{actionName}}? This may the disrupt the output', { actionName: action.name })
			),
			onAccept: (event: any) => {
				callPeripheralDeviceAction(
					event,
					device._id,
					action.timeout || DEFAULT_TSR_ACTION_TIMEOUT_TIME,
					action.id,
					payload
				)
					.then(processResponse)
					.catch(processError)
			},
		})
	} else {
		callPeripheralDeviceAction(event, device._id, action.timeout || DEFAULT_TSR_ACTION_TIMEOUT_TIME, action.id)
			.then(processResponse)
			.catch(processError)
	}
}

function onToggleIgnore(device: PeripheralDevice): void {
	PeripheralDevices.update(device._id, {
		$set: {
			ignore: !device.ignore,
		},
	})
}
