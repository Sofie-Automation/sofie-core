import React, { useCallback, useMemo } from 'react'
import ClassNames from 'classnames'
import { faPencilAlt, faTrash, faCheck, faPlus, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { BlueprintManifestType, type JSONSchema } from '@sofie-automation/blueprints-integration'
import { getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import { useTranslation } from 'react-i18next'
import type { DBShowStyleBase, IBranding, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import type { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { doModalDialog } from '../../../lib/ModalDialog.js'
import type {
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	useOverrideOpHelper,
	getAllCurrentAndDeletedItemsFromOverrides,
	type OverrideOpHelper,
	type WrappedOverridableItemNormal,
} from '../util/OverrideOpHelper.js'
import { TextInputControl } from '../../../lib/Components/TextInput.js'
import { useToggleExpandHelper } from '../../util/useToggleExpandHelper.js'
import { LabelActual, LabelAndOverrides } from '../../../lib/Components/LabelAndOverrides.js'
import { Blueprints, ShowStyleBases } from '../../../collections/index.js'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { BlueprintConfigSchemaSettingsForItem } from '../BlueprintConfigSchema/index.js'
import type { BlueprintId } from '@sofie-automation/corelib/src/dataModel/Ids.js'

interface IBrandingSettingsProps {
	showStyleBase: DBShowStyleBase
	layerMappings?: { [studioId: string]: MappingsExt }
	sourceLayers?: SourceLayers
}

function useBrandingConfigSchema(blueprintId: BlueprintId): JSONSchema | undefined {
	return useTracker(() => {
		const blueprint = Blueprints.findOne(
			{
				_id: blueprintId,
				blueprintType: BlueprintManifestType.SHOWSTYLE,
			},
			{
				projection: {
					brandingConfigSchema: 1,
				},
			}
		)

		return blueprint?.brandingConfigSchema ? JSONBlobParse(blueprint.brandingConfigSchema) : undefined
	}, [blueprintId])
}

export function ShowStyleBrandingSettings({
	showStyleBase,
	layerMappings,
	sourceLayers,
}: Readonly<IBrandingSettingsProps>): JSX.Element {
	const { t } = useTranslation()

	const { toggleExpanded, isExpanded } = useToggleExpandHelper()

	/** Schema for the config of each Branding, as provided by the blueprint */
	const brandingConfigSchema = useBrandingConfigSchema(showStyleBase.blueprintId)

	const blueprintTranslationNamespaces = useMemo(
		() => ['blueprint_' + showStyleBase.blueprintId],
		[showStyleBase.blueprintId]
	)

	const sortedBrandings = useMemo(
		() =>
			getAllCurrentAndDeletedItemsFromOverrides(showStyleBase.branding, (a, b) => a[1].name.localeCompare(b[1].name)),
		[showStyleBase.branding]
	)

	const onAddBranding = useCallback(() => {
		const addOp = literal<ObjectOverrideSetOp>({
			op: 'set',
			path: `${showStyleBase._id}-${getRandomString(5)}`,
			value: literal<IBranding>({
				name: t('New Branding'),
				config: {},
			}),
		})

		ShowStyleBases.update(showStyleBase._id, {
			$push: {
				'branding.overrides': addOp,
			},
		})
	}, [showStyleBase._id])

	const saveOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			ShowStyleBases.update(showStyleBase._id, {
				$set: {
					'branding.overrides': newOps,
				},
			})
		},
		[showStyleBase._id]
	)

	const overrideHelper = useOverrideOpHelper(saveOverrides, showStyleBase.branding)

	const doUndelete = useCallback((itemId: string) => overrideHelper().resetItem(itemId).commit(), [overrideHelper])

	return (
		<div>
			<h2 className="mb-4">{t('Branding')}</h2>
			<table className="expando settings-studio-source-table">
				<tbody>
					{sortedBrandings.map((item) =>
						item.type === 'deleted' ? (
							<BrandingDeletedEntry key={item.id} itemId={item.id} item={item.defaults} doUndelete={doUndelete} />
						) : (
							<BrandingEntry
								key={item.id}
								item={item}
								isExpanded={isExpanded(item.id)}
								toggleExpanded={toggleExpanded}
								overrideHelper={overrideHelper}
								brandingConfigSchema={brandingConfigSchema}
								blueprintTranslationNamespaces={blueprintTranslationNamespaces}
								layerMappings={layerMappings}
								sourceLayers={sourceLayers}
							/>
						)
					)}
				</tbody>
			</table>
			<div className="my-1 mx-2">
				<button className="btn btn-primary" onClick={onAddBranding}>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
		</div>
	)
}

interface DeletedEntryProps {
	itemId: string
	item: Pick<IBranding, 'name'>
	doUndelete: (itemId: string) => void
}
function BrandingDeletedEntry({ itemId, item, doUndelete }: Readonly<DeletedEntryProps>) {
	const { t } = useTranslation()

	const doUndeleteItem = useCallback(() => doUndelete(itemId), [doUndelete, itemId])

	return (
		<tr>
			<th className="settings-studio-source-table__name c3 deleted">{item.name}</th>
			<td className="settings-studio-source-table__id c4 deleted">{itemId}</td>
			<td className="settings-studio-source-table__actions table-item-actions c3">
				<button className="action-btn" onClick={doUndeleteItem} title={t('Restore to defaults')}>
					<FontAwesomeIcon icon={faSync} />
				</button>
			</td>
		</tr>
	)
}

interface EntryProps {
	item: WrappedOverridableItemNormal<IBranding>
	isExpanded: boolean
	toggleExpanded: (itemId: string, forceState?: boolean) => void
	overrideHelper: OverrideOpHelper
	/** Schema for the config of each Branding, as provided by the blueprint */
	brandingConfigSchema: JSONSchema | undefined
	blueprintTranslationNamespaces: string[]
	layerMappings?: { [studioId: string]: MappingsExt }
	sourceLayers?: SourceLayers
}
function BrandingEntry({
	item,
	isExpanded,
	toggleExpanded,
	overrideHelper,
	brandingConfigSchema,
	blueprintTranslationNamespaces,
	layerMappings,
	sourceLayers,
}: Readonly<EntryProps>) {
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
			title: t('Delete this branding?'),
			no: t('Cancel'),
			yes: t('Delete'),
			onAccept: () => {
				overrideHelper().deleteItem(item.id).commit()
			},
			message: (
				<React.Fragment>
					<p>
						{t('Are you sure you want to delete the branding "{{brandingId}}"?', { brandingId: item.computed.name })}
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
						{t('Are you sure you want to reset all overrides for the branding "{{brandingId}}"?', {
							brandingId: item.computed.name,
						})}
					</p>
					<p>{t('Please note: This action is irreversible!')}</p>
				</React.Fragment>
			),
		})
	}, [t, item.id, item.computed.name, overrideHelper])

	return (
		<>
			<tr
				className={ClassNames({
					hl: isExpanded,
				})}
			>
				<th className="settings-studio-source-table__name c3">{item.computed.name}</th>
				<td className="settings-studio-source-table__id c4">{item.id}</td>
				<td className="settings-studio-source-table__actions table-item-actions c3">
					{!item.defaults && (
						<button className="action-btn" disabled>
							<FontAwesomeIcon icon={faSync} title={t('Branding cannot be reset as it has no default values')} />
						</button>
					)}
					{item.defaults && item.overrideOps.length > 0 && (
						<button className="action-btn" onClick={confirmReset} title={t('Reset branding to default values')}>
							<FontAwesomeIcon icon={faSync} />
						</button>
					)}
					<button className="action-btn" onClick={toggleEditItem} title={t('Edit branding')}>
						<FontAwesomeIcon icon={faPencilAlt} />
					</button>
					<button className="action-btn" onClick={confirmDelete} title={t('Delete branding')}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</td>
			</tr>
			{isExpanded && (
				<tr className="expando-details hl">
					<td colSpan={3}>
						<div className="properties-grid">
							<LabelAndOverrides
								label={t('Branding Name')}
								item={item}
								itemKey={'name'}
								overrideHelper={overrideHelper}
							>
								{(value, handleUpdate) => <TextInputControl value={value} handleUpdate={handleUpdate} />}
							</LabelAndOverrides>
							<label className="field">
								<LabelActual label={t('Internal ID')} />
								<TextInputControl value={item.id} handleUpdate={doChangeItemId} disabled={!!item.defaults} />
							</label>
						</div>

						<h3 className="my-2">{t('Blueprint Configuration')}</h3>

						<BlueprintConfigSchemaSettingsForItem
							schema={brandingConfigSchema}
							translationNamespaces={blueprintTranslationNamespaces}
							layerMappings={layerMappings}
							sourceLayers={sourceLayers}
							item={item}
							attr={'config'}
							overrideHelper={overrideHelper}
						/>

						<div className="m-1 me-2 text-end">
							{item.defaults && (
								<button className="btn btn-primary" onClick={doResetItem} title={t('Reset to defaults')}>
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
