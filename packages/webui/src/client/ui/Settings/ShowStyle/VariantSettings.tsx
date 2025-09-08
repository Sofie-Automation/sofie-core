import { useCallback, useEffect, useState } from 'react'
import { faTrash, faPlus, faDownload, faUpload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	BlueprintManifestType,
	IShowStyleConfigPreset,
	IShowStyleVariantConfigPreset,
	JSONSchema,
} from '@sofie-automation/blueprints-integration'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { useTranslation } from 'react-i18next'
import { MeteorCall } from '../../../lib/meteorApi.js'
import { DBShowStyleBase, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { doModalDialog } from '../../../lib/ModalDialog.js'
import { ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { NoticeLevel, NotificationCenter, Notification } from '../../../lib/notifications/notifications.js'
import { UploadButton } from '../../../lib/uploadButton.js'
import update from 'immutability-helper'
import { VariantListItem } from './VariantListItem.js'
import { downloadBlob } from '../../../lib/downloadBlob.js'
import { SomeObjectOverrideOp } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { Blueprints, ShowStyleVariants } from '../../../collections/index.js'
import Button from 'react-bootstrap/esm/Button'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

interface IShowStyleVariantsProps {
	showStyleBase: DBShowStyleBase
	showStyleVariants: DBShowStyleVariant[]
	blueprintConfigSchema: JSONSchema | undefined
	blueprintTranslationNamespaces: string[]
	blueprintConfigPreset: IShowStyleConfigPreset | undefined // TODO - use this

	layerMappings?: { [studioId: string]: MappingsExt }
	sourceLayers?: SourceLayers
}

export const ShowStyleVariantsSettings = ({
	showStyleBase,
	showStyleVariants,
	blueprintConfigSchema,
	blueprintTranslationNamespaces,
	layerMappings,
	sourceLayers,
}: Readonly<IShowStyleVariantsProps>): JSX.Element => {
	const [localVariants, setLocalVariants] = useState<DBShowStyleVariant[]>([])
	const [editedVariants, setEditedVariants] = useState<ShowStyleVariantId[]>([])
	const { t } = useTranslation()

	useEffect(() => {
		setLocalVariants(showStyleVariants.slice())
	}, [showStyleVariants])

	const blueprintPresetConfigOptions = useTracker<{ name: string; value: string | null }[]>(
		() => {
			const options: { name: string; value: string | null }[] = []

			if (showStyleBase.blueprintId && showStyleBase.blueprintConfigPresetId) {
				const blueprint = Blueprints.findOne({
					blueprintType: BlueprintManifestType.SHOWSTYLE,
					_id: showStyleBase.blueprintId,
				})

				if (blueprint?.showStyleConfigPresets) {
					const basePreset = blueprint.showStyleConfigPresets[showStyleBase.blueprintConfigPresetId]
					if (basePreset) {
						for (const [id, preset] of Object.entries<IShowStyleVariantConfigPreset>(basePreset.variants)) {
							options.push({
								value: id,
								name: preset.name,
							})
						}
					}
				}
			}

			return options
		},
		[showStyleBase],
		[]
	)

	const onCopyShowStyleVariant = useCallback(
		(showStyleVariant: DBShowStyleVariant): void => {
			showStyleVariant.name = `Copy of ${showStyleVariant.name}`
			showStyleVariant._rank = localVariants.length
			MeteorCall.showstyles.importShowStyleVariantAsNew(showStyleVariant).catch((error) => {
				NotificationCenter.push(
					new Notification(
						undefined,
						NoticeLevel.CRITICAL,
						t('Failed to copy Show Style Variant: {{errorMessage}}', { errorMessage: error + '' }),
						'VariantSettings'
					)
				)
			})
		},
		[localVariants]
	)

	const onDownloadShowStyleVariant = useCallback((showStyleVariant: DBShowStyleVariant): void => {
		const showStyleVariants = [showStyleVariant]
		const jsonStr = JSON.stringify(showStyleVariants)
		const fileName = `${showStyleVariant.name}_ShowStyleVariant_${showStyleVariant._id}.json`
		const blob = new Blob([jsonStr], { type: 'application/json' })
		downloadBlob(blob, fileName)
	}, [])

	const onDownloadAllShowStyleVariants = useCallback((): void => {
		const jsonStr = JSON.stringify(localVariants)
		const fileName = `All_ShowStyleVariants_${showStyleBase._id}.json`
		const blob = new Blob([jsonStr], { type: 'application/json' })
		downloadBlob(blob, fileName)
	}, [localVariants, showStyleBase._id])

	const onAddShowStyleVariant = useCallback((): void => {
		MeteorCall.showstyles.insertShowStyleVariant(showStyleBase._id).catch((error) => {
			NotificationCenter.push(
				new Notification(
					undefined,
					NoticeLevel.CRITICAL,
					t('Failed to add a new Show Style Variant: {{errorMessage}}', { errorMessage: error + '' }),
					'VariantSettings'
				)
			)
		})
	}, [showStyleBase._id])

	const onDeleteShowStyleVariant = (showStyleVariant: DBShowStyleVariant): void => {
		doModalDialog({
			title: t('Remove this Show Style Variant?'),
			no: t('Cancel'),
			yes: t('Remove'),
			onAccept: () => {
				MeteorCall.showstyles.removeShowStyleVariant(showStyleVariant._id).catch((error) => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.CRITICAL,
							t('Failed to delete Show Style Variant: {{errorMessage}}', { errorMessage: error + '' }),
							'VariantSettings'
						)
					)
				})
			},
			message: (
				<p>
					{t('Are you sure you want to remove the Variant "{{showStyleVariantId}}"?', {
						showStyleVariantId: showStyleVariant.name,
					})}
				</p>
			),
		})
	}

	const removeAllShowStyleVariants = useCallback((): void => {
		localVariants.forEach((variant) => {
			MeteorCall.showstyles.removeShowStyleVariant(variant._id).catch((error) => {
				NotificationCenter.push(
					new Notification(
						undefined,
						NoticeLevel.CRITICAL,
						t('Failed to remove all Show Style Variants: {{errorMessage}}', { errorMessage: error + '' }),
						'VariantSettings'
					)
				)
			})
		})
	}, [localVariants])

	const onRemoveAllShowStyleVariants = useCallback((): void => {
		doModalDialog({
			title: t('Remove all Show Style Variants?'),
			no: t('Cancel'),
			yes: t('Remove'),
			onAccept: () => {
				removeAllShowStyleVariants()
			},
			message: <p>{t('Are you sure you want to remove all Variants in the table?')}</p>,
		})
	}, [removeAllShowStyleVariants])

	const onFinishEditItem = useCallback(
		(variantId: ShowStyleVariantId): void => {
			const isEdited = editedVariants.includes(variantId)
			if (isEdited) {
				setEditedVariants(editedVariants.filter((item) => item !== variantId))
			}
		},
		[editedVariants]
	)

	const onEditItem = useCallback(
		(variantId: ShowStyleVariantId): void => {
			const isEdited = editedVariants.includes(variantId)
			if (!isEdited) {
				setEditedVariants([...editedVariants, variantId])
			} else {
				onFinishEditItem(variantId)
			}
		},
		[editedVariants]
	)

	const onDragVariant = useCallback(
		(draggingId: ShowStyleVariantId, hoverId: ShowStyleVariantId): void => {
			if (draggingId === hoverId) {
				return
			}
			const dragIndex = localVariants.findIndex((variant) => variant._id === draggingId)
			const hoverIndex = localVariants.findIndex((variant) => variant._id === hoverId)
			setLocalVariants(
				update(localVariants, {
					$splice: [
						[dragIndex, 1],
						[hoverIndex, 0, localVariants[dragIndex]],
					],
				})
			)
		},
		[localVariants]
	)

	const onDragEnd = useCallback(
		(draggedVariantId: ShowStyleVariantId) => {
			const draggedIndex = localVariants.findIndex((variant) => variant._id === draggedVariantId)

			const itemBefore = localVariants[draggedIndex - 1]
			const itemAfter = localVariants[draggedIndex + 1]

			let newRank: number = localVariants[draggedIndex]._rank
			if (itemBefore && itemAfter) {
				newRank = (itemBefore._rank + itemAfter._rank) / 2
			} else if (itemBefore && !itemAfter) {
				newRank = itemBefore._rank + 1
			} else if (!itemBefore && itemAfter) {
				newRank = itemAfter._rank - 1
			}

			MeteorCall.showstyles.reorderShowStyleVariant(draggedVariantId, newRank).catch((error) => {
				NotificationCenter.push(
					new Notification(
						undefined,
						NoticeLevel.CRITICAL,
						t('Failed to reorderShow Style Variant: {{errorMessage}}', { errorMessage: error + '' }),
						'VariantSettings'
					)
				)
			})
		},
		[localVariants]
	)

	const onDragCancel = useCallback(() => {
		setLocalVariants(showStyleVariants.slice())
	}, [showStyleVariants])

	const saveBlueprintConfigOverrides = (variantId: ShowStyleVariantId, newOps: SomeObjectOverrideOp[]) => {
		ShowStyleVariants.update(variantId, {
			$set: {
				'blueprintConfigWithOverrides.overrides': newOps,
			},
		})
	}

	return (
		<div>
			<h2 className="mb-4">{t('Show Style Variants')}</h2>
			<div>
				<table className="table expando settings-studio-showStyleVariants-table">
					{localVariants.map((variant: DBShowStyleVariant) => (
						<VariantListItem
							key={unprotectString(variant._id)}
							isEdited={editedVariants.includes(variant._id)}
							showStyleVariant={variant}
							onDragVariant={onDragVariant}
							onDragEnd={onDragEnd}
							onDragCancel={onDragCancel}
							blueprintPresetConfigOptions={blueprintPresetConfigOptions}
							baseBlueprintConfigWithOverrides={showStyleBase.blueprintConfigWithOverrides}
							blueprintConfigSchema={blueprintConfigSchema}
							blueprintTranslationNamespaces={blueprintTranslationNamespaces}
							layerMappings={layerMappings}
							sourceLayers={sourceLayers}
							onCopy={onCopyShowStyleVariant}
							onDelete={onDeleteShowStyleVariant}
							onDownload={onDownloadShowStyleVariant}
							onEdit={onEditItem}
							onFinishEdit={onFinishEditItem}
							onSaveOverrides={saveBlueprintConfigOverrides}
						/>
					))}
				</table>
			</div>
			<div className="my-1 mx-2">
				<Button variant="primary" className="mx-1" onClick={onAddShowStyleVariant}>
					<FontAwesomeIcon icon={faPlus} />
				</Button>
				<Button variant="outline-secondary" className="mx-1" onClick={onDownloadAllShowStyleVariants}>
					<FontAwesomeIcon icon={faDownload} />
					<span>{t('Export')}</span>
				</Button>
				<ImportVariantsButton localVariantCount={localVariants.length} />
				<Button variant="outline-secondary" className="mx-1" onClick={onRemoveAllShowStyleVariants}>
					<FontAwesomeIcon icon={faTrash} />
				</Button>
			</div>
		</div>
	)
}

