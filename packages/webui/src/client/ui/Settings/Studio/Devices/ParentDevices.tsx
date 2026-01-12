import React, { useCallback, useMemo } from 'react'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTranslation } from 'react-i18next'
import {
	getAllCurrentAndDeletedItemsFromOverrides,
	OverrideOpHelper,
	useOverrideOpHelper,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
} from '../../util/OverrideOpHelper.js'
import { faCheck, faPencilAlt, faPlus, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { JSONBlob, JSONBlobParse, JSONSchema } from '@sofie-automation/blueprints-integration'
import { DropdownInputControl, DropdownInputOption } from '../../../../lib/Components/DropdownInput.js'
import { useToggleExpandHelper } from '../../../util/useToggleExpandHelper.js'
import { doModalDialog } from '../../../../lib/ModalDialog.js'
import classNames from 'classnames'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { SchemaFormWithOverrides } from '../../../../lib/forms/SchemaFormWithOverrides.js'
import { LabelActual, LabelAndOverrides } from '../../../../lib/Components/LabelAndOverrides.js'
import { getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import { StudioDeviceSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	SomeObjectOverrideOp,
	wrapDefaultObject,
	ObjectOverrideSetOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import Tooltip from 'rc-tooltip'
import { PeripheralDevices, Studios } from '../../../../collections/index.js'
import { getHelpMode } from '../../../../lib/localStorage.js'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData.js'
import { TextInputControl } from '../../../../lib/Components/TextInput.js'
import { MomentFromNow } from '../../../../lib/Moment.js'
import { MeteorCall } from '../../../../lib/meteorApi.js'
import { ReadonlyDeep } from 'type-fest'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'

interface StudioParentDevicesProps {
	studioId: StudioId
}
export function StudioParentDevices({ studioId }: Readonly<StudioParentDevicesProps>): JSX.Element {
	const { t } = useTranslation()

	const studio = useTracker(() => Studios.findOne(studioId), [studioId])

	const saveOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			if (studio?._id) {
				Studios.update(studio._id, {
					$set: {
						'peripheralDeviceSettings.deviceSettings.overrides': newOps,
					},
				})
			}
		},
		[studio?._id]
	)

	const deviceSettings = useMemo(
		() =>
			studio?.peripheralDeviceSettings?.deviceSettings ?? wrapDefaultObject<Record<string, StudioDeviceSettings>>({}),
		[studio?.peripheralDeviceSettings?.deviceSettings]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, deviceSettings)

	const wrappedDeviceSettings = useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides<StudioDeviceSettings>(deviceSettings, (a, b) =>
				a[0].localeCompare(b[0])
			),
		[deviceSettings]
	)

	const addNewItem = useCallback(
		(id?: string) => {
			const newId = id ?? getRandomString()
			const newDevice = literal<StudioDeviceSettings>({
				// peripheralDeviceId: undefined,
				name: 'New Device',
				options: {},
			})

			const addOp = literal<ObjectOverrideSetOp>({
				op: 'set',
				path: newId,
				value: newDevice,
			})

			Studios.update(studioId, {
				$push: {
					'peripheralDeviceSettings.deviceSettings.overrides': addOp,
				},
			})
		},
		[studioId]
	)
	const addNewItemClick = useCallback(() => addNewItem(), [studioId])

	const hasCurrentDevice = wrappedDeviceSettings.find((d) => d.type === 'normal')

	return (
		<div className="mb-4">
			<h2 className="mb-2">
				<Tooltip
					overlay={t('No gateways are configured')}
					visible={getHelpMode() && !hasCurrentDevice}
					placement="right"
				>
					<span>{t('Parent Devices')}</span>
				</Tooltip>
			</h2>

			<GenericParentDevicesTable
				studioId={studioId}
				devices={wrappedDeviceSettings}
				overrideHelper={overrideHelper}
				createItemWithId={addNewItem}
			/>

			<div className="my-1 mx-2">
				<button className="btn btn-primary" onClick={addNewItemClick}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</div>
	)
}

