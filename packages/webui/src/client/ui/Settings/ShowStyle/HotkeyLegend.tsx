import React, { useCallback } from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faPlus, faDownload, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { HotkeyDefinition } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { literal, getRandomString } from '@sofie-automation/corelib/dist/lib'
import { useTranslation } from 'react-i18next'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { EditAttribute } from '../../../lib/EditAttribute.js'
import { hotkeyHelper } from '../../../lib/hotkeyHelper.js'
import { NotificationCenter, NoticeLevel, Notification } from '../../../lib/notifications/notifications.js'
import { UploadButton } from '../../../lib/uploadButton.js'
import { ShowStyleBases } from '../../../collections/index.js'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides.js'
import Button from 'react-bootstrap/esm/Button'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { useToggleExpandHelper } from '../../util/useToggleExpandHelper.js'

interface IHotkeyLegendSettingsProps {
	showStyleBase: DBShowStyleBase
}

export function HotkeyLegendSettings({ showStyleBase }: IHotkeyLegendSettingsProps): JSX.Element {
	const { t } = useTranslation()

	const onAddHotkeyLegend = useCallback(() => {
		const newItem = literal<HotkeyDefinition>({
			_id: getRandomString(),
			key: '',
			label: 'New hotkey',
		})

		ShowStyleBases.update(showStyleBase._id, {
			$push: {
				hotkeyLegend: newItem,
			},
		})
	}, [showStyleBase._id])

	const exportHotkeyJSON = useCallback(() => {
		if (!showStyleBase.hotkeyLegend) return

		const jsonStr = JSON.stringify(showStyleBase.hotkeyLegend, undefined, 4)

		const element = document.createElement('a')
		const url = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }))
		element.href = url
		element.download = `${showStyleBase._id}_${showStyleBase.name.replace(/\W/g, '_')}_hotkeys.json`

		document.body.appendChild(element) // Required for this to work in FireFox
		element.click()
		document.body.removeChild(element) // Required for this to work in FireFox

		URL.revokeObjectURL(url)
	}, [showStyleBase._id, showStyleBase.hotkeyLegend, showStyleBase.name])

	const onDeleteHotkeyLegend = useCallback(
		(item: HotkeyDefinition) => {
			ShowStyleBases.update(showStyleBase._id, {
				$pull: {
					hotkeyLegend: {
						_id: item._id,
					},
				},
			})
		},
		[showStyleBase._id]
	)

	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	return (
		<div>
			<h2 className="mb-4">{t('Custom Hotkey Labels')}</h2>
			<table className="expando settings-studio-custom-config-table">
				<tbody>
					{(showStyleBase.hotkeyLegend || []).map((item, index) => {
						return (
							<React.Fragment key={item._id}>
								<tr
									className={ClassNames({
										hl: isExpanded(item._id),
									})}
								>
									<th className="settings-studio-custom-config-table__name c2">
										{hotkeyHelper.shortcutLabel(item.key)}
									</th>
									<td className="settings-studio-custom-config-table__value c3">{item.label}</td>

									<td className="settings-studio-custom-config-table__actions table-item-actions c3">
										<button className="action-btn" onClick={() => toggleExpanded(item._id)}>
											<FontAwesomeIcon icon={faPencilAlt} />
										</button>
										<button className="action-btn" onClick={() => onDeleteHotkeyLegend?.(item)}>
											<FontAwesomeIcon icon={faTrash} />
										</button>
									</td>
								</tr>
								{isExpanded(item._id) && (
									<tr className="expando-details hl">
										<td colSpan={4}>
											<div className="properties-grid">
												<label className="field">
													<LabelActual label={t('Key')} />
													<EditAttribute
														attribute={'hotkeyLegend.' + index + '.key'}
														obj={showStyleBase}
														type="text"
														collection={ShowStyleBases}
													></EditAttribute>
												</label>
												<label className="field">
													<LabelActual label={t('Value')} />
													<EditAttribute
														attribute={'hotkeyLegend.' + index + '.label'}
														obj={showStyleBase}
														type="text"
														collection={ShowStyleBases}
													></EditAttribute>
												</label>
											</div>
											<div className="m-1 me-2 text-end">
												<Button variant="primary" onClick={() => toggleExpanded(item._id, false)}>
													<FontAwesomeIcon icon={faCheck} />
												</Button>
											</div>
										</td>
									</tr>
								)}
							</React.Fragment>
						)
					})}
				</tbody>
			</table>
			<div className="my-1 mx-2">
				<Button variant="primary" className="mx-1" onClick={onAddHotkeyLegend}>
					<FontAwesomeIcon icon={faPlus} />
				</Button>

				<Button
					variant="outline-secondary"
					className="mx-1"
					onClick={exportHotkeyJSON}
					disabled={!showStyleBase.hotkeyLegend || showStyleBase.hotkeyLegend.length === 0}
				>
					<FontAwesomeIcon icon={faDownload} />
					<span>{t('Export')}</span>
				</Button>
				<ImportHotkeyLegendButton showStyleBaseId={showStyleBase._id} />
			</div>
		</div>
	)
}

function ImportHotkeyLegendButton({ showStyleBaseId }: { showStyleBaseId: ShowStyleBaseId }) {
	const { t } = useTranslation()
	const importHotKeyJSON = useCallback(
		(uploadFileContents: string) => {
			// Parse the config
			const newConfig: Array<HotkeyDefinition> = JSON.parse(uploadFileContents)
			if (!Array.isArray(newConfig)) {
				throw new Error('Not an array')
			}

			// Validate the config
			const conformedConfig: Array<HotkeyDefinition> = []
			for (const entry of newConfig) {
				const newEntry: HotkeyDefinition = {
					_id: getRandomString(),
					key: entry.key || '',
					label: entry.label || '',
					sourceLayerType: entry.sourceLayerType,
					platformKey: entry.platformKey,
					buttonColor: entry.buttonColor,
				}
				conformedConfig.push(newEntry)
			}

			ShowStyleBases.update({ _id: showStyleBaseId }, { $set: { hotkeyLegend: conformedConfig } })
		},
		[t, showStyleBaseId]
	)

	const importError = useCallback(
		(err: Error) => {
			NotificationCenter.push(
				new Notification(
					undefined,
					NoticeLevel.WARNING,
					t('Failed to update config: {{errorMessage}}', { errorMessage: stringifyError(err) }),
					'ConfigManifestSettings'
				)
			)
		},
		[t]
	)

	return (
		<UploadButton
			className="btn btn-outline-secondary mx-1"
			accept="application/json,.json"
			onUploadContents={importHotKeyJSON}
			onUploadError={importError}
		>
			<FontAwesomeIcon icon={faUpload} />
			<span>{t('Import')}</span>
		</UploadButton>
	)
}
