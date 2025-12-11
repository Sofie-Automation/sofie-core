import React from 'react'
import { useTranslation } from 'react-i18next'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { ReactNotification } from '../../lib/notifications/ReactNotification.js'
import { ToolTipStep } from '../RundownList.js'
import { NotificationAction } from '../../lib/notifications/notifications.js'

export interface IRegisterHelpProps {
	step: ToolTipStep
}

export function RegisterHelp({ step }: Readonly<IRegisterHelpProps>): JSX.Element {
	const { t } = useTranslation()

	return (
		<React.Fragment>
			{step === ToolTipStep.TOOLTIP_START_HERE ? (
				<ReactNotification
					actions={[
						literal<NotificationAction>({
							label: 'Enable',
							action: () => {
								window.location.assign('/?configure=1')
							},
							type: 'button',
						}),
					]}
				>
					{t('Enable configuration mode by adding ?configure=1 to the address bar.')}
				</ReactNotification>
			) : undefined}
			{step === ToolTipStep.TOOLTIP_START_HERE || step === ToolTipStep.TOOLTIP_RUN_MIGRATIONS ? (
				<ReactNotification
					actions={[
						literal<NotificationAction>({
							label: 'Go to migrations',
							action: () => {
								window.location.assign('/settings/tools/migration')
							},
							type: 'button',
						}),
					]}
				>
					{t('You need to run migrations to set the system up for operation.')}
				</ReactNotification>
			) : undefined}
		</React.Fragment>
	)
}
