import React, { useCallback, useMemo } from 'react'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTranslation } from 'react-i18next'
import {
	OverrideOpHelper,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
} from '../../util/OverrideOpHelper.js'
import { faCheck, faPencilAlt, faSync, faTrash, faSave, faBan } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { JSONBlob, JSONBlobParse, JSONSchema } from '@sofie-automation/blueprints-integration'
import { DropdownInputControl, DropdownInputOption } from '../../../../lib/Components/DropdownInput.js'
import { useToggleExpandHelper } from '../../../util/useToggleExpandHelper.js'
import { doModalDialog } from '../../../../lib/ModalDialog.js'
import classNames from 'classnames'
import { SubdeviceManifest } from '@sofie-automation/corelib/dist/deviceConfig'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { TextInputControl } from '../../../../lib/Components/TextInput.js'
import { SchemaFormWithOverrides } from '../../../../lib/forms/SchemaFormWithOverrides.js'
import { LabelActual, LabelAndOverridesForDropdown } from '../../../../lib/Components/LabelAndOverrides.js'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'

interface PeripheralDeviceTranslated {
	_id: PeripheralDeviceId
	name: string
	subdeviceConfigSchema: JSONBlob<JSONSchema> | undefined
	subdeviceManifest: SubdeviceManifest
}

