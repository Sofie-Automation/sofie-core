import { useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDatabase, faEye, faWarning } from '@fortawesome/free-solid-svg-icons'
import { MeteorCall } from '../../../lib/meteorApi.js'
import { TFunction, useTranslation } from 'react-i18next'
import { i18nTranslator } from '../../i18n.js'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { doModalDialog } from '../../../lib/ModalDialog.js'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { NotificationCenter, NoticeLevel, Notification } from '../../../lib/notifications/notifications.js'
import {
	UIBlueprintUpgradeStatusBase,
	UIBlueprintUpgradeStatusCoreSystem,
	UIBlueprintUpgradeStatusShowStyle,
	UIBlueprintUpgradeStatusStudio,
} from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { catchError } from '../../../lib/lib.js'
import Button from 'react-bootstrap/esm/Button'

export function getUpgradeStatusMessage(t: TFunction, upgradeResult: UIBlueprintUpgradeStatusBase): string | null {
	if (upgradeResult.invalidReason)
		return `${t('Unable to upgrade')}: ${translateMessage(upgradeResult.invalidReason, i18nTranslator)}`

	if (upgradeResult.changes.length > 0) return t('Upgrade required')

	return null
}

interface UpgradeStatusButtonsProps {
	upgradeResult: UIBlueprintUpgradeStatusStudio | UIBlueprintUpgradeStatusShowStyle
}
export function UpgradeStatusButtons({ upgradeResult }: Readonly<UpgradeStatusButtonsProps>): JSX.Element {
	const { t } = useTranslation()

	const validateConfig = useCallback(async () => {
		switch (upgradeResult.documentType) {
			case 'studio':
				return MeteorCall.migration.validateConfigForStudio(upgradeResult.documentId)
			case 'showStyle':
				return MeteorCall.migration.validateConfigForShowStyleBase(upgradeResult.documentId)
			default:
				assertNever(upgradeResult)
				throw new Error(`Unknown UIBlueprintUpgradeStatusBase documentType`)
		}
	}, [upgradeResult.documentId, upgradeResult.documentType])
	const applyConfig = useCallback(async () => {
		switch (upgradeResult.documentType) {
			case 'studio':
				return MeteorCall.migration.runUpgradeForStudio(upgradeResult.documentId)
			case 'showStyle':
				return MeteorCall.migration.runUpgradeForShowStyleBase(upgradeResult.documentId)
			default:
				assertNever(upgradeResult)
				throw new Error(`Unknown UIBlueprintUpgradeStatusBase documentType`)
		}
	}, [upgradeResult.documentId, upgradeResult.documentType])
	const fixupConfig = useCallback(async () => {
		switch (upgradeResult.documentType) {
			case 'studio':
				return MeteorCall.migration.fixupConfigForStudio(upgradeResult.documentId)
			case 'showStyle':
				return MeteorCall.migration.fixupConfigForShowStyleBase(upgradeResult.documentId)
			default:
				assertNever(upgradeResult)
				throw new Error(`Unknown UIBlueprintUpgradeStatusBase documentType`)
		}
	}, [upgradeResult.documentId, upgradeResult.documentType])
	const ignoreFixupConfig = useCallback(async () => {
		switch (upgradeResult.documentType) {
			case 'studio':
				return MeteorCall.migration.ignoreFixupConfigForStudio(upgradeResult.documentId)
			case 'showStyle':
				return MeteorCall.migration.ignoreFixupConfigForShowStyleBase(upgradeResult.documentId)
			default:
				assertNever(upgradeResult)
				throw new Error(`Unknown UIBlueprintUpgradeStatusBase documentType`)
		}
	}, [upgradeResult.documentId, upgradeResult.documentType])

	const clickValidate = useCallback(() => {
		validateConfig()
			.then((res) => {
				const nonInfoMessagesCount = res.messages.filter((msg) => msg.level !== NoteSeverity.INFO).length

				doModalDialog({
					title: t('Upgrade config for {{name}}', { name: upgradeResult.name }),
					message: (
						<div>
							{res.messages.length === 0 && <p>{t('Config looks good')}</p>}
							{res.messages.map((msg, i) => (
								<p key={i}>
									{NoteSeverity[msg.level]}: {translateMessage(msg.message, i18nTranslator)}
								</p>
							))}
						</div>
					),
					yes: nonInfoMessagesCount === 0 ? t('Apply') : t('Ignore and apply'),
					no: t('Cancel'),
					onAccept: () => {
						applyConfig()
							.then(() => {
								NotificationCenter.push(
									new Notification(
										undefined,
										NoticeLevel.NOTIFICATION,
										t('Config for {{name}} upgraded successfully', { name: upgradeResult.name }),
										'UpgradesView'
									)
								)
							})
							.catch((e) => {
								catchError('Upgrade applyConfig')(e)
								NotificationCenter.push(
									new Notification(
										undefined,
										NoticeLevel.WARNING,
										t('Config for {{name}} upgraded failed', { name: upgradeResult.name }),
										'UpgradesView'
									)
								)
							})
					},
				})
			})
			.catch(() => {
				doModalDialog({
					title: t('Upgrade config for {{name}}', { name: upgradeResult.name }),
					message: t('Failed to validate config'),
					yes: t('Ignore and apply'),
					no: t('Cancel'),
					onAccept: () => {
						applyConfig()
							.then(() => {
								NotificationCenter.push(
									new Notification(
										undefined,
										NoticeLevel.NOTIFICATION,
										t('Config for {{name}} upgraded successfully', { name: upgradeResult.name }),
										'UpgradesView'
									)
								)
							})
							.catch((e) => {
								catchError('Upgrade applyConfig')(e)
								NotificationCenter.push(
									new Notification(
										undefined,
										NoticeLevel.WARNING,
										t('Config for {{name}} upgraded failed', { name: upgradeResult.name }),
										'UpgradesView'
									)
								)
							})
					},
				})
			})
	}, [upgradeResult, validateConfig, applyConfig])

	const clickShowChanges = useCallback(() => {
		doModalDialog({
			title: t('Upgrade config for {{name}}', { name: upgradeResult.name }),
			message: (
				<div>
					{upgradeResult.changes.length === 0 && <p>{t('No changes')}</p>}
					{upgradeResult.changes.map((msg, i) => (
						<p key={i}>{translateMessage(msg, i18nTranslator)}</p>
					))}
				</div>
			),
			acceptOnly: true,
			yes: t('Dismiss'),
			onAccept: () => {
				// Do nothing
			},
		})
	}, [upgradeResult])

	const clickIgnoreFixup = useCallback(() => {
		doModalDialog({
			title: t('Are you sure you want to skip the fix up config step for {{name}}', { name: upgradeResult.name }),
			message: (
				<div>
					<p>{t('This could leave the configuration in a broken state')}</p>
				</div>
			),
			acceptOnly: true,
			yes: t('Confirm'),
			onAccept: () => {
				ignoreFixupConfig()
					.then(() => {
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.NOTIFICATION,
								t('for {{name}} fix skipped successfully', { name: upgradeResult.name }),
								'UpgradesView'
							)
						)
					})
					.catch((e) => {
						catchError('Upgrade applyConfig')(e)
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.WARNING,
								t('Config for {{name}} fix failed', { name: upgradeResult.name }),
								'UpgradesView'
							)
						)
					})
			},
		})
	}, [upgradeResult, ignoreFixupConfig])

	const clickFixup = useCallback(() => {
		fixupConfig()
			.then((messages) => {
				if (messages.length) {
					doModalDialog({
						title: t('Completed with warnings', {}),
						message: (
							<div>
								{' '}
								{messages.map((msg, i) => (
									// TODO - use path?
									<p key={i}>{translateMessage(msg.message, t)}</p>
								))}
							</div>
						),
						acceptOnly: true,
						yes: t('Dismiss'),
						onAccept: () => {
							// Dismiss
						},
					})
				} else {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.NOTIFICATION,
							t('Config for {{name}} fixed successfully', { name: upgradeResult.name }),
							'UpgradesView'
						)
					)
				}
			})
			.catch((e) => {
				catchError('Upgrade fixupConfig')(e)
				NotificationCenter.push(
					new Notification(
						undefined,
						NoticeLevel.WARNING,
						t('Config for {{name}} fix failed', { name: upgradeResult.name }),
						'UpgradesView'
					)
				)
			})
	}, [upgradeResult, fixupConfig])

	if (upgradeResult.pendingRunOfFixupFunction) {
		return (
			<>
				<Button variant="light" className="me-2" onClick={clickFixup} disabled={!!upgradeResult.invalidReason}>
					<FontAwesomeIcon icon={faDatabase} className="me-2" />
					<span>{t('Fix Up Config')}</span>
				</Button>
				<Button variant="light" className="me-2" onClick={clickIgnoreFixup} disabled={!!upgradeResult.invalidReason}>
					<FontAwesomeIcon icon={faWarning} className="me-2" />
					<span>{t('Skip Fix Up Step')}</span>
				</Button>
			</>
		)
	}

	return (
		<>
			<Button
				variant="outline-secondary"
				className="me-2"
				onClick={clickShowChanges}
				disabled={!!upgradeResult.invalidReason || upgradeResult.changes.length === 0}
			>
				<FontAwesomeIcon icon={faEye} className="me-2" />
				<span>{t('Show config changes')}</span>
			</Button>
			<Button
				variant="outline-secondary"
				className="me-2"
				onClick={clickValidate}
				disabled={!!upgradeResult.invalidReason}
			>
				<FontAwesomeIcon icon={faDatabase} className="me-2" />
				<span>{t('Validate and Apply Config')}</span>
			</Button>
		</>
	)
}

