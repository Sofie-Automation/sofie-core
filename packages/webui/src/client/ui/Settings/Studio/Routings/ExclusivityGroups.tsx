import ClassNames from 'classnames'
import * as React from 'react'
import {
	DBStudio,
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { doModalDialog } from '../../../../lib/ModalDialog.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash, faPencilAlt, faCheck, faSync, faPlus } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { Studios } from '../../../../collections/index.js'
import { LabelActual, LabelAndOverrides } from '../../../../lib/Components/LabelAndOverrides.js'
import {
	OverrideOpHelper,
	WrappedOverridableItem,
	WrappedOverridableItemDeleted,
	WrappedOverridableItemNormal,
	useOverrideOpHelper,
} from '../../util/OverrideOpHelper.js'
import {
	applyAndValidateOverrides,
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { TextInputControl } from '../../../../lib/Components/TextInput.js'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { useToggleExpandHelper } from '../../../util/useToggleExpandHelper.js'

interface ExclusivityGroupsTableProps {
	studio: DBStudio
	routeSetsFromOverrides: WrappedOverridableItem<StudioRouteSet>[]
	exclusivityGroupsFromOverrides: WrappedOverridableItem<StudioRouteSetExclusivityGroup>[]
}

export function ExclusivityGroupsTable({
	studio,
	routeSetsFromOverrides,
	exclusivityGroupsFromOverrides,
}: Readonly<ExclusivityGroupsTableProps>): React.JSX.Element {
	const { t } = useTranslation()
	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const addNewExclusivityGroup = React.useCallback(() => {
		const newGroupKeyName = 'exclusivityGroup'
		const resolvedGroups = applyAndValidateOverrides(studio.routeSetExclusivityGroupsWithOverrides).obj

		let iter = 0
		while (resolvedGroups[newGroupKeyName + iter.toString()]) {
			iter++
		}

		const newId = newGroupKeyName + iter.toString()
		const newGroup: StudioRouteSetExclusivityGroup = {
			name: 'New Exclusivity Group' + iter.toString(),
		}
		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newId,
			value: newGroup,
		})

		Studios.update(studio._id, {
			$push: {
				'routeSetExclusivityGroupsWithOverrides.overrides': addOp,
			},
		})

		setTimeout(() => {
			toggleExpanded(newId, true)
		}, 1)
	}, [studio._id, studio.routeSetExclusivityGroupsWithOverrides])

	const saveExclusivityOverrides = React.useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			Studios.update(studio._id, {
				$set: {
					'routeSetExclusivityGroupsWithOverrides.overrides': newOps,
				},
			})
		},
		[studio._id]
	)

	const exclusivityOverrideHelper = useOverrideOpHelper(
		saveExclusivityOverrides,
		studio.routeSetExclusivityGroupsWithOverrides
	)

	return (
		<>
			<table className="expando settings-studio-mappings-table">
				<tbody>
					{exclusivityGroupsFromOverrides.length === 0 ? (
						<tr>
							<td className="dimmed">{t('There are no exclusivity groups set up.')}</td>
						</tr>
					) : (
						exclusivityGroupsFromOverrides.map(
							(exclusivityGroup: WrappedOverridableItem<StudioRouteSetExclusivityGroup>) =>
								exclusivityGroup.type === 'normal' ? (
									<ExclusivityGroupRow
										key={exclusivityGroup.id}
										exclusivityGroup={exclusivityGroup}
										toggleExpanded={toggleExpanded}
										isExpanded={isExpanded(exclusivityGroup.id)}
										routeSetsFromOverrides={routeSetsFromOverrides}
										exclusivityOverrideHelper={exclusivityOverrideHelper}
									/>
								) : (
									<ExclusivityGroupDeletedRow
										key={exclusivityGroup.id}
										exclusivityGroup={exclusivityGroup}
										exlusivityOverrideHelper={exclusivityOverrideHelper}
									/>
								)
						)
					)}
				</tbody>
			</table>
			<div className="my-1 mx-2">
				<button className="btn btn-primary" onClick={addNewExclusivityGroup}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</>
	)
}

