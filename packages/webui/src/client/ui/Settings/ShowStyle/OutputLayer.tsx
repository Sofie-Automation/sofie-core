import React, { useCallback, useMemo } from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faExclamationTriangle, faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IOutputLayer } from '@sofie-automation/blueprints-integration'
import { getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { getHelpMode } from '../../../lib/localStorage.js'
import { doModalDialog } from '../../../lib/ModalDialog.js'
import { findHighestRank } from '../StudioSettings.js'
import { ObjectOverrideSetOp, SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { CheckboxControl } from '../../../lib/Components/Checkbox.js'
import {
	useOverrideOpHelper,
	getAllCurrentAndDeletedItemsFromOverrides,
	OverrideOpHelper,
	WrappedOverridableItemNormal,
} from '../util/OverrideOpHelper.js'
import { TextInputControl } from '../../../lib/Components/TextInput.js'
import { IntInputControl } from '../../../lib/Components/IntInput.js'
import { useToggleExpandHelper } from '../../util/useToggleExpandHelper.js'
import {
	LabelActual,
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForInt,
} from '../../../lib/Components/LabelAndOverrides.js'
import { ShowStyleBases } from '../../../collections/index.js'

interface IOutputSettingsProps {
	showStyleBase: DBShowStyleBase
}

export function OutputLayerSettings({ showStyleBase }: Readonly<IOutputSettingsProps>): JSX.Element {
	const { t } = useTranslation()

	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const sortedOutputLayers = useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides(
				showStyleBase.outputLayersWithOverrides,
				(a, b) => a[1]._rank - b[1]._rank
			),
		[showStyleBase.outputLayersWithOverrides]
	)

	const maxRank = useMemo(
		() =>
			findHighestRank(
				sortedOutputLayers
					.filter((item): item is WrappedOverridableItemNormal<IOutputLayer> => item.type === 'normal')
					.map((item) => item.computed)
			),
		[sortedOutputLayers]
	)

	const onAddOutput = useCallback(() => {
		const newOutput = literal<IOutputLayer>({
			_id: `${showStyleBase._id}-${getRandomString(5)}`,
			_rank: maxRank ? maxRank._rank + 10 : 0,
			name: t('New Output'),
			isPGM: false,
		})

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newOutput._id,
			value: newOutput,
		})

		ShowStyleBases.update(showStyleBase._id, {
			$push: {
				'outputLayersWithOverrides.overrides': addOp,
			},
		})
	}, [maxRank, showStyleBase._id])

	const isPGMChannelSet = useMemo(() => {
		return !!sortedOutputLayers.find((layer) => layer.computed && layer.computed.isPGM)
	}, [sortedOutputLayers])

	const saveOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			ShowStyleBases.update(showStyleBase._id, {
				$set: {
					'outputLayersWithOverrides.overrides': newOps,
				},
			})
		},
		[showStyleBase._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, showStyleBase.outputLayersWithOverrides)

	const doUndelete = useCallback((itemId: string) => overrideHelper().resetItem(itemId).commit(), [overrideHelper])

	return (
		<div>
			<h2 className="mb-4">
				<Tooltip
					overlay={t('Output channels are required for your studio to work')}
					visible={getHelpMode() && !sortedOutputLayers.length}
					placement="top"
				>
					<span>{t('Output channels')}</span>
				</Tooltip>
			</h2>
			{!sortedOutputLayers.length ? (
				<div className="error-notice">
					<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No output channels set')}
				</div>
			) : null}
			{!isPGMChannelSet ? (
				<div className="error-notice">
					<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No PGM output')}
				</div>
			) : null}
			<table className="expando settings-studio-output-table">
				<tbody>
					{sortedOutputLayers.map((item) =>
						item.type === 'deleted' ? (
							<OutputLayerDeletedEntry key={item.id} item={item.defaults} doUndelete={doUndelete} />
						) : (
							<OutputLayerEntry
								key={item.id}
								item={item}
								isExpanded={isExpanded(item.id)}
								toggleExpanded={toggleExpanded}
								overrideHelper={overrideHelper}
							/>
						)
					)}
				</tbody>
			</table>
			<div className="my-1 mx-2">
				<button className="btn btn-primary" onClick={onAddOutput}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</div>
	)
}

