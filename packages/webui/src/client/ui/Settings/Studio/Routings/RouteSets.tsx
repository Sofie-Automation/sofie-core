import ClassNames from 'classnames'
import * as React from 'react'
import {
	StudioRouteSet,
	StudioRouteBehavior,
	RouteMapping,
	StudioRouteSetExclusivityGroup,
	StudioRouteType,
	MappingsExt,
	MappingExt,
	DBStudio,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { doModalDialog } from '../../../../lib/ModalDialog.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck, faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { TSR } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { MappingsSettingsManifest, MappingsSettingsManifests } from '../Mappings.js'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	DropdownInputControl,
	DropdownInputOption,
	getDropdownInputOptions,
} from '../../../../lib/Components/DropdownInput.js'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'
import {
	LabelActual,
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForDropdown,
} from '../../../../lib/Components/LabelAndOverrides.js'
import {
	OverrideOpHelper,
	OverrideOpHelperForItemContents,
	useOverrideOpHelper,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
} from '../../util/OverrideOpHelper.js'
import { TextInputControl } from '../../../../lib/Components/TextInput.js'
import { CheckboxControl } from '../../../../lib/Components/Checkbox.js'
import { OverrideOpHelperArrayTable } from '../../../../lib/forms/SchemaFormTable/ArrayTableOpHelper.js'
import { hasOpWithPath } from '../../../../lib/Components/util.js'
import { SchemaFormWithOverrides } from '../../../../lib/forms/SchemaFormWithOverrides.js'
import {
	applyAndValidateOverrides,
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { Studios } from '../../../../collections/index.js'
import { useToggleExpandHelper } from '../../../util/useToggleExpandHelper.js'
import { RouteSetAbPlayers } from './RouteSetAbPlayers.js'
import Button from 'react-bootstrap/esm/Button'

interface RouteSetsTable {
	studio: DBStudio
	routeSetsFromOverrides: WrappedOverridableItem<StudioRouteSet>[]
	exclusivityGroupsFromOverrides: WrappedOverridableItem<StudioRouteSetExclusivityGroup>[]
	studioMappings: ReadonlyDeep<MappingsExt>
	manifest: MappingsSettingsManifests
	translationNamespaces: string[]
}

export function RouteSetsTable({
	studio,
	routeSetsFromOverrides,
	exclusivityGroupsFromOverrides,
	studioMappings,
	manifest,
	translationNamespaces,
}: Readonly<RouteSetsTable>): React.JSX.Element {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const addNewRouteSet = React.useCallback(() => {
		const resolvedRouteSets = applyAndValidateOverrides(studio.routeSetsWithOverrides).obj

		// find free key name
		const newRouteKeyName = 'newRouteSet'
		let iter = 0
		while (resolvedRouteSets[newRouteKeyName + iter.toString()]) {
			iter++
		}

		const newId = newRouteKeyName + iter.toString()
		const newRoute = literal<StudioRouteSet>({
			name: 'New Route Set ' + iter.toString(),
			active: false,
			routes: [],
			abPlayers: [],
			behavior: StudioRouteBehavior.TOGGLE,
			exclusivityGroup: undefined,
		})

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newRoute,
		})

		Studios.update(studio._id, {
			$push: {
				'routeSetsWithOverrides.overrides': addOp,
			},
		})

		setTimeout(() => {
			toggleExpanded(newId, true)
		}, 1)
	}, [studio._id, studio.routeSetsWithOverrides])

	const saveOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'routeSetsWithOverrides.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, studio.routeSetsWithOverrides)

	return (
		<>
			<table className="expando settings-studio-mappings-table">
				<tbody>
					{routeSetsFromOverrides.length === 0 ? (
						<tr>
							<td className="dimmed">{t('There are no Route Sets set up.')}</td>
						</tr>
					) : (
						routeSetsFromOverrides.map((routeSet: WrappedOverridableItem<StudioRouteSet>) =>
							routeSet.type === 'normal' ? (
								<RouteSetRow
									key={routeSet.id}
									routeSet={routeSet}
									manifest={manifest}
									translationNamespaces={translationNamespaces}
									studioMappings={studioMappings}
									toggleExpanded={toggleExpanded}
									isExpanded={isExpanded(routeSet.id)}
									overrideHelper={overrideHelper}
									exclusivityGroupsFromOverrides={exclusivityGroupsFromOverrides}
								/>
							) : (
								<RouteSetDeletedRow key={routeSet.id} routeSet={routeSet} overrideHelper={overrideHelper} />
							)
						)
					)}
				</tbody>
			</table>
			<div className="my-1 mx-2">
				<button className="btn btn-primary" onClick={addNewRouteSet}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</>
	)
}

