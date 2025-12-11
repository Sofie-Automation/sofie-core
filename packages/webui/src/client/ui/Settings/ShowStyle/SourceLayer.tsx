import React, { useCallback, useMemo } from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faExclamationTriangle, faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { assertNever, literal, getRandomString } from '@sofie-automation/corelib/dist/lib'
import Tooltip from 'rc-tooltip'
import { TFunction, useTranslation } from 'react-i18next'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { getHelpMode } from '../../../lib/localStorage.js'
import { doModalDialog } from '../../../lib/ModalDialog.js'
import { findHighestRank } from '../StudioSettings.js'
import { useToggleExpandHelper } from '../../util/useToggleExpandHelper.js'
import { ObjectOverrideSetOp, SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	getAllCurrentAndDeletedItemsFromOverrides,
	OverrideOpHelper,
	useOverrideOpHelper,
	WrappedOverridableItemNormal,
} from '../util/OverrideOpHelper.js'
import { TextInputControl } from '../../../lib/Components/TextInput.js'
import { CheckboxControl } from '../../../lib/Components/Checkbox.js'
import { IntInputControl } from '../../../lib/Components/IntInput.js'
import { DropdownInputControl, getDropdownInputOptions } from '../../../lib/Components/DropdownInput.js'
import {
	LabelActual,
	LabelAndOverrides,
	LabelAndOverridesForCheckbox,
	LabelAndOverridesForDropdown,
	LabelAndOverridesForInt,
} from '../../../lib/Components/LabelAndOverrides.js'
import { ShowStyleBases } from '../../../collections/index.js'

function sourceLayerString(t: TFunction<'translation', undefined>, type: SourceLayerType) {
	switch (type) {
		case SourceLayerType.CAMERA:
			return t('Camera')
		case SourceLayerType.GRAPHICS:
			return t('Graphics')
		case SourceLayerType.LIVE_SPEAK:
			return t('Live Speak')
		case SourceLayerType.LOWER_THIRD:
			return t('Lower Third')
		// case SourceLayerType.MIC:
		// 	return t('Studio Microphone')
		case SourceLayerType.REMOTE_SPEAK:
			return t('Remote Speak')
		case SourceLayerType.REMOTE:
			return t('Remote Source')
		case SourceLayerType.SCRIPT:
			return t('Generic Script')
		case SourceLayerType.SPLITS:
			return t('Split Screen')
		case SourceLayerType.VT:
			return t('Clips')
		case SourceLayerType.UNKNOWN:
			return t('Unknown Layer')
		case SourceLayerType.AUDIO:
			return t('Audio Mixing')
		case SourceLayerType.LIGHTS:
			return t('Lighting')
		case SourceLayerType.TRANSITION:
			return t('Transition')
		// case SourceLayerType.LIGHTS:
		// 	return t('Lights')
		case SourceLayerType.LOCAL:
			return t('Local')
		case SourceLayerType.STUDIO_SCREEN:
			return t('Studio Screen Graphics')
		default:
			assertNever(type)
			return SourceLayerType[type]
	}
}

interface IStudioSourcesSettingsProps {
	showStyleBase: DBShowStyleBase
}

