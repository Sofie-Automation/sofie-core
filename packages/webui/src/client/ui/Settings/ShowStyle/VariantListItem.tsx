import React, { useRef } from 'react'
import classNames from 'classnames'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { DragSourceMonitor, DropTargetMonitor, useDrag, useDrop } from 'react-dnd'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { EditAttribute } from '../../../lib/EditAttribute.js'
import { BlueprintConfigSchemaSettings } from '../BlueprintConfigSchema/index.js'
import { ShowStyleDragDropTypes } from './DragDropTypesShowStyle.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faCheck,
	faCopy,
	faDownload,
	faExclamationTriangle,
	faPencilAlt,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import {
	applyAndValidateOverrides,
	ObjectWithOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useTranslation } from 'react-i18next'
import { IBlueprintConfig, JSONSchema } from '@sofie-automation/blueprints-integration'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { iconDragHandle } from '../../RundownList/icons.js'
import { ShowStyleVariants } from '../../../collections/index.js'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { LabelActual } from '../../../lib/Components/LabelAndOverrides.js'

interface DraggableVariant {
	id: ShowStyleVariantId
	rank: number
}

interface DraggableDropResult {
	overId: ShowStyleVariantId
}

export const VariantListItem = ({
	showStyleVariant,
	onDragVariant,
	onDragEnd,
	onDragCancel,
	isEdited,

	blueprintConfigSchema,
	blueprintTranslationNamespaces,
	baseBlueprintConfigWithOverrides,
	blueprintPresetConfigOptions,
	layerMappings,
	sourceLayers,

	onDownload,
	onCopy,
	onEdit,
	onFinishEdit,
	onDelete,
	onSaveOverrides,
}: Readonly<{
	showStyleVariant: DBShowStyleVariant
	onDragVariant: (draggingId: ShowStyleVariantId, hoverId: ShowStyleVariantId) => void
	onDragEnd: (draggedId: ShowStyleVariantId) => void
	onDragCancel: () => void
	isEdited: boolean
	blueprintConfigSchema: JSONSchema | undefined
	blueprintTranslationNamespaces: string[]
	baseBlueprintConfigWithOverrides: ObjectWithOverrides<IBlueprintConfig>
	blueprintPresetConfigOptions: { name: string; value: string | null }[]
	layerMappings?: { [studioId: string]: MappingsExt }
	sourceLayers?: SourceLayers

	onDownload: (showStyleVariant: DBShowStyleVariant) => void
	onCopy: (showStyleVariantId: DBShowStyleVariant) => void
	onEdit: (showStyleVariantId: ShowStyleVariantId) => void
	onFinishEdit: (showStyleVariantId: ShowStyleVariantId) => void
	onDelete: (showStyleVariant: DBShowStyleVariant) => void
	onSaveOverrides: (showStyleVariantId: ShowStyleVariantId, newOps: SomeObjectOverrideOp[]) => void
}>): JSX.Element => {
	const ref = useRef<HTMLTableRowElement>(null)
	const [{ handlerId }, drop] = useDrop<DraggableVariant, DraggableDropResult, { handlerId: string | symbol | null }>({
		accept: ShowStyleDragDropTypes.VARIANT,
		collect: (monitor: DropTargetMonitor) => ({ handlerId: monitor.getHandlerId() }),
		hover(hoverVariant: DraggableVariant) {
			if (!ref.current) {
				return
			}
			onDragVariant(hoverVariant.id, showStyleVariant._id)
		},
		drop: () => {
			return {
				overId: showStyleVariant._id,
			}
		},
	})

	const [{ isDragging }, drag] = useDrag<DraggableVariant, DraggableDropResult, { isDragging: boolean }>({
		type: ShowStyleDragDropTypes.VARIANT,
		item: { id: showStyleVariant._id, rank: showStyleVariant._rank },
		collect: (monitor: DragSourceMonitor) => ({
			isDragging: monitor.isDragging(),
		}),
		end: (item, monitor) => {
			const result = monitor.getDropResult() as DraggableDropResult
			if (!item || !monitor.didDrop() || !result) {
				onDragCancel()
				return
			}
			onDragEnd(item.id)
		},
	})

	const opacity = isDragging ? 0.4 : 1

	drag(drop(ref))

	const { t } = useTranslation()

	return (
		<React.Fragment key={unprotectString(showStyleVariant._id)}>
			<tbody>
				<tr
					data-handler-id={handlerId}
					ref={ref}
					style={{ opacity }}
					className={classNames({
						hl: isEdited,
					})}
				>
					<th className="settings-studio-showStyleVariant__name c3">
						<span className="settings-studio-showStyleVariants-table__drag">{iconDragHandle()}</span>
						{showStyleVariant.name || t('Unnamed variant')}&nbsp;
						{(!showStyleVariant.blueprintConfigPresetId || showStyleVariant.blueprintConfigPresetIdUnlinked) && (
							<FontAwesomeIcon icon={faExclamationTriangle} />
						)}
					</th>
					<td className="settings-studio-showStyleVariant__actions table-item-actions c3">
						<button className="action-btn" onClick={() => onDownload(showStyleVariant)}>
							<FontAwesomeIcon icon={faDownload} />
						</button>
						<button className="action-btn" onClick={() => onCopy(showStyleVariant)}>
							<FontAwesomeIcon icon={faCopy} />
						</button>
						<button className="action-btn" onClick={() => onEdit(showStyleVariant._id)}>
							<FontAwesomeIcon icon={faPencilAlt} />
						</button>
						<button className="action-btn" onClick={() => onDelete(showStyleVariant)}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
					</td>
				</tr>
			</tbody>
			<tbody>
				{isEdited && (
					<tr className="expando-details hl">
						<td colSpan={5}>
							<div className="properties-grid">
								<label className="field">
									<LabelActual label={t('Name')} />
									<EditAttribute
										attribute={'name'}
										obj={showStyleVariant}
										type="text"
										collection={ShowStyleVariants}
									></EditAttribute>
								</label>

								<label className="field">
									<LabelActual label={t('Can Generate Adlib Testing Rundown')} />
									<EditAttribute
										attribute={'canGenerateAdlibTestingRundown'}
										obj={showStyleVariant}
										type="checkbox"
										collection={ShowStyleVariants}
									></EditAttribute>
									<span className="text-s dimmed field-hint">
										{t('This requires the blueprints to implement the `generateAdlibTestingIngestRundown` method')}
									</span>
								</label>

								<h3 className="my-2">{t('Blueprint Configuration')}</h3>

								<label className="field">
									<LabelActual label={t('Config preset')} />

									<EditAttribute
										attribute="blueprintConfigPresetId"
										obj={showStyleVariant}
										type="dropdown"
										options={blueprintPresetConfigOptions}
										mutateDisplayValue={(v) => v || ''}
										mutateUpdateValue={(v) => (v === '' ? undefined : v)}
										collection={ShowStyleVariants}
									/>
									<div>
										{!showStyleVariant.blueprintConfigPresetId && (
											<div className="error-notice inline">
												{t('Config preset not set')} <FontAwesomeIcon icon={faExclamationTriangle} />
											</div>
										)}
										{showStyleVariant.blueprintConfigPresetIdUnlinked && showStyleVariant.blueprintConfigPresetId && (
											<div className="error-notice inline">
												{t('Config preset is missing')} <FontAwesomeIcon icon={faExclamationTriangle} />
											</div>
										)}
									</div>
								</label>
							</div>

							<BlueprintConfigSchemaSettings
								schema={blueprintConfigSchema}
								translationNamespaces={blueprintTranslationNamespaces}
								alternateConfig={applyAndValidateOverrides(baseBlueprintConfigWithOverrides).obj}
								layerMappings={layerMappings}
								sourceLayers={sourceLayers}
								configObject={showStyleVariant.blueprintConfigWithOverrides}
								saveOverrides={(newOps) => onSaveOverrides(showStyleVariant._id, newOps)}
							/>

							<div className="m-1 me-2 text-end">
								<button className="btn btn-primary" onClick={() => onFinishEdit(showStyleVariant._id)}>
									<FontAwesomeIcon icon={faCheck} />
								</button>
							</div>
						</td>
					</tr>
				)}
			</tbody>
		</React.Fragment>
	)
}