interface DeletedEntryProps {
	item: IOutputLayer
	doUndelete: (itemId: string) => void
}
function OutputLayerDeletedEntry({ item, doUndelete }: Readonly<DeletedEntryProps>) {
	const doUndeleteItem = useCallback(() => doUndelete(item._id), [doUndelete, item._id])

	return (
		<tr>
			<th className="settings-studio-output-table__name c2 deleted">{item.name}</th>
			<td className="settings-studio-output-table__id c4 deleted">{item._id}</td>
			<td className="settings-studio-output-table__isPGM c3">
				<div
					className={ClassNames('switch', 'switch-tight', {
						'switch-active': item.isPGM,
					})}
				>
					PGM
				</div>
			</td>
			<td className="settings-studio-output-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title="Restore to defaults">
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}

interface EntryProps {
	item: WrappedOverridableItemNormal<IOutputLayer>
	isExpanded: boolean
	toggleExpanded: (itemId: string, forceState?: boolean) => void
	overrideHelper: OverrideOpHelper
}
function OutputLayerEntry({ item, isExpanded, toggleExpanded, overrideHelper }: Readonly<EntryProps>) {
	const { t } = useTranslation()

	const toggleEditItem = useCallback(() => toggleExpanded(item.id), [toggleExpanded, item.id])
	const doResetItem = useCallback(() => overrideHelper().resetItem(item.id).commit(), [overrideHelper, item.id])
	const doChangeItemId = useCallback(
		(newItemId: string) => {
			overrideHelper().changeItemId(item.id, newItemId).commit()
			toggleExpanded(newItemId, true)
		},
		[overrideHelper, toggleExpanded, item.id]
	)

	const confirmDelete = useCallback(() => {
		doModalDialog({
			title: t('Delete this output?'),
			no: t('Cancel'),
			yes: t('Delete'),
			onAccept: () => {
				overrideHelper().deleteItem(item.id).commit()
			},
			message: (
				<React.Fragment>
					<p>{t('Are you sure you want to delete output layer "{{outputId}}"?', { outputId: item.computed.name })}</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}, [t, item.id, item.computed.name, overrideHelper])
	const confirmReset = useCallback(() => {
		doModalDialog({
			title: t('Reset this item?'),
			yes: t('Reset'),
			no: t('Cancel'),
			onAccept: () => {
				overrideHelper().resetItem(item.id).commit()
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to reset all overrides for the output layer "{{outputLayerId}}"?', {
							outputLayerId: item.computed.name,
						})}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}, [t, item.id, overrideHelper])

	return (
		<>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-output-table__name c2">{item.computed.name}</th>
				<td className="settings-studio-output-table__id c4">{item.computed._id}</td>
				<td className="settings-studio-output-table__isPGM c3">
					<div
						className={ClassNames('switch', 'switch-tight', {
							'switch-active': item.computed.isPGM,
						})}
					>
						PGM
					</div>
				</td>
				<td className="settings-studio-output-table__actions table-item-actions c3">
					{!item.defaults && (
						<button className="action-btn" disabled>
							<FontAwesomeIcon icon={faSync} title={t('Source layer cannot be reset as it has no default values')} />
						</button>
					)}
					{item.defaults && item.overrideOps.length > 0 && (
						<button className="action-btn" onClick={confirmReset} title={t('Reset source layer to default values')}>
							<FontAwesomeIcon icon={faSync} />
						</button>
					)}
					<button className="action-btn" onClick={toggleEditItem} title={t('Edit output layer')}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={confirmDelete} title={t('Delete output layer')}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded && (
				<tr className="expando-details hl">
					<td colSpan={4}>
						<div className="properties-grid">
							<LabelAndOverrides label={t('Channel Name')} item={item} itemKey={'name'} overrideHelper={overrideHelper}>
								{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
							</LabelAndOverrides>
							<label className="field">
								<LabelActual label={t('Internal ID')} />
								<TextInputControl value={item.id} handleUpdate={doChangeItemId} disabled={!!item.defaults} />
							</label>
							<LabelAndOverridesForCheckbox
								label={t('Is PGM Output')}
								item={item}
								itemKey={'isPGM'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForInt
								label={t('Display Rank')}
								item={item}
								itemKey={'_rank'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <IntInputControl value={value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForInt>
							<LabelAndOverridesForCheckbox
								label={t('Is collapsed by default')}
								item={item}
								itemKey={'isDefaultCollapsed'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('Is flattened')}
								item={item}
								itemKey={'isFlattened'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
						</div>
						<div className="m-1 me-2 text-end">
							{item.defaults && (
								<button className="btn btn-primary" onClick={doResetItem} title="Reset to defaults">
									<FontAwesomeIcon icon={faSync} />
								</button>
							)}
							&nbsp;
							<button className="btn btn-primary" onClick={toggleEditItem}>
								<FontAwesomeIcon icon={faCheck} />
							</button>
						</div>
					</td>
				</tr>
			)}
		</>
	)
}
