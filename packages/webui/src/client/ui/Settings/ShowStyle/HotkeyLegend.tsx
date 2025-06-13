import React, { useCallback } from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faPlus, faDownload, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { HotkeyDefinition } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { literal, getRandomString } from '@sofie-automation/corelib/dist/lib'
import { useTranslation, withTranslation } from 'react-i18next'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { EditAttribute } from '../../../lib/EditAttribute.js'
import { hotkeyHelper } from '../../../lib/hotkeyHelper.js'
import { NotificationCenter, NoticeLevel, Notification } from '../../../lib/notifications/notifications.js'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { UploadButton } from '../../../lib/uploadButton.js'
import { ShowStyleBases } from '../../../collections/index.js'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides.js'
import Button from 'react-bootstrap/esm/Button'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

interface IHotkeyLegendSettingsProps {
	showStyleBase: DBShowStyleBase
}
interface IHotkeyLegendSettingsState {
	editedItems: Array<string>
}

export const HotkeyLegendSettings = withTranslation()(
	class HotkeyLegendSettings extends React.Component<
		Translated<IHotkeyLegendSettingsProps>,
		IHotkeyLegendSettingsState
	> {
		constructor(props: Translated<IHotkeyLegendSettingsProps>) {
			super(props)

			this.state = {
				editedItems: [],
			}
		}

		private isItemEdited = (item: HotkeyDefinition) => {
			return this.state.editedItems.indexOf(item._id) >= 0
		}
		private finishEditItem = (item: HotkeyDefinition) => {
			const index = this.state.editedItems.indexOf(item._id)
			if (index >= 0) {
				this.state.editedItems.splice(index, 1)
				this.setState({
					editedItems: this.state.editedItems,
				})
			}
		}

		private editItem = (item: HotkeyDefinition) => {
			if (this.state.editedItems.indexOf(item._id) < 0) {
				this.state.editedItems.push(item._id)
				this.setState({
					editedItems: this.state.editedItems,
				})
			} else {
				this.finishEditItem(item)
			}
		}

		private onDeleteHotkeyLegend = (item: HotkeyDefinition) => {
			if (this.props.showStyleBase) {
				ShowStyleBases.update(this.props.showStyleBase._id, {
					$pull: {
						hotkeyLegend: {
							_id: item._id,
						},
					},
				})
			}
		}
		private onAddHotkeyLegend = () => {
			const newItem = literal<HotkeyDefinition>({
				_id: getRandomString(),
				key: '',
				label: 'New hotkey',
			})

			ShowStyleBases.update(this.props.showStyleBase._id, {
				$push: {
					hotkeyLegend: newItem,
				},
			})
		}

		private exportHotkeyJSON() {
			const jsonStr = JSON.stringify(this.props.showStyleBase.hotkeyLegend, undefined, 4)

			const element = document.createElement('a')
			element.href = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }))
			element.download = `${this.props.showStyleBase._id}_${this.props.showStyleBase.name.replace(
				/\W/g,
				'_'
			)}_hotkeys.json`

			document.body.appendChild(element) // Required for this to work in FireFox
			element.click()
			document.body.removeChild(element) // Required for this to work in FireFox
		}

		private renderItems() {
			const { t } = this.props
			return (this.props.showStyleBase.hotkeyLegend || []).map((item, index) => {
				return (
					<React.Fragment key={item.key}>
						<tr
							className={ClassNames({
								hl: this.isItemEdited(item),
							})}
						>
							<th className="settings-studio-custom-config-table__name c2">{hotkeyHelper.shortcutLabel(item.key)}</th>
							<td className="settings-studio-custom-config-table__value c3">{item.label}</td>

							<td className="settings-studio-custom-config-table__actions table-item-actions c3">
								<button className="action-btn" onClick={() => this.editItem(item)}>
									<FontAwesomeIcon icon={faPencilAlt} />
								</button>
								<button className="action-btn" onClick={() => this.onDeleteHotkeyLegend?.(item)}>
									<FontAwesomeIcon icon={faTrash} />
								</button>
							</td>
						</tr>
						{this.isItemEdited(item) && (
							<tr className="expando-details hl">
								<td colSpan={4}>
									<div className="properties-grid">
										<label className="field">
											<LabelActual label={t('Key')} />
											<EditAttribute
												attribute={'hotkeyLegend.' + index + '.key'}
												obj={this.props.showStyleBase}
												type="text"
												collection={ShowStyleBases}
											></EditAttribute>
										</label>
										<label className="field">
											<LabelActual label={t('Value')} />
											<EditAttribute
												attribute={'hotkeyLegend.' + index + '.label'}
												obj={this.props.showStyleBase}
												type="text"
												collection={ShowStyleBases}
											></EditAttribute>
										</label>
									</div>
									<div className="m-1 me-2 text-end">
										<Button variant="primary" onClick={() => this.finishEditItem(item)}>
											<FontAwesomeIcon icon={faCheck} />
										</Button>
									</div>
								</td>
							</tr>
						)}
					</React.Fragment>
				)
			})
		}

		render(): JSX.Element {
			const { t } = this.props
			return (
				<div>
					<h2 className="mb-4">{t('Custom Hotkey Labels')}</h2>
					<table className="expando settings-studio-custom-config-table">
						<tbody>{this.renderItems()}</tbody>
					</table>
					<div className="my-1 mx-2">
						<Button variant="primary" className="mx-1" onClick={this.onAddHotkeyLegend}>
							<FontAwesomeIcon icon={faPlus} />
						</Button>

						<Button variant="outline-secondary" className="mx-1" onClick={() => this.exportHotkeyJSON()}>
							<FontAwesomeIcon icon={faDownload} />
							<span>{t('Export')}</span>
						</Button>
						<ImportHotkeyLegendButton showStyleBaseId={this.props.showStyleBase._id} />
					</div>
				</div>
			)
		}
	}
)

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
