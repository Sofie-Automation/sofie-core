import { TSR } from '@sofie-automation/blueprints-integration'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { isTranslatableMessage, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { DEFAULT_TSR_ACTION_TIMEOUT_TIME } from '@sofie-automation/shared-lib/dist/core/constants'
import { PeripheralDeviceType } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import React, { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PeripheralDevices } from '../../collections'
import { callPeripheralDeviceAction } from '../../lib/clientAPI'
import { doModalDialog } from '../../lib/ModalDialog'
import { NotificationCenter, NoticeLevel, Notification } from '../../lib/notifications/notifications'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { i18nTranslator } from '../i18n'

export const CasparCGRestartButtons = memo(function CasparCGRestartButtons({ studioId }: { studioId: StudioId }) {
	const { t } = useTranslation()

	const casparCGPlayoutDevices = useTracker(
		() =>
			PeripheralDevices.find({
				parentDeviceId: {
					$in: PeripheralDevices.find({
						'studioAndConfigId.studioId': studioId,
					})
						.fetch()
						.map((i) => i._id),
				},
				type: PeripheralDeviceType.PLAYOUT,
				subType: TSR.DeviceType.CASPARCG,
			}).fetch(),
		[studioId],
		[]
	)

	const onRestartCasparCG = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>, device: PeripheralDevice) => {
			e.persist()

			doModalDialog({
				title: t('Restart CasparCG Server'),
				message: t('Do you want to restart CasparCG Server "{{device}}"?', { device: device.name }),
				onAccept: () => {
					callPeripheralDeviceAction(e, device._id, DEFAULT_TSR_ACTION_TIMEOUT_TIME, TSR.CasparCGActions.RestartServer)
						.then((r) => {
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
									t('CasparCG on device "{{deviceName}}" restarting...', { deviceName: device.name }),
									'SystemStatus'
								)
							)
						})
						.catch((err) => {
							NotificationCenter.push(
								new Notification(
									undefined,
									NoticeLevel.WARNING,
									t('Failed to restart CasparCG on device: "{{deviceName}}": {{errorMessage}}', {
										deviceName: device.name,
										errorMessage: err + '',
									}),
									'SystemStatus'
								)
							)
						})
				},
			})
		},
		[t]
	)

	return (
		<>
			{casparCGPlayoutDevices.map((i) => (
				<React.Fragment key={unprotectString(i._id)}>
					<button className="btn btn-secondary" onClick={(e) => onRestartCasparCG(e, i)}>
						{t('Restart {{device}}', { device: i.name })}
					</button>
					<hr />
				</React.Fragment>
			))}
		</>
	)
})