export interface SubDevicesTableProps {
	subDevices: WrappedOverridableItem<any>[]
	overrideHelper: OverrideOpHelper
	instantSaveOverrideHelper: OverrideOpHelper
	peripheralDevices: PeripheralDevice[]
	hasUnsavedChanges: boolean
	saveChanges: () => void
	discardChanges: () => void
	updateObjectId: (oldId: string, newId: string) => void
	updatedIds: Map<string, string>
}
export function GenericSubDevicesTable({
	subDevices,
	overrideHelper,
	peripheralDevices,
	hasUnsavedChanges,
	instantSaveOverrideHelper,
	saveChanges,
	discardChanges,
	updateObjectId,
	updatedIds,
}: Readonly<SubDevicesTableProps>): JSX.Element {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const peripheralDevicesMap = useMemo(() => {
		const devicesMap = new Map<PeripheralDeviceId, PeripheralDeviceTranslated>()

		for (const device of peripheralDevices) {
			devicesMap.set(
				device._id,
				literal<PeripheralDeviceTranslated>({
					_id: device._id,
					name: device.studioAndConfigId?.configId || device.name || unprotectString(device._id),
					subdeviceConfigSchema: device.configManifest?.subdeviceConfigSchema,
					subdeviceManifest: device.configManifest?.subdeviceManifest ?? {},
				})
			)
		}

		return devicesMap
	}, [peripheralDevices])
	const confirmRemove = useCallback(
		(subdeviceId: string) => {
			doModalDialog({
				title: t('Remove this device?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					instantSaveOverrideHelper().deleteItem(subdeviceId).commit()
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to remove {{type}} "{{deviceId}}"?', {
								type: 'device',
								deviceId: subdeviceId,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		},
		[t, instantSaveOverrideHelper]
	)

	const peripheralDeviceOptions = useMemo(() => {
		const options: DropdownInputOption<PeripheralDeviceId | undefined>[] = [
			{
				value: undefined,
				name: 'Unassigned',
				i: 0,
			},
		]

		for (const device of peripheralDevicesMap.values()) {
			options.push({
				value: device._id,
				name: device.name || unprotectString(device._id),
				i: options.length,
			})
		}

		return options
	}, [peripheralDevicesMap])

	const undeleteItemWithId = useCallback(
		(itemId: string) => overrideHelper().resetItem(itemId).commit(),
		[overrideHelper]
	)

	return (
		<table className="expando settings-studio-device-table table">
			<thead>
				<tr className="hl">
					<th key="ID">ID</th>
					<th key="Parent">{t('Parent Config ID')}</th>
					<th key="Type">{t('Type')}</th>
					<th key="action">&nbsp;</th>
				</tr>
			</thead>
			<tbody>
				{subDevices.map((item) => {
					if (item.type === 'deleted') {
						const peripheralDevice =
							item.defaults.peripheralDeviceId && peripheralDevicesMap.get(item.defaults.peripheralDeviceId)
						return (
							<DeletedSummaryRow
								key={item.id}
								item={item}
								peripheralDevice={peripheralDevice}
								undeleteItemWithId={undeleteItemWithId}
							/>
						)
					} else {
						const peripheralDevice =
							item.computed.peripheralDeviceId && peripheralDevicesMap.get(item.computed.peripheralDeviceId)

						return (
							<React.Fragment key={item.id}>
								<SummaryRow
									item={item}
									peripheralDevice={peripheralDevice}
									isEdited={isExpanded(item.id)}
									editItemWithId={toggleExpanded}
									removeItemWithId={confirmRemove}
									updatedIds={updatedIds}
								/>
								{isExpanded(item.id) && (
									<SubDeviceEditRow
										peripheralDevice={peripheralDevice}
										peripheralDeviceOptions={peripheralDeviceOptions}
										editItemWithId={toggleExpanded}
										item={item}
										overrideHelper={overrideHelper}
										hasUnsavedChanges={hasUnsavedChanges}
										saveChanges={saveChanges}
										discardChanges={discardChanges}
										updateObjectId={updateObjectId}
										updatedIds={updatedIds}
									/>
								)}
							</React.Fragment>
						)
					}
				})}
			</tbody>
		</table>
	)
}

interface SummaryRowProps {
	item: WrappedOverridableItemNormal<any>
	peripheralDevice: PeripheralDeviceTranslated | undefined
	isEdited: boolean
	editItemWithId: (itemId: string) => void
	removeItemWithId: (itemId: string) => void
	updatedIds: Map<string, string>
}
function SummaryRow({
	item,
	peripheralDevice,
	isEdited,
	editItemWithId,
	removeItemWithId,
	updatedIds,
}: Readonly<SummaryRowProps>): JSX.Element {
	const editItem = useCallback(() => editItemWithId(item.id), [editItemWithId, item.id])
	const removeItem = useCallback(() => removeItemWithId(item.id), [removeItemWithId, item.id])

	const deviceType = peripheralDevice
		? (peripheralDevice.subdeviceManifest?.[item.computed.options.type]?.displayName ?? '-')
		: '-'

	const idChanged = Array.from(updatedIds?.entries() || []).some(([key, value]) => value === item.id || key === item.id)

	return (
		<tr
			className={classNames({
				hl: isEdited,
			})}
		>
			<th className="settings-studio-device__name c2">
				{item.id} {idChanged && '(pending save)'}
			</th>

			<th className="settings-studio-device__parent c2">
				{peripheralDevice?.name || item.computed.peripheralDeviceId || '-'}
			</th>

			<th className="settings-studio-device__type c2">{deviceType}</th>

			<td className="settings-studio-device__actions table-item-actions c1" key="action">
				<button className="action-btn" onClick={editItem}>
					<FontAwesomeIcon icon={faPencilAlt} />
				</button>
				<button className="action-btn" onClick={removeItem}>
					<FontAwesomeIcon icon={faTrash} />
				</button>
			</td>
		</tr>
	)
}

interface DeletedSummaryRowProps {
	item: WrappedOverridableItemDeleted<any>
	peripheralDevice: PeripheralDeviceTranslated | undefined
	undeleteItemWithId: (itemId: string) => void
}
function DeletedSummaryRow({
	item,
	peripheralDevice,
	undeleteItemWithId,
}: Readonly<DeletedSummaryRowProps>): JSX.Element {
	const undeleteItem = useCallback(() => undeleteItemWithId(item.id), [undeleteItemWithId, item.id])

	const deviceType = peripheralDevice
		? (peripheralDevice.subdeviceManifest[item.defaults.options.type]?.displayName ?? '-')
		: '-'

	return (
		<tr>
			<th className="settings-studio-device__name c2 deleted">{item.id}</th>

			<th className="settings-studio-device__parent c2 deleted">
				{peripheralDevice?.name || item.defaults.peripheralDeviceId || '-'}
			</th>

			<th className="settings-studio-device__type c2 deleted">{deviceType}</th>

			<td className="settings-studio-device__actions table-item-actions c1" key="action">
				<button className="action-btn" onClick={undeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}

interface SubDeviceEditRowProps {
	peripheralDevice: PeripheralDeviceTranslated | undefined
	peripheralDeviceOptions: DropdownInputOption<PeripheralDeviceId | undefined>[]
	editItemWithId: (subdeviceId: string, forceState?: boolean) => void
	item: WrappedOverridableItemNormal<any>
	overrideHelper: OverrideOpHelper
	hasUnsavedChanges: boolean
	saveChanges: () => void
	discardChanges: () => void
	updateObjectId: (oldId: string, newId: string) => void
	updatedIds: Map<string, string>
}
function SubDeviceEditRow({
	peripheralDevice,
	peripheralDeviceOptions,
	editItemWithId,
	item,
	overrideHelper,
	hasUnsavedChanges,
	saveChanges,
	discardChanges,
	updateObjectId,
	updatedIds,
}: Readonly<SubDeviceEditRowProps>) {
	const { t } = useTranslation()

	const finishEditItem = useCallback(() => editItemWithId(item.id, false), [editItemWithId, item.id])

	const handleUpdateId = useCallback(
		(newId: string) => {
			updateObjectId(item.id, newId)

			// toggle ui visibility
			editItemWithId(item.id, false)
			editItemWithId(newId, true)
		},
		[item.id, updateObjectId]
	)

	const idToShowInInput = updatedIds?.get(item.id) || item.id

	return (
		<tr className="expando-details hl" key={item.id + '-details'}>
			<td colSpan={99}>
				<div className="properties-grid">
					<LabelAndOverridesForDropdown
						label={t('Parent Config ID')}
						item={item}
						overrideHelper={overrideHelper}
						itemKey={'peripheralDeviceId'}
						options={peripheralDeviceOptions}
					>
						{(value, handleUpdate, options) => (
							<DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
						)}
					</LabelAndOverridesForDropdown>
					<label className="field">
						<LabelActual label={t('Device ID')} />
						<TextInputControl value={idToShowInInput} handleUpdate={handleUpdateId} disabled={!!item.defaults} />
					</label>

					{!item.computed.peripheralDeviceId && (
						<p>{t('This must be assigned to a device to be able to edit the settings')}</p>
					)}

					{!peripheralDevice && item.computed.peripheralDeviceId && <p>{t('Parent device is missing')}</p>}

					{peripheralDevice && (
						<SubDeviceEditForm peripheralDevice={peripheralDevice} item={item} overrideHelper={overrideHelper} />
					)}
				</div>
				<div className="m-1 me-2 text-end">
					{hasUnsavedChanges ? (
						<>
							<button className="btn btn-warning ms-2" onClick={discardChanges}>
								<FontAwesomeIcon icon={faBan} />
								&nbsp;{t('Discard')}
							</button>

							<button className="btn btn-primary ms-2" onClick={saveChanges}>
								<FontAwesomeIcon icon={faSave} />
								&nbsp;{t('Save')}
							</button>
						</>
					) : (
						<button className={classNames('btn btn-primary')} onClick={finishEditItem}>
							<FontAwesomeIcon icon={faCheck} />
						</button>
					)}
				</div>
			</td>
		</tr>
	)
}

interface SubDeviceEditFormProps {
	peripheralDevice: PeripheralDeviceTranslated
	item: WrappedOverridableItemNormal<any>
	overrideHelper: OverrideOpHelper
}
function SubDeviceEditForm({ peripheralDevice, item, overrideHelper }: Readonly<SubDeviceEditFormProps>) {
	const { t } = useTranslation()

	const parsedCommonSchema = useMemo((): JSONSchema | undefined => {
		if (peripheralDevice?.subdeviceConfigSchema) {
			return JSONBlobParse(peripheralDevice.subdeviceConfigSchema)
		}

		return undefined
	}, [peripheralDevice, item.computed.options.type])

	const parsedSchema = useMemo((): JSONSchema | undefined => {
		if (peripheralDevice) {
			const subdeviceManifest = peripheralDevice.subdeviceManifest[item.computed.options.type]
			if (subdeviceManifest) {
				return JSONBlobParse(subdeviceManifest.configSchema)
			}
		}

		return undefined
	}, [peripheralDevice, item.computed.options.type])

	const subdeviceTypeOptions = useMemo((): DropdownInputOption<unknown>[] => {
		const options: DropdownInputOption<unknown>[] = []

		for (const [id, info] of Object.entries<SubdeviceManifest[0]>(peripheralDevice.subdeviceManifest)) {
			options.push({
				name: info.displayName,
				value: id + '',
				i: options.length,
			})
		}

		return options
	}, [peripheralDevice])

	const translationNamespaces = useMemo(() => ['peripheralDevice_' + peripheralDevice._id], [peripheralDevice._id])

	return (
		<>
			{(subdeviceTypeOptions.length > 1 || !parsedSchema) && (
				<LabelAndOverridesForDropdown
					label={t('Device Type')}
					item={item}
					overrideHelper={overrideHelper}
					itemKey={'options.type'}
					options={subdeviceTypeOptions}
				>
					{(value, handleUpdate, options) => (
						<DropdownInputControl options={options} value={value + ''} handleUpdate={handleUpdate} />
					)}
				</LabelAndOverridesForDropdown>
			)}

			{parsedCommonSchema && (
				<SchemaFormWithOverrides
					schema={parsedCommonSchema}
					attr={'options'}
					item={item}
					overrideHelper={overrideHelper}
					translationNamespaces={translationNamespaces}
					allowTables
					isRequired
				/>
			)}

			{parsedSchema ? (
				<SchemaFormWithOverrides
					schema={parsedSchema}
					attr={'options.options'}
					item={item}
					overrideHelper={overrideHelper}
					translationNamespaces={translationNamespaces}
					allowTables
					isRequired
				/>
			) : (
				<p>{t('Device is of unknown type')}</p>
			)}
		</>
	)
}
