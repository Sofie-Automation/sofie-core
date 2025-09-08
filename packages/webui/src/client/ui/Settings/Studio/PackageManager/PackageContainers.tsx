import ClassNames from 'classnames'
import * as React from 'react'
import { DBStudio, StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { doModalDialog } from '../../../../lib/ModalDialog.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { Studios } from '../../../../collections/index.js'
import {
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
	applyAndValidateOverrides,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	LabelActual,
	LabelAndOverrides,
	LabelAndOverridesForMultiSelect,
} from '../../../../lib/Components/LabelAndOverrides.js'
import { useToggleExpandHelper } from '../../../util/useToggleExpandHelper.js'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { TextInputControl } from '../../../../lib/Components/TextInput.js'
import { DropdownInputOption } from '../../../../lib/Components/DropdownInput.js'
import { MultiSelectInputControl } from '../../../../lib/Components/MultiSelectInput.js'
import {
	OverrideOpHelper,
	WrappedOverridableItem,
	WrappedOverridableItemNormal,
	useOverrideOpHelper,
} from '../../util/OverrideOpHelper.js'
import { AccessorsTable } from './AccessorTable.js'

interface PackageContainersTableProps {
	studio: DBStudio
	packageContainersFromOverrides: WrappedOverridableItem<StudioPackageContainer>[]
}

export function PackageContainersTable({
	studio,
	packageContainersFromOverrides,
}: PackageContainersTableProps): React.JSX.Element {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const saveOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'packageContainersWithOverrides.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, studio.packageContainersWithOverrides)

	const addNewPackageContainer = React.useCallback(() => {
		const resolvedPackageContainers = applyAndValidateOverrides(studio.packageContainersWithOverrides).obj

		// find free key name
		const newKeyName = 'newContainer'
		let iter = 0
		while (resolvedPackageContainers[newKeyName + iter.toString()]) {
			iter++
		}

		const newId = newKeyName + iter.toString()
		const newPackageContainer: StudioPackageContainer = {
			deviceIds: [],
			container: {
				label: 'New Package Container ' + iter.toString(),
				accessors: {},
			},
		}

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newPackageContainer,
		})

		Studios.update(studio._id, {
			$push: {
				'packageContainersWithOverrides.overrides': addOp,
			},
		})

		setTimeout(() => {
			toggleExpanded(newId, true)
		}, 1)
	}, [studio._id, studio.packageContainersWithOverrides])

	const confirmRemovePackageContainer = (containerId: string) => {
		doModalDialog({
			title: t('Remove this Package Container?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				overrideHelper().deleteItem(containerId).commit()
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to remove the Package Container "{{containerId}}"?', {
							containerId: containerId,
						})}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}

	const confirmReset = React.useCallback(
		(packgageContainerId: string) => {
			doModalDialog({
				title: t('Reset this Package Container?'),
				yes: t('Reset'),
				no: t('Cancel'),
				onAccept: () => {
					overrideHelper().resetItem(packgageContainerId).commit()
				},
				message: (
					<React.Fragment>
						<p>
							{t('Are you sure you want to reset all overrides for Packing Container "{{id}}"?', {
								id: packgageContainerId,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</React.Fragment>
				),
			})
		},
		[t, packageContainersFromOverrides, overrideHelper]
	)

	return (
		<>
			<table className="table expando settings-studio-package-containers-table">
				<tbody>
					{packageContainersFromOverrides.map(
						(packageContainer: WrappedOverridableItem<StudioPackageContainer>): React.JSX.Element =>
							packageContainer.type == 'normal' ? (
								<PackageContainerRow
									key={packageContainer.id}
									studio={studio}
									packageContainer={packageContainer}
									overrideHelper={overrideHelper}
									toggleExpanded={toggleExpanded}
									isExpanded={isExpanded}
									confirmRemovePackageContainer={confirmRemovePackageContainer}
									confirmReset={confirmReset}
								/>
							) : (
								<PackageContainerDeletedRow
									key={packageContainer.id}
									packageContainer={packageContainer}
									overrideHelper={overrideHelper}
								/>
							)
					)}
				</tbody>
			</table>
			<div className="my-1 mx-2">
				<button className="btn btn-primary" onClick={addNewPackageContainer}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</>
	)
}

interface PackageContainerDeletedRowProps {
	packageContainer: WrappedOverridableItem<StudioPackageContainer>
	overrideHelper: OverrideOpHelper
}

function PackageContainerDeletedRow({ packageContainer, overrideHelper }: Readonly<PackageContainerDeletedRowProps>) {
	const doUndeleteItem = React.useCallback(
		() => overrideHelper().resetItem(packageContainer.id).commit(),
		[overrideHelper, packageContainer.id]
	)

	return (
		<tr>
			<th className="settings-studio-device__name c3 notifications-s notifications-text">{packageContainer.id}</th>
			<td className="settings-studio-device__id c2 deleted">{packageContainer.defaults?.container.label}</td>
			<td className="settings-studio-device__id c2 deleted">{packageContainer.id}</td>
			<td className="settings-studio-output-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}

interface PackageContainerRowProps {
	studio: DBStudio
	packageContainer: WrappedOverridableItemNormal<StudioPackageContainer>
	overrideHelper: OverrideOpHelper
	toggleExpanded: (id: string, forceState?: boolean) => void
	isExpanded: (id: string) => boolean
	confirmRemovePackageContainer: (id: string) => void
	confirmReset: (id: string) => void
}

function PackageContainerRow({
	studio,
	packageContainer,
	overrideHelper,
	toggleExpanded,
	isExpanded,
	confirmRemovePackageContainer,
	confirmReset,
}: PackageContainerRowProps): React.JSX.Element {
	const { t } = useTranslation()

	const availablePlayoutDevicesOptions: DropdownInputOption<string>[] = React.useMemo(() => {
		const playoutDevicesFromOverrrides = applyAndValidateOverrides(studio.peripheralDeviceSettings.playoutDevices).obj

		const devices: DropdownInputOption<string>[] = []

		for (const deviceId of Object.keys(playoutDevicesFromOverrrides)) {
			devices.push({
				name: deviceId,
				value: deviceId,
				i: devices.length,
			})
		}
		return devices
	}, [studio.peripheralDeviceSettings.playoutDevices])

	const updatePackageContainerId = React.useCallback(
		(newPackageContainerId: string) => {
			overrideHelper().changeItemId(packageContainer.id, newPackageContainerId).commit()
			toggleExpanded(newPackageContainerId, true)
		},
		[overrideHelper, toggleExpanded, packageContainer.id]
	)

	return (
		<React.Fragment key={packageContainer.id}>
			<tr
				className={ClassNames({
					hl: isExpanded(packageContainer.id),
				})}
			>
				<th className="settings-studio-package-container__id c2">{packageContainer.id}</th>
				<td className="settings-studio-package-container__name c2">{packageContainer.computed.container.label}</td>

				<td className="settings-studio-package-container__actions table-item-actions c3">
					{packageContainer.defaults && packageContainer.overrideOps.length > 0 && (
						<button
							className="action-btn"
							onClick={() => confirmReset(packageContainer.id)}
							title={t('Reset Package Container to default values')}
						>
							<FontAwesomeIcon icon={faSync} />
						</button>
					)}
					<button className="action-btn" onClick={() => toggleExpanded(packageContainer.id)}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={() => confirmRemovePackageContainer(packageContainer.id)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded(packageContainer.id) && (
				<tr className="expando-details hl">
					<td colSpan={6}>
						<div className="properties-grid">
							<label className="field">
								<LabelActual label={t('Package Container ID')} />
								<TextInputControl
									value={packageContainer.id}
									handleUpdate={updatePackageContainerId}
									disabled={!!packageContainer.defaults}
								/>
							</label>
							<LabelAndOverrides
								label={t('Label')}
								item={packageContainer}
								//@ts-expect-error can't be 2 levels deep
								itemKey={'container.label'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
							</LabelAndOverrides>
							<LabelAndOverridesForMultiSelect
								label={t('Playout devices which uses this package container')}
								hint={t('Select which playout devices are using this package container')}
								item={packageContainer}
								itemKey={'deviceIds'}
								overrideHelper={overrideHelper}
								options={availablePlayoutDevicesOptions}
							>
								{(value, handleUpdate, options) => (
									<MultiSelectInputControl options={options} value={value} handleUpdate={handleUpdate} />
								)}
							</LabelAndOverridesForMultiSelect>
						</div>
						<div>
							<div className="settings-studio-accessors">
								<h3>{t('Accessors')}</h3>
								<AccessorsTable packageContainer={packageContainer} overrideHelper={overrideHelper} />
							</div>
						</div>
					</td>
				</tr>
			)}
		</React.Fragment>
	)
}