function ImportVariantsButton({ localVariantCount }: { localVariantCount: number }) {
	const { t } = useTranslation()

	const importShowStyleVariantsError = useCallback((err: Error): void => {
		NotificationCenter.push(
			new Notification(
				undefined,
				NoticeLevel.CRITICAL,
				t('Failed to import new Show Style Variants: {{errorMessage}}', { errorMessage: stringifyError(err) }),
				'VariantSettings'
			)
		)
	}, [])

	const importShowStyleVariantsFromArray = useCallback(
		(showStyleVariants: DBShowStyleVariant[]): void => {
			showStyleVariants.forEach((showStyleVariant: DBShowStyleVariant, index: number) => {
				showStyleVariant._rank = localVariantCount + index
				MeteorCall.showstyles.importShowStyleVariant(showStyleVariant).catch(() => {
					NotificationCenter.push(
						new Notification(
							undefined,
							NoticeLevel.CRITICAL,
							t('Failed to import Show Style Variant {{name}}. Make sure it is not already imported.', {
								name: showStyleVariant.name,
							}),
							'VariantSettings'
						)
					)
				})
			})
		},
		[localVariantCount]
	)

	const importShowStyleVariantsContents = useCallback(
		(fileContents: string): void => {
			const newShowStyleVariants: DBShowStyleVariant[] = JSON.parse(fileContents)
			if (!Array.isArray(newShowStyleVariants)) {
				throw new Error('Imported file did not contain an array')
			}

			importShowStyleVariantsFromArray(newShowStyleVariants)
		},
		[importShowStyleVariantsFromArray]
	)

	return (
		<UploadButton
			className="btn btn-outline-secondary mx-1"
			accept="application/json,.json"
			onUploadError={importShowStyleVariantsError}
			onUploadContents={importShowStyleVariantsContents}
		>
			<FontAwesomeIcon icon={faUpload} />
			<span>{t('Import')}</span>
		</UploadButton>
	)
}