interface SystemUpgradeStatusButtonsProps {
	upgradeResult: UIBlueprintUpgradeStatusCoreSystem
}
export function SystemUpgradeStatusButtons({ upgradeResult }: Readonly<SystemUpgradeStatusButtonsProps>): JSX.Element {
	const { t } = useTranslation()

	const applyConfig = useCallback(
		async () => MeteorCall.migration.runUpgradeForCoreSystem(upgradeResult.documentId),
		[upgradeResult.documentId, upgradeResult.documentType]
	)

	const clickApply = useCallback(() => {
		applyConfig()
			.then(() => {
				NotificationCenter.push(
					new Notification(
						undefined,
						NoticeLevel.NOTIFICATION,
						t('Config for {{name}} upgraded successfully', { name: upgradeResult.name }),
						'UpgradesView'
					)
				)
			})
			.catch((e) => {
				catchError('Upgrade applyConfig')(e)
				NotificationCenter.push(
					new Notification(
						undefined,
						NoticeLevel.WARNING,
						t('Config for {{name}} upgraded failed', { name: upgradeResult.name }),
						'UpgradesView'
					)
				)
			})
	}, [upgradeResult, applyConfig])

	const clickShowChanges = useCallback(() => {
		doModalDialog({
			title: t('Upgrade config for {{name}}', { name: upgradeResult.name }),
			message: (
				<div>
					{upgradeResult.changes.length === 0 && <p>{t('No changes')}</p>}
					{upgradeResult.changes.map((msg, i) => (
						<p key={i}>{translateMessage(msg, i18nTranslator)}</p>
					))}
				</div>
			),
			acceptOnly: true,
			yes: t('Dismiss'),
			onAccept: () => {
				// Do nothing
			},
		})
	}, [upgradeResult])

	return (
		<>
			<Button
				variant="outline-secondary"
				className="me-2"
				onClick={clickShowChanges}
				disabled={!!upgradeResult.invalidReason || upgradeResult.changes.length === 0}
			>
				<FontAwesomeIcon icon={faEye} className="me-2" />
				<span>{t('Show config changes')}</span>
			</Button>
			<Button
				variant="outline-secondary"
				className="me-2"
				onClick={clickApply}
				disabled={!!upgradeResult.invalidReason}
			>
				<FontAwesomeIcon icon={faDatabase} className="me-2" />
				<span>{t('Apply Config')}</span>
			</Button>
		</>
	)
}
