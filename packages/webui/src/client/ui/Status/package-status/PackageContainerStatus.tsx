import React from 'react'
import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'
import ClassNames from 'classnames'
import { PackageContainerStatusDB } from '@sofie-automation/corelib/dist/dataModel/PackageContainerStatus'
import { StatusCodePill } from '../StatusCodePill.js'
import { doUserAction, UserAction } from '../../../lib/clientUserAction.js'
import { MeteorCall } from '../../../lib/meteorApi.js'
import { ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import Button from 'react-bootstrap/Button'

export const PackageContainerStatus: React.FC<{
	packageContainerStatus: PackageContainerStatusDB
	device: PeripheralDevice | undefined
}> = function PackageContainerStatus({ packageContainerStatus, device }) {
	const { t } = useTranslation()

	function restartPackageContainer(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
		doUserAction(t, e, UserAction.PACKAGE_MANAGER_RESTART_PACKAGE_CONTAINER, (e, ts) =>
			MeteorCall.userAction.packageManagerRestartPackageContainer(
				e,
				ts,
				packageContainerStatus.deviceId,
				packageContainerStatus.containerId
			)
		)
	}

	const offlineReasonMessages: string[] = []
	if (!device) {
		offlineReasonMessages.push(t('Device not found'))
	} else if (!device.connected) {
		offlineReasonMessages.push(t('Package Manager is offline'))
	}

	return (
		<>
			<tr
				className={ClassNames('packageContainer', {
					offline: offlineReasonMessages.length > 0,
				})}
			>
				<td className="indent"></td>
				<td>{packageContainerStatus.containerId}</td>
				<td>
					<StatusCodePill connected={device?.connected || false} statusCode={packageContainerStatus.status.status} />
				</td>
				<td>
					<Tooltip overlay={offlineReasonMessages || packageContainerStatus.status.statusReason.tech} placement="top">
						<span>{offlineReasonMessages || packageContainerStatus.status.statusReason.user}</span>
					</Tooltip>
				</td>
				<td>
					{device?.connected && (
						<>
							<Button variant="outline-secondary" onClick={(e) => restartPackageContainer(e)}>
								{t('Restart Container')}
							</Button>
						</>
					)}
				</td>
			</tr>
			{Object.entries<ExpectedPackageStatusAPI.PackageContainerMonitorStatus>(
				packageContainerStatus.status.monitors
			).map(([monitorId, monitor]) => {
				return (
					<tr className="packageContainer-monitor" key={monitorId}>
						<td className="indent"></td>
						<td>{monitorId}</td>
						<td>
							<StatusCodePill connected={true} statusCode={monitor.status} />
						</td>
						<td>
							<Tooltip overlay={monitor.statusReason.tech} placement="top">
								<span>{monitor.statusReason.user}</span>
							</Tooltip>
						</td>
						<td></td>
					</tr>
				)
			})}
		</>
	)
}