export function SourceLayerSettings({ showStyleBase }: Readonly<IStudioSourcesSettingsProps>): JSX.Element {
	const { t } = useTranslation()

	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	const sortedSourceLayers = useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides(
				showStyleBase.sourceLayersWithOverrides,
				(a, b) => a[1]._rank - b[1]._rank
			),
		[showStyleBase.sourceLayersWithOverrides]
	)

	const maxRank = useMemo(
		() =>
			findHighestRank(
				sortedSourceLayers
					.filter((item): item is WrappedOverridableItemNormal<ISourceLayer> => item.type === 'normal')
					.map((item) => item.computed)
			),
		[sortedSourceLayers]
	)

	const onAddSource = useCallback(() => {
		const newSource = literal<ISourceLayer>({
			_id: `${showStyleBase._id}-${getRandomString(5)}`,
			_rank: maxRank ? maxRank._rank + 10 : 0,
			name: t('New Source'),
			type: SourceLayerType.UNKNOWN,
		})

		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: newSource._id,
			value: newSource,
		})

		ShowStyleBases.update(showStyleBase._id, {
			$push: {
				'sourceLayersWithOverrides.overrides': addOp,
			},
		})
	}, [maxRank, showStyleBase._id])

	const saveOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			ShowStyleBases.update(showStyleBase._id, {
				$set: {
					'sourceLayersWithOverrides.overrides': newOps,
				},
			})
		},
		[showStyleBase._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, showStyleBase.sourceLayersWithOverrides)

	const doUndelete = useCallback((itemId: string) => overrideHelper().resetItem(itemId).commit(), [overrideHelper])

	return (
		<div>
			<h2 className="mb-4">
				<Tooltip
					overlay={t('Add some source layers (e.g. Graphics) for your data to appear in rundowns')}
					visible={getHelpMode() && !sortedSourceLayers.length}
					placement="bottom"
				>
					<span>{t('Source Layers')}</span>
				</Tooltip>
			</h2>
			{!sortedSourceLayers.length ? (
				<div className="error-notice">
					<FontAwesomeIcon icon={faExclamationTriangle} /> {t('No source layers set')}
				</div>
			) : null}
			<table className="expando settings-studio-source-table">
				<tbody>
					{sortedSourceLayers.map((item) =>
						item.type === 'deleted' ? (
							<SourceLayerDeletedEntry key={item.id} item={item.defaults} doUndelete={doUndelete} />
						) : (
							<SourceLayerEntry
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
				<button className="btn btn-primary" onClick={onAddSource}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</div>
	)
}

interface DeletedEntryProps {
	item: ISourceLayer
	doUndelete: (itemId: string) => void
}
function SourceLayerDeletedEntry({ item, doUndelete }: Readonly<DeletedEntryProps>) {
	const { t } = useTranslation()

	const doUndeleteItem = useCallback(() => doUndelete(item._id), [doUndelete, item._id])

	return (
		<tr>
			<th className="settings-studio-source-table__name c2 deleted">{item.name}</th>
			<td className="settings-studio-source-table__id c4 deleted">{item._id}</td>
			<td className="settings-studio-source-table__type c3">
				{sourceLayerString(t, Number.parseInt(item.type.toString(), 10) as SourceLayerType)}
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
	item: WrappedOverridableItemNormal<ISourceLayer>
	isExpanded: boolean
	toggleExpanded: (itemId: string, force?: boolean) => void
	overrideHelper: OverrideOpHelper
}
function SourceLayerEntry({ item, isExpanded, toggleExpanded, overrideHelper }: Readonly<EntryProps>) {
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
			title: t('Delete this item?'),
			no: t('Cancel'),
			yes: t('Delete'),
			onAccept: () => {
				overrideHelper().deleteItem(item.id).commit()
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to delete source layer "{{sourceLayerId}}"?', {
							sourceLayerId: item.computed.name,
						})}
					</p>
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
						{t('Are you sure you want to reset all overrides for the source layer "{{sourceLayerId}}"?', {
							sourceLayerId: item.computed.name,
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
				<th className="settings-studio-source-table__name c2">{item.computed.name}</th>
				<td className="settings-studio-source-table__id c4">{item.computed._id}</td>
				<td className="settings-studio-source-table__type c3">
					{sourceLayerString(t, Number.parseInt(item.computed.type.toString(), 10) as SourceLayerType)}
				</td>
				<td className="settings-studio-source-table__actions table-item-actions c3">
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
					<button className="action-btn" onClick={toggleEditItem} title={t('Edit source layer')}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={confirmDelete} title={t('Delete source layer')}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded && (
				<tr className="expando-details hl">
					<td colSpan={4}>
						<div className="properties-grid">
							<LabelAndOverrides label={t('Source Name')} item={item} itemKey={'name'} overrideHelper={overrideHelper}>
								{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
							</LabelAndOverrides>
							<LabelAndOverrides
								label={t('Source Abbreviation')}
								item={item}
								itemKey={'abbreviation'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
							</LabelAndOverrides>
							<label className="field">
								<LabelActual label={t('Internal ID')} />
								<TextInputControl value={item.id} handleUpdate={doChangeItemId} disabled={!!item.defaults} />
							</label>
							<LabelAndOverridesForDropdown
								label={t('Source Type')}
								item={item}
								itemKey={'type'}
								overrideHelper={overrideHelper}
								options={getDropdownInputOptions(SourceLayerType)}
							>
								{(value, handleUpdate, options) => (
									<DropdownInputControl options={options} value={value} handleUpdate={handleUpdate} />
								)}
							</LabelAndOverridesForDropdown>
							<LabelAndOverridesForCheckbox
								label={t('Is a Live Remote Input')}
								item={item}
								itemKey={'isRemoteInput'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('Is a Guest Input')}
								item={item}
								itemKey={'isGuestInput'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('Is hidden')}
								item={item}
								itemKey={'isHidden'}
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
								label={t('Treat as Main content')}
								item={item}
								itemKey={'onPresenterScreen'}
								overrideHelper={overrideHelper}
								hint="When set, Pieces on this Source Layer will be used to display summaries, thumbnails etc for the Part in GUIs. "
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('Display in a column in List View')}
								item={item}
								itemKey={'onListViewColumn'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('Display AdLibs in a column in List View')}
								item={item}
								itemKey={'onListViewAdLibColumn'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('Pieces on this layer can be cleared')}
								item={item}
								itemKey={'isClearable'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('Pieces on this layer are sticky')}
								item={item}
								itemKey={'isSticky'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('Only Pieces present in rundown are sticky')}
								item={item}
								itemKey={'stickyOriginalOnly'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('Allow disabling of Pieces')}
								item={item}
								itemKey={'allowDisable'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverridesForCheckbox
								label={t('AdLibs on this layer can be queued')}
								item={item}
								itemKey={'isQueueable'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <CheckboxControl value={!!value} handleUpdate={handleUpdate} />}
							</LabelAndOverridesForCheckbox>
							<LabelAndOverrides
								label={t('Exclusivity group')}
								item={item}
								itemKey={'exclusiveGroup'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
							</LabelAndOverrides>
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
