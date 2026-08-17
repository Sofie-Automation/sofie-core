import React, { useCallback, useMemo, useState } from 'react'
import type { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTranslation } from 'react-i18next'
import {
	getAllCurrentAndDeletedItemsFromOverrides,
	type OverrideOpHelper,
	useOverrideOpHelper,
	type WrappedOverridableItem,
	type WrappedOverridableItemDeleted,
	type WrappedOverridableItemNormal,
} from '../../util/OverrideOpHelper.js'
import { faCheck, faPencilAlt, faPlus, faSync, faTrash, faSave, faRotateLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { type JSONBlob, JSONBlobParse, type JSONSchema } from '@sofie-automation/blueprints-integration'
import { DropdownInputControl, type DropdownInputOption } from '../../../../lib/Components/DropdownInput.js'
import { useToggleExpandHelper } from '../../../util/useToggleExpandHelper.js'
import { doModalDialog } from '../../../../lib/ModalDialog.js'
import classNames from 'classnames'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { SchemaFormWithOverrides } from '../../../../lib/forms/SchemaFormWithOverrides.js'
import { LabelActual, LabelAndOverrides } from '../../../../lib/Components/LabelAndOverrides.js'
import { getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import type { StudioDeviceSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	type SomeObjectOverrideOp,
	wrapDefaultObject,
	type ObjectOverrideSetOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import Tooltip from 'rc-tooltip'
import { PeripheralDevices, Studios } from '../../../../collections/index.js'
import { getHelpMode } from '../../../../lib/localStorage.js'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData.js'
import { TextInputControl } from '../../../../lib/Components/TextInput.js'
import { MomentFromNow } from '../../../../lib/Moment.js'
import { MeteorCall } from '../../../../lib/meteorApi.js'
import type { ReadonlyDeep } from 'type-fest'
import type { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'

interface StudioParentDevicesProps {
	studioId: StudioId
}
export function StudioParentDevices({ studioId }: Readonly<StudioParentDevicesProps>): JSX.Element {
	const { t } = useTranslation()

	const studio = useTracker(() => Studios.findOne(studioId), [studioId])

	const [unsavedOverrides, setUnsavedOverrides] = useState<SomeObjectOverrideOp[] | undefined>(undefined)
	const [unsavedAssignments, setUnsavedAssignments] = useState<Record<string, PeripheralDeviceId | undefined>>({})

	const persistedOverrides = studio?.peripheralDeviceSettings?.deviceSettings.overrides ?? []

	const isOverrideOpForItem = useCallback((opPath: string, itemId: string): boolean => {
		return opPath === itemId || opPath.startsWith(`${itemId}.`)
	}, [])

	const getOpsForItem = useCallback(
		(ops: SomeObjectOverrideOp[], itemId: string): SomeObjectOverrideOp[] => {
			return ops.filter((op) => isOverrideOpForItem(op.path, itemId))
		},
		[isOverrideOpForItem]
	)

	const removeOpsForItem = useCallback(
		(ops: SomeObjectOverrideOp[], itemId: string): SomeObjectOverrideOp[] => {
			return ops.filter((op) => !isOverrideOpForItem(op.path, itemId))
		},
		[isOverrideOpForItem]
	)

	const hasUnsavedOverrideForItem = useCallback(
		(itemId: string): boolean => {
			const currentOverrides = unsavedOverrides ?? persistedOverrides
			const currentItemOps = getOpsForItem(currentOverrides, itemId)
			const persistedItemOps = getOpsForItem(persistedOverrides, itemId)

			return JSON.stringify(currentItemOps) !== JSON.stringify(persistedItemOps)
		},
		[getOpsForItem, persistedOverrides, unsavedOverrides]
	)

	const hasUnsavedAssignmentForItem = useCallback(
		(itemId: string): boolean => {
			return itemId in unsavedAssignments
		},
		[unsavedAssignments]
	)

	const hasUnsavedChangesForItem = useCallback(
		(itemId: string): boolean => hasUnsavedOverrideForItem(itemId) || hasUnsavedAssignmentForItem(itemId),
		[hasUnsavedAssignmentForItem, hasUnsavedOverrideForItem]
	)

	const deviceSettings = useMemo(() => {
		const base =
			studio?.peripheralDeviceSettings?.deviceSettings ?? wrapDefaultObject<Record<string, StudioDeviceSettings>>({})
		if (unsavedOverrides) {
			return {
				...base,
				overrides: unsavedOverrides,
			}
		}
		return base
	}, [studio?.peripheralDeviceSettings?.deviceSettings, unsavedOverrides])

	const overrideHelper = useOverrideOpHelper(setUnsavedOverrides, deviceSettings)

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

			setUnsavedOverrides([...deviceSettings.overrides, addOp])
		},
		[deviceSettings.overrides]
	)
	const addNewItemClick = useCallback(() => addNewItem(), [addNewItem])

	const changeAssignment = useCallback((configId: string, deviceId: PeripheralDeviceId | undefined) => {
		setUnsavedAssignments((prev) => ({
			...prev,
			[configId]: deviceId,
		}))
	}, [])

	const discardItemChanges = useCallback(
		(itemId: string) => {
			setUnsavedAssignments((prev) => {
				if (!(itemId in prev)) return prev

				const next = { ...prev }
				delete next[itemId]
				return next
			})

			setUnsavedOverrides((prev) => {
				const currentOverrides = prev ?? persistedOverrides
				const currentWithoutItem = removeOpsForItem(currentOverrides, itemId)
				const persistedItemOps = getOpsForItem(persistedOverrides, itemId)
				const nextOverrides = [...currentWithoutItem, ...persistedItemOps]

				if (JSON.stringify(nextOverrides) === JSON.stringify(persistedOverrides)) {
					return undefined
				}

				return nextOverrides
			})
		},
		[getOpsForItem, persistedOverrides, removeOpsForItem]
	)

	const saveItemChanges = useCallback(
		(itemId: string) => {
			const hasUnsavedOverride = hasUnsavedOverrideForItem(itemId)
			const hasUnsavedAssignment = hasUnsavedAssignmentForItem(itemId)

			if (studio?._id && hasUnsavedOverride) {
				const currentOverrides = unsavedOverrides ?? persistedOverrides
				const currentItemOps = getOpsForItem(currentOverrides, itemId)
				const persistedWithoutItem = removeOpsForItem(persistedOverrides, itemId)
				const nextPersistedOverrides = [...persistedWithoutItem, ...currentItemOps]

				Studios.update(studio._id, {
					$set: {
						'peripheralDeviceSettings.deviceSettings.overrides': nextPersistedOverrides,
					},
				})
			}

			if (hasUnsavedAssignment) {
				MeteorCall.studio
					.assignConfigToPeripheralDevice(studioId, itemId, unsavedAssignments[itemId] ?? null)
					.catch((e) => {
						console.error('Failed to save assignment', e)
					})

				setUnsavedAssignments((prev) => {
					const next = { ...prev }
					delete next[itemId]
					return next
				})
			}
		},
		[
			getOpsForItem,
			hasUnsavedAssignmentForItem,
			hasUnsavedOverrideForItem,
			persistedOverrides,
			removeOpsForItem,
			studio?._id,
			studioId,
			unsavedAssignments,
			unsavedOverrides,
		]
	)

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
				hasUnsavedChangesForItem={hasUnsavedChangesForItem}
				saveItemChanges={saveItemChanges}
				discardItemChanges={discardItemChanges}
				unsavedAssignments={unsavedAssignments}
				changeAssignment={changeAssignment}
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
	hasUnsavedChangesForItem: (itemId: string) => boolean
	saveItemChanges: (itemId: string) => void
	discardItemChanges: (itemId: string) => void
	// maps configId to peripheralDeviceId when not saved yet
	unsavedAssignments: Record<string, PeripheralDeviceId | undefined>
	changeAssignment: (configId: string, deviceId: PeripheralDeviceId | undefined) => void
}
function GenericParentDevicesTable({
	studioId,
	devices,
	overrideHelper,
	createItemWithId,
	hasUnsavedChangesForItem,
	saveItemChanges,
	discardItemChanges,
	unsavedAssignments,
	changeAssignment,
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

		// apply unsaved assignments on top of the current state
		for (const [configId, deviceId] of Object.entries<PeripheralDeviceId | undefined>(unsavedAssignments)) {
			if (!deviceId) {
				devicesMap.delete(configId)
				continue
			}

			const device = allParentDevices.find((d) => d._id === deviceId)
			if (!device) continue

			devicesMap.set(
				configId,
				literal<PeripheralDeviceTranslated>({
					_id: device._id,
					configId: configId,
					name: device.name,
					deviceType: device.deviceName,
					lastSeen: device.lastSeen,
					deviceConfigSchema: device.configManifest?.deviceConfigSchema,
				})
			)
		}

		return devicesMap
	}, [studioId, allParentDevices, unsavedAssignments])

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
										hasUnsavedChanges={hasUnsavedChangesForItem(item.id)}
										saveChanges={() => saveItemChanges(item.id)}
										discardChanges={() => discardItemChanges(item.id)}
										currentAssignment={
											item.id in unsavedAssignments ? unsavedAssignments[item.id] : peripheralDevice?._id
										}
										changeAssignment={changeAssignment}
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
	hasUnsavedChanges: boolean
	saveChanges: () => void
	discardChanges: () => void
	currentAssignment: PeripheralDeviceId | undefined
	changeAssignment: (configId: string, deviceId: PeripheralDeviceId | undefined) => void
}
function ParentDeviceEditRow({
	peripheralDevice,
	peripheralDeviceOptions,
	editItemWithId,
	item,
	overrideHelper,
	hasUnsavedChanges,
	saveChanges,
	discardChanges,
	currentAssignment,
	changeAssignment,
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
						configId={item.id}
						value={currentAssignment}
						peripheralDeviceOptions={peripheralDeviceOptions}
						onChange={changeAssignment}
					/>

					{!peripheralDevice && <p>{t('A device must be assigned to the config to edit the settings')}</p>}

					{peripheralDevice && (
						<ParentDeviceEditForm peripheralDevice={peripheralDevice} item={item} overrideHelper={overrideHelper} />
					)}
				</div>
				<div className="m-1 me-2 text-end">
					{hasUnsavedChanges ? (
						<>
							<button className="btn btn-warning ms-2" onClick={discardChanges}>
								<FontAwesomeIcon icon={faRotateLeft} />
								&nbsp;{t('Discard')}
							</button>

							<button className="btn btn-primary ms-2" onClick={saveChanges}>
								<FontAwesomeIcon icon={faSave} />
								&nbsp;{t('Save')}
							</button>
						</>
					) : (
						<button className="btn btn-primary ms-2" onClick={finishEditItem}>
							<FontAwesomeIcon icon={faCheck} />
						</button>
					)}
				</div>
			</td>
		</tr>
	)
}

interface AssignPeripheralDeviceConfigIdProps {
	configId: string
	value: PeripheralDeviceId | undefined
	peripheralDeviceOptions: DropdownInputOption<PeripheralDeviceId | undefined>[]
	onChange: (configId: string, deviceId: PeripheralDeviceId | undefined) => void
}

function AssignPeripheralDeviceConfigId({
	configId,
	value,
	peripheralDeviceOptions,
	onChange,
}: AssignPeripheralDeviceConfigIdProps) {
	const handleUpdate = useCallback(
		(peripheralDeviceId: PeripheralDeviceId | undefined) => {
			onChange(configId, peripheralDeviceId)
		},
		[configId, onChange]
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