interface ExclusivityGroupRowProps {
	exclusivityGroup: WrappedOverridableItemNormal<StudioRouteSetExclusivityGroup>
	toggleExpanded: (exclusivityGroupId: string, force?: boolean) => void
	isExpanded: boolean
	routeSetsFromOverrides: WrappedOverridableItem<StudioRouteSet>[]
	exclusivityOverrideHelper: OverrideOpHelper
}

function ExclusivityGroupRow({
	exclusivityGroup,
	toggleExpanded,
	isExpanded,
	routeSetsFromOverrides,
	exclusivityOverrideHelper,
}: Readonly<ExclusivityGroupRowProps>): React.JSX.Element {
	const { t } = useTranslation()

	const removeExclusivityGroup = (eGroupId: string) => {
		exclusivityOverrideHelper().deleteItem(eGroupId).commit()
	}

	const confirmRemoveEGroup = () => {
		doModalDialog({
			title: t('Remove this Exclusivity Group?'),
			yes: t('Remove'),
			no: t('Cancel'),
			onAccept: () => {
				removeExclusivityGroup(exclusivityGroup.id)
			},
			message: (
				<>
					<p>
						{t(
							'Are you sure you want to remove exclusivity group "{{eGroupName}}"?\nRoute Sets assigned to this group will be reset to no group.',
							{
								eGroupName: exclusivityGroup.computed?.name,
							}
						)}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</>
			),
		})
	}
	const updateExclusivityGroupId = React.useCallback(
		(newGroupId: string) => {
			exclusivityOverrideHelper().changeItemId(exclusivityGroup.id, newGroupId).commit()
			toggleExpanded(newGroupId, true)
		},
		[exclusivityOverrideHelper, toggleExpanded, exclusivityGroup.id]
	)

	return (
		<>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-device__name c3">{exclusivityGroup.id}</th>
				<td className="settings-studio-device__id c5">{exclusivityGroup.computed?.name}</td>
				<td className="settings-studio-device__id c3">
					{
						routeSetsFromOverrides.filter(
							(routeSet) => routeSet.computed?.exclusivityGroup === exclusivityGroup.computed?.name
						).length
					}
				</td>

				<td className="settings-studio-device__actions table-item-actions c3">
					<button className="action-btn" onClick={() => toggleExpanded(exclusivityGroup.id)}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={confirmRemoveEGroup}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded && (
				<tr className="expando-details hl">
					<td colSpan={6}>
						<div className="properties-grid">
							<label className="field">
								<LabelActual label={t('Exclusivity Group ID')} />
								<TextInputControl
									value={exclusivityGroup.id}
									handleUpdate={updateExclusivityGroupId}
									disabled={!!exclusivityGroup.defaults}
								/>
							</label>
							<LabelAndOverrides
								label={t('Exclusivity Group Name')}
								item={exclusivityGroup}
								itemKey={'name'}
								overrideHelper={exclusivityOverrideHelper}
							>
								{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
							</LabelAndOverrides>
						</div>
						<div className="m-1 me-2 text-end">
							<button className="btn btn-primary" onClick={() => toggleExpanded(exclusivityGroup.id)}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</>
	)
}

interface ExclusivityGroupDeletedRowProps {
	exclusivityGroup: WrappedOverridableItemDeleted<StudioRouteSetExclusivityGroup>
	exlusivityOverrideHelper: OverrideOpHelper
}

function ExclusivityGroupDeletedRow({
	exclusivityGroup,
	exlusivityOverrideHelper: overrideHelper,
}: Readonly<ExclusivityGroupDeletedRowProps>): React.JSX.Element {
	const doUndeleteItem = React.useCallback(
		() => overrideHelper().resetItem(exclusivityGroup.id).commit(),
		[overrideHelper, exclusivityGroup.id]
	)

	return (
		<tr>
			<th className="settings-studio-device__name c3 notifications-s notifications-text">
				{exclusivityGroup.defaults?.name}
			</th>
			<td className="settings-studio-device__id c2 deleted">{exclusivityGroup.defaults?.name}</td>
			<td className="settings-studio-device__id c2 deleted">{exclusivityGroup.id}</td>
			<td className="settings-studio-output-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}