interface PeripheralDeviceTranslated {
	_id: PeripheralDeviceId
	configId: string
	name: string
	deviceType: string
	lastSeen: number
	deviceConfigSchema: JSONBlob<JSONSchema> | undefined
}

interface ParentDevicesTableProps {
	studioId: StudioId
	devices: WrappedOverridableItem<StudioDeviceSettings>[]
	overrideHelper: OverrideOpHelper
	createItemWithId: (id: string) => void
}
function GenericParentDevicesTable({
	studioId,
	devices,
	overrideHelper,
	createItemWithId,
}: Readonly<ParentDevicesTableProps>): JSX.Element {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const allParentDevices = useTracker(() => PeripheralDevices.find({ parentDeviceId: undefined }).fetch(), [], [])

	const studioParentDevices = useTracker(
		() => PeripheralDevices.find({ parentDeviceId: undefined, 'studioAndConfigId.studioId': studioId }).fetch(),
		[studioId],
		[]
	)
	const allKnownConfigIds = new Set(devices.map((d) => d.id))

	const peripheralDevicesByConfigIdMap = useMemo(() => {
		const devicesMap = new Map<string, PeripheralDeviceTranslated>()

		for (const device of allParentDevices) {
			if (!device.studioAndConfigId) continue
			if (device.studioAndConfigId.studioId !== studioId) continue

			devicesMap.set(
				device.studioAndConfigId.configId,
				literal<PeripheralDeviceTranslated>({
					_id: device._id,
					configId: device.studioAndConfigId.configId,
					name: device.name,
					deviceType: device.deviceName,
					lastSeen: device.lastSeen,
					deviceConfigSchema: device.configManifest?.deviceConfigSchema,
				})
			)
		}

		return devicesMap
	}, [studioId, allParentDevices])

	const confirmRemove = useCallback(
		(parentdeviceId: string) => {
			doModalDialog({
				title: t('Remove this device?'),
				no: t('Cancel'),
				yes: t('Remove'),
				onAccept: () => {
					overrideHelper().deleteItem(parentdeviceId).commit()
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to remove {{type}} "{{deviceId}}"?', {
								type: 'device',
								deviceId: parentdeviceId,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		},
		[t, overrideHelper]
	)

	const peripheralDeviceOptions = useMemo(() => {
		const options: DropdownInputOption<PeripheralDeviceId | undefined>[] = [
			{
				value: undefined,
				name: 'Unassigned',
				i: 0,
			},
		]

		for (const device of allParentDevices) {
			options.push({
				value: device._id,
				name: device.name || unprotectString(device._id),
				i: options.length,
			})
		}

		return options
	}, [allParentDevices])

	const undeleteItemWithId = useCallback(
		(itemId: string) => overrideHelper().resetItem(itemId).commit(),
		[overrideHelper]
	)

	return (
		<table className="expando settings-studio-device-table table">
			<thead>
				<tr className="hl">
					<th key="Name">{t('Name')}</th>
					<th key="ConfigID">{t('ID')}</th>
					<th key="GatewayID">{t('Gateway')}</th>
					<th key="LastSeen">{t('Last Seen')}</th>
					<th key="action">&nbsp;</th>
				</tr>
			</thead>
			<tbody>
				{devices.map((item) => {
					if (item.type === 'deleted') {
						return <DeletedSummaryRow key={item.id} item={item} undeleteItemWithId={undeleteItemWithId} />
					} else {
						const peripheralDevice = peripheralDevicesByConfigIdMap.get(item.id)

						return (
							<React.Fragment key={item.id}>
								<SummaryRow
									item={item}
									peripheralDevice={peripheralDevice}
									isEdited={isExpanded(item.id)}
									editItemWithId={toggleExpanded}
									removeItemWithId={confirmRemove}
								/>
								{isExpanded(item.id) && (
									<ParentDeviceEditRow
										studioId={studioId}
										peripheralDevice={peripheralDevice}
										peripheralDeviceOptions={peripheralDeviceOptions}
										editItemWithId={toggleExpanded}
										item={item}
										overrideHelper={overrideHelper}
									/>
								)}
							</React.Fragment>
						)
					}
				})}
				{studioParentDevices.map((device) => {
					if (!device.studioAndConfigId) return null
					if (allKnownConfigIds.has(device.studioAndConfigId.configId)) return null

					return (
						<OrphanedSummaryRow
							key={`device_${device._id}`}
							configId={device.studioAndConfigId.configId}
							device={device}
							createItemWithId={createItemWithId}
						/>
					)
				})}
			</tbody>
		</table>
	)
}

interface SummaryRowProps {
	item: WrappedOverridableItemNormal<StudioDeviceSettings>
	peripheralDevice: PeripheralDeviceTranslated | undefined
	isEdited: boolean
	editItemWithId: (itemId: string) => void
	removeItemWithId: (itemId: string) => void
}
function SummaryRow({
	item,
	peripheralDevice,
	isEdited,
	editItemWithId,
	removeItemWithId,
}: Readonly<SummaryRowProps>): JSX.Element {
	const editItem = useCallback(() => editItemWithId(item.id), [editItemWithId, item.id])
	const removeItem = useCallback(() => removeItemWithId(item.id), [removeItemWithId, item.id])

	return (
		<tr
			className={classNames({
				hl: isEdited,
			})}
		>
			<th className="settings-studio-device__name c2">{item.computed.name}</th>

			<th className="settings-studio-device__configID c2">{item.id}</th>

			<th className="settings-studio-device__parent c2">{peripheralDevice?.deviceType || '-'}</th>

			<th className="settings-studio-device__type c2">
				{peripheralDevice ? <MomentFromNow date={peripheralDevice.lastSeen} /> : '-'}
			</th>

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
	item: WrappedOverridableItemDeleted<StudioDeviceSettings>
	undeleteItemWithId: (itemId: string) => void
}
function DeletedSummaryRow({ item, undeleteItemWithId }: Readonly<DeletedSummaryRowProps>): JSX.Element {
	const undeleteItem = useCallback(() => undeleteItemWithId(item.id), [undeleteItemWithId, item.id])

	return (
		<tr>
			<th className="settings-studio-device__name c2 deleted">{item.defaults.name}</th>

			<th className="settings-studio-device__configID c2 deleted">{item.id}</th>

			<th className="settings-studio-device__gateway c2 deleted">-</th>

			<th className="settings-studio-device__last_seen c2 deleted">-</th>

			<td className="settings-studio-device__actions table-item-actions c1" key="action">
				<button className="action-btn" onClick={undeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}

interface OrphanedSummaryRowProps {
	configId: string
	device: ReadonlyDeep<PeripheralDevice>
	createItemWithId: (itemId: string) => void
}
function OrphanedSummaryRow({ configId, device, createItemWithId }: Readonly<OrphanedSummaryRowProps>): JSX.Element {
	const createItem = useCallback(() => createItemWithId(configId), [createItemWithId, configId])

	return (
		<tr>
			<th className="settings-studio-device__name c2 deleted">-</th>

			<th className="settings-studio-device__configID c2 deleted">{configId}</th>

			<th className="settings-studio-device__gateway c2 deleted">{device.deviceName || unprotectString(device._id)}</th>

			<th className="settings-studio-device__last_seen c2 deleted">{<MomentFromNow date={device.lastSeen} />}</th>

			<td className="settings-studio-device__actions table-item-actions c1" key="action">
				<button className="action-btn" onClick={createItem} title="Setup device">
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</td>
		</tr>
	)
}

interface ParentDeviceEditRowProps {
	studioId: StudioId
	peripheralDevice: PeripheralDeviceTranslated | undefined
	peripheralDeviceOptions: DropdownInputOption<PeripheralDeviceId | undefined>[]
	editItemWithId: (parentdeviceId: string, forceState?: boolean) => void
	item: WrappedOverridableItemNormal<StudioDeviceSettings>
	overrideHelper: OverrideOpHelper
}
function ParentDeviceEditRow({
	studioId,
	peripheralDevice,
	peripheralDeviceOptions,
	editItemWithId,
	item,
	overrideHelper,
}: Readonly<ParentDeviceEditRowProps>) {
	const { t } = useTranslation()

	const finishEditItem = useCallback(() => editItemWithId(item.id, false), [editItemWithId, item.id])

	return (
		<tr className="expando-details hl" key={item.id + '-details'}>
			<td colSpan={99}>
				<div className="properties-grid">
					<label className="field">
						<LabelActual label={t('ID')} />
						{item.id}
					</label>

					<LabelAndOverrides label={t('Name')} item={item} overrideHelper={overrideHelper} itemKey={'name'}>
						{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
					</LabelAndOverrides>

					<AssignPeripheralDeviceConfigId
						studioId={studioId}
						configId={item.id}
						value={peripheralDevice?._id}
						peripheralDeviceOptions={peripheralDeviceOptions}
					/>

					{!peripheralDevice && <p>{t('A device must be assigned to the config to edit the settings')}</p>}

					{peripheralDevice && (
						<ParentDeviceEditForm peripheralDevice={peripheralDevice} item={item} overrideHelper={overrideHelper} />
					)}
				</div>
				<div className="m-1 me-2 text-end">
					<button className={classNames('btn btn-primary')} onClick={finishEditItem}>
						<FontAwesomeIcon icon={faCheck} />
					</button>
				</div>
			</td>
		</tr>
	)
}

interface AssignPeripheralDeviceConfigIdProps {
	studioId: StudioId
	configId: string
	value: PeripheralDeviceId | undefined
	peripheralDeviceOptions: DropdownInputOption<PeripheralDeviceId | undefined>[]
}

function AssignPeripheralDeviceConfigId({
	studioId,
	configId,
	value,
	peripheralDeviceOptions,
}: AssignPeripheralDeviceConfigIdProps) {
	const handleUpdate = useCallback(
		(peripheralDeviceId: PeripheralDeviceId | undefined) => {
			MeteorCall.studio.assignConfigToPeripheralDevice(studioId, configId, peripheralDeviceId ?? null).catch((e) => {
				console.error('assignConfigToPeripheralDevice failed', e)
			})
		},
		[configId]
	)

	return (
		<label className="field">
			<LabelActual label={'Peripheral Device'} />
			<div className="field-content">
				<DropdownInputControl<PeripheralDeviceId | undefined>
					options={peripheralDeviceOptions}
					value={value}
					handleUpdate={handleUpdate}
				/>
			</div>
		</label>
	)
}

interface ParentDeviceEditFormProps {
	peripheralDevice: PeripheralDeviceTranslated
	item: WrappedOverridableItemNormal<StudioDeviceSettings>
	overrideHelper: OverrideOpHelper
}
function ParentDeviceEditForm({ peripheralDevice, item, overrideHelper }: Readonly<ParentDeviceEditFormProps>) {
	const { t } = useTranslation()

	const parsedSchema = useMemo((): JSONSchema | undefined => {
		if (peripheralDevice?.deviceConfigSchema) {
			return JSONBlobParse(peripheralDevice.deviceConfigSchema)
		}

		return undefined
	}, [peripheralDevice])

	const translationNamespaces = useMemo(() => ['peripheralDevice_' + peripheralDevice._id], [peripheralDevice._id])

	return (
		<>
			{parsedSchema ? (
				<SchemaFormWithOverrides
					schema={parsedSchema}
					attr={'options'}
					item={item}
					overrideHelper={overrideHelper}
					translationNamespaces={translationNamespaces}
					allowTables
					isRequired
				/>
			) : (
				<p>{t('Device is missing configuration schema')}</p>
			)}
		</>
	)
}