interface RouteSetRowProps {
	routeSet: WrappedOverridableItemNormal<StudioRouteSet>
	manifest: MappingsSettingsManifests
	translationNamespaces: string[]
	studioMappings: ReadonlyDeep<MappingsExt>
	toggleExpanded: (layerId: string, force?: boolean) => void
	isExpanded: boolean
	overrideHelper: OverrideOpHelper
	exclusivityGroupsFromOverrides: WrappedOverridableItem<StudioRouteSetExclusivityGroup>[]
}

function RouteSetRow({
	routeSet,
	manifest,
	translationNamespaces,
	toggleExpanded,
	isExpanded,
	studioMappings,
	overrideHelper,
	exclusivityGroupsFromOverrides,
}: Readonly<RouteSetRowProps>): React.JSX.Element {
	const { t } = useTranslation()
	const toggleEditRouteSet = React.useCallback(() => toggleExpanded(routeSet.id), [toggleExpanded, routeSet.id])

	const confirmRemove = (routeSetId: string) => {
		doModalDialog({
			title: t('Remove this Route Set?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				overrideHelper().deleteItem(routeSetId).commit()
			},
			message: (
				<React.Fragment>
					<p>{t('Are you sure you want to remove the Route Set "{{routeId}}"?', { routeId: routeSetId })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}

	const addNewRouteInSet = (routeId: string) => {
		const newRoutes = routeSet.computed?.routes || []

		newRoutes.push({
			mappedLayer: '',
			outputMappedLayer: '',
			remapping: {},
			routeType: StudioRouteType.REROUTE,
		})

		overrideHelper().setItemValue(routeId, 'routes', newRoutes).commit()
	}

	const addNewAbPlayerInSet = (routeId: string) => {
		const newAbPlayers = routeSet.computed?.abPlayers || []

		newAbPlayers.push({
			poolName: '',
			playerId: '',
		})

		overrideHelper().setItemValue(routeId, 'abPlayers', newAbPlayers).commit()
	}

	const updateRouteSetId = React.useCallback(
		(newRouteSetId: string) => {
			overrideHelper().changeItemId(routeSet.id, newRouteSetId).commit()
			toggleExpanded(newRouteSetId, true)
		},
		[overrideHelper, toggleExpanded, routeSet.id]
	)

	const exclusivityGroupOptions = React.useMemo(() => {
		return getDropdownInputOptions([
			{
				name: 'None',
				value: undefined,
			},
			...exclusivityGroupsFromOverrides
				.filter((group) => group.type === 'normal')
				.map((group) => group.computed?.name || group.id),
		])
	}, [exclusivityGroupsFromOverrides])

	const DEFAULT_ACTIVE_OPTIONS = {
		[t('Active')]: true,
		[t('Not Active')]: false,
		[t('Not defined')]: undefined,
	}

	const resyncRoutesTable = React.useCallback(
		() => overrideHelper().clearItemOverrides(routeSet.id, 'routes').commit(),
		[overrideHelper, routeSet.id]
	)
	const routesIsOverridden = hasOpWithPath(routeSet.overrideOps, routeSet.id, 'routes')

	const resyncAbPlayerTable = React.useCallback(
		() => overrideHelper().clearItemOverrides(routeSet.id, 'abPlayers').commit(),
		[overrideHelper, routeSet.id]
	)
	const abPlayerIsOverridden = hasOpWithPath(routeSet.overrideOps, routeSet.id, 'abPlayers')

	return (
		<React.Fragment>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-device__name c2">{routeSet.id}</th>
				<td className="settings-studio-device__id c3">{routeSet.computed?.name}</td>
				<td className="settings-studio-device__id c4">{routeSet.computed?.exclusivityGroup}</td>
				<td className="settings-studio-device__id c2">{routeSet.computed?.routes?.length}</td>
				<td className="settings-studio-device__id c2">
					{routeSet.computed?.active ? <span className="pill">{t('Active')}</span> : null}
				</td>

				<td className="settings-studio-device__actions table-item-actions c3">
					<button className="action-btn" onClick={toggleEditRouteSet}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={() => confirmRemove(routeSet.id)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded && (
				<tr className="expando-details hl">
					<td colSpan={6}>
						<div className="properties-grid">
							<label className="field">
								<LabelActual label={t('Route Set ID')} />
								<TextInputControl value={routeSet.id} handleUpdate={updateRouteSetId} disabled={!!routeSet.defaults} />
							</label>
							<LabelAndOverridesForDropdown
								label={t('Default State')}
								hint={t('he default state of this Route Set')}
								item={routeSet}
								itemKey={'defaultActive'}
								overrideHelper={overrideHelper}
								options={getDropdownInputOptions(DEFAULT_ACTIVE_OPTIONS)}
							>
								{(value, handleUpdate, options) => (
									<DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
								)}
							</LabelAndOverridesForDropdown>
							<LabelAndOverridesForCheckbox
								label={t('Active')}
								item={routeSet}
								itemKey={'active'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverrides
								label={t('Route Set Name')}
								item={routeSet}
								itemKey={'name'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
							</LabelAndOverrides>

							<LabelAndOverridesForDropdown
								label={'Exclusivity group'}
								hint={t('If set, only one Route Set will be active per exclusivity group')}
								item={routeSet}
								itemKey={'exclusivityGroup'}
								overrideHelper={overrideHelper}
								options={exclusivityGroupOptions}
							>
								{(value, handleUpdate, options) => (
									<DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
								)}
							</LabelAndOverridesForDropdown>

							<LabelAndOverridesForDropdown
								label={t('Behavior')}
								hint={t('The way this Route Set should behave towards the user')}
								item={routeSet}
								itemKey={'behavior'}
								overrideHelper={overrideHelper}
								options={getDropdownInputOptions(StudioRouteBehavior)}
							>
								{(value, handleUpdate, options) => (
									<DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
								)}
							</LabelAndOverridesForDropdown>
						</div>
						<RenderRoutes
							routeSet={routeSet}
							manifest={manifest}
							translationNamespaces={translationNamespaces}
							overrideHelper={overrideHelper}
							studioMappings={studioMappings}
						/>
						<div className="my-1 mx-2">
							<Button variant="outline-secondary" onClick={() => addNewRouteInSet(routeSet.id)}>
								<FontAwesomeIcon icon={faPlus} />
							</Button>
							&nbsp;
							{routeSet.defaults && (
								<Button
									variant="primary"
									onClick={resyncRoutesTable}
									title="Reset to default"
									disabled={!routesIsOverridden}
								>
									<span>{t('Reset')}</span>
									<FontAwesomeIcon icon={faSync} />
								</Button>
							)}
						</div>
						<RouteSetAbPlayers routeSet={routeSet} overrideHelper={overrideHelper} />
						<div className="my-1 mx-2">
							<Button variant="outline-secondary" onClick={() => addNewAbPlayerInSet(routeSet.id)}>
								<FontAwesomeIcon icon={faPlus} />
							</Button>
							&nbsp;
							{routeSet.defaults && (
								<Button
									variant="primary"
									onClick={resyncAbPlayerTable}
									title="Reset to default"
									disabled={!abPlayerIsOverridden}
								>
									<span>{t('Reset')}</span>
									<FontAwesomeIcon icon={faSync} />
								</Button>
							)}
						</div>
						<div className="text-end">
							<Button variant="primary" onClick={() => toggleExpanded(routeSet.id)}>
								<FontAwesomeIcon icon={faCheck} />
							</Button>
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	)
}

interface RouteSetDeletedRowProps {
	routeSet: WrappedOverridableItemDeleted<StudioRouteSet>
	overrideHelper: OverrideOpHelper
}

function RouteSetDeletedRow({ routeSet, overrideHelper }: Readonly<RouteSetDeletedRowProps>) {
	const doUndeleteItem = React.useCallback(
		() => overrideHelper().resetItem(routeSet.id).commit(),
		[overrideHelper, routeSet.id]
	)

	return (
		<tr>
			<th className="settings-studio-device__name c3 notifications-s notifications-text">{routeSet.defaults.name}</th>
			<td className="settings-studio-device__id c2 deleted">{routeSet.defaults.name}</td>
			<td className="settings-studio-device__id c2 deleted">{routeSet.id}</td>
			<td className="settings-studio-output-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}

interface IRenderRoutesProps {
	routeSet: WrappedOverridableItemNormal<StudioRouteSet>
	manifest: MappingsSettingsManifests
	translationNamespaces: string[]
	overrideHelper: OverrideOpHelper
	studioMappings: ReadonlyDeep<MappingsExt>
}

function RenderRoutes({
	routeSet,
	manifest,
	translationNamespaces,
	overrideHelper,
	studioMappings,
}: Readonly<IRenderRoutesProps>): React.JSX.Element {
	const { t } = useTranslation()

	const routesBuffer = routeSet.computed.routes

	const tableOverrideHelper = React.useCallback(
		() => new OverrideOpHelperArrayTable(overrideHelper(), routeSet.id, routesBuffer, 'routes'),
		[overrideHelper, routeSet.id, routesBuffer]
	)

	const confirmRemoveRoute = React.useCallback(
		(route: WrappedOverridableItemNormal<RouteMapping>) => {
			doModalDialog({
				title: t('Remove this Route from this Route Set?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					tableOverrideHelper().deleteRow(route.id).commit()
				},
				message: (
					<>
						<p>
							{t('Are you sure you want to remove the Route from "{{sourceLayerId}}" to "{{newLayerId}}"?', {
								sourceLayerId: route.computed.mappedLayer,
								newLayerId: route.computed.outputMappedLayer,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</>
				),
			})
		},
		[tableOverrideHelper]
	)

	return (
		<>
			<h4 className="my-2">{t('Routes')}</h4>
			{routeSet.computed?.routes?.length === 0 ? (
				<p className="text-s dimmed field-hint mx-2">{t('There are no routes set up yet')}</p>
			) : null}
			{routesBuffer.map((route, index) => (
				<RenderRoutesRow
					key={index}
					manifest={manifest}
					translationNamespaces={translationNamespaces}
					tableOverrideHelper={tableOverrideHelper}
					studioMappings={studioMappings}
					rawRoute={route}
					routeIndex={index}
					confirmRemoveRoute={confirmRemoveRoute}
				/>
			))}
		</>
	)
}

interface RenderRoutesRowProps {
	manifest: MappingsSettingsManifests
	translationNamespaces: string[]
	tableOverrideHelper: OverrideOpHelperForItemContents
	studioMappings: ReadonlyDeep<MappingsExt>
	rawRoute: RouteMapping
	routeIndex: number
	confirmRemoveRoute: (route: WrappedOverridableItemNormal<RouteMapping>) => void
}

function RenderRoutesRow({
	manifest,
	translationNamespaces,
	tableOverrideHelper,
	studioMappings,
	rawRoute,
	routeIndex,
	confirmRemoveRoute,
}: Readonly<RenderRoutesRowProps>): React.JSX.Element {
	const { t } = useTranslation()

	const mappedLayer = rawRoute.mappedLayer ? studioMappings[rawRoute.mappedLayer] : undefined
	const deviceTypeFromMappedLayer: TSR.DeviceType | undefined = mappedLayer?.device

	const routeDeviceType: TSR.DeviceType | undefined =
		rawRoute.routeType === StudioRouteType.REMAP
			? rawRoute.deviceType
			: rawRoute.mappedLayer
				? deviceTypeFromMappedLayer
				: rawRoute.deviceType

	const routeMappingSchema = manifest[(routeDeviceType ?? rawRoute.remapping?.device) as TSR.DeviceType]

	const mappingTypeOptions: DropdownInputOption<string | number>[] = React.useMemo(() => {
		const rawMappingTypeOptions = Object.entries<JSONSchema>(routeMappingSchema?.mappingsSchema || {})
		return rawMappingTypeOptions.map(([id, entry], i) =>
			literal<DropdownInputOption<string | number>>({
				value: id + '',
				name: entry?.title ?? id + '',
				i,
			})
		)
	}, [routeMappingSchema?.mappingsSchema])

	const route = React.useMemo(
		() =>
			literal<WrappedOverridableItemNormal<RouteMapping>>({
				type: 'normal',
				id: routeIndex + '',
				computed: rawRoute,
				defaults: undefined,
				overrideOps: [],
			}),
		[rawRoute, routeIndex]
	)

	const confirmRemoveRouteLocal = React.useCallback(() => confirmRemoveRoute(route), [confirmRemoveRoute, route])

	return (
		<div className="route-sets-editor card m-2 p-2 grid-buttons-right">
			<div className="properties-grid">
				<LabelAndOverridesForDropdown
					label={t('Original Layer')}
					item={route}
					itemKey={'mappedLayer'}
					overrideHelper={tableOverrideHelper}
					options={getDropdownInputOptions(Object.keys(studioMappings))}
				>
					{(value, handleUpdate, options) => (
						<DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
					)}
				</LabelAndOverridesForDropdown>

				<LabelAndOverrides
					label={t('New Layer')}
					item={route}
					itemKey={'outputMappedLayer'}
					overrideHelper={tableOverrideHelper}
				>
					{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
				</LabelAndOverrides>

				<LabelAndOverridesForDropdown
					label={t('Route Type')}
					item={route}
					itemKey={'routeType'}
					overrideHelper={tableOverrideHelper}
					options={getDropdownInputOptions(StudioRouteType)}
				>
					{(value, handleUpdate, options) => {
						if (!rawRoute.mappedLayer) {
							return <span className="ms-1">REMAP</span>
						} else {
							return <DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
						}
					}}
				</LabelAndOverridesForDropdown>

				<LabelAndOverridesForDropdown
					label={t('Device Type')}
					item={route}
					itemKey={'deviceType'}
					overrideHelper={tableOverrideHelper}
					options={getDropdownInputOptions(TSR.DeviceType)}
				>
					{(value, handleUpdate, options) => {
						if (rawRoute.routeType === StudioRouteType.REROUTE && rawRoute.mappedLayer) {
							return deviceTypeFromMappedLayer !== undefined ? (
								<span className="ms-1">{TSR.DeviceType[deviceTypeFromMappedLayer]}</span>
							) : (
								<span className="ms-1 dimmed">{t('Original Layer not found')}</span>
							)
						} else {
							return <DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
						}
					}}
				</LabelAndOverridesForDropdown>

				{mappingTypeOptions.length > 0 && (
					<LabelAndOverridesForDropdown<any> // Deep key is not allowed, but is fine for now
						label={t('Mapping Type')}
						item={route}
						itemKey={'remapping.options.mappingType'}
						overrideHelper={tableOverrideHelper}
						options={mappingTypeOptions}
					>
						{(value, handleUpdate, options) => (
							<DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
						)}
					</LabelAndOverridesForDropdown>
				)}
				{rawRoute.routeType === StudioRouteType.REMAP ||
				(routeDeviceType !== undefined && rawRoute.remapping !== undefined) ? (
					<>
						<LabelAndOverrides<any> // Deep key is not allowed, but is fine for now
							label={t('Device ID')}
							item={route}
							itemKey={'remapping.deviceId'}
							overrideHelper={tableOverrideHelper}
							showClearButton={true}
						>
							{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
						</LabelAndOverrides>

						<DeviceMappingSettings
							translationNamespaces={translationNamespaces}
							mappedLayer={mappedLayer}
							manifest={routeMappingSchema}
							overrideHelper={tableOverrideHelper}
							route={route}
						/>
					</>
				) : null}
			</div>
			<button className="action-btn" onClick={confirmRemoveRouteLocal}>
				<FontAwesomeIcon icon={faTrash} />
			</button>
		</div>
	)
}

interface IDeviceMappingSettingsProps {
	translationNamespaces: string[]
	manifest: MappingsSettingsManifest | undefined
	mappedLayer: ReadonlyDeep<MappingExt> | undefined
	overrideHelper: OverrideOpHelperForItemContents
	route: WrappedOverridableItemNormal<RouteMapping>
}

function DeviceMappingSettings({
	translationNamespaces,
	manifest,
	mappedLayer,
	overrideHelper,
	route,
}: Readonly<IDeviceMappingSettingsProps>) {
	const mappingType = route.computed?.remapping?.options?.mappingType ?? mappedLayer?.options?.mappingType
	const mappingSchema = mappingType ? manifest?.mappingsSchema?.[mappingType] : undefined

	// Remove the required field from the schema, as that the properties show the clear button
	const mappingSchemaPartial = React.useMemo(() => {
		if (!mappingSchema) return null

		return { ...mappingSchema, required: [] }
	}, [mappingSchema])

	if (mappingSchemaPartial) {
		return (
			<SchemaFormWithOverrides
				schema={mappingSchemaPartial}
				translationNamespaces={translationNamespaces}
				attr={'remapping.options'}
				item={route}
				overrideHelper={overrideHelper}
				isRequired
				showClearButtonForNonRequiredFields={true}
			/>
		)
	} else {
		return null
	}
}
