import type * as React from 'react'
import { doUserAction, UserAction } from '../../lib/clientUserAction.js'
import { MeteorCall } from '../../lib/meteorApi.js'
import {
	type DefaultUserOperationEditProperties,
	DefaultUserOperationsTypes,
	type JSONBlob,
	JSONBlobParse,
	type JSONSchema,
	type UserEditingDefinitionAction,
	type UserEditingProperties,
	type UserEditingSourceLayer,
	UserEditingType,
	type UserOperationTarget,
} from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import {
	useSelectedElements,
	useSelectedElementsContext,
	useSelectedObjectsUserEditProps,
} from '../RundownView/SelectedElementsContext.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SchemaFormWithState } from '../../lib/forms/SchemaFormWithState.js'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { BlueprintAssetIcon } from '../../lib/Components/BlueprintAssetIcon.js'
import type { ReadonlyDeep } from 'type-fest'
import type {
	CoreUserEditingDefinition,
	CoreUserEditingProperties,
} from '@sofie-automation/corelib/dist/dataModel/UserEditingDefinitions.js'
import { RundownUtils } from '../../lib/rundown.js'

type PendingChange = DefaultUserOperationEditProperties['payload']

export function PropertiesPanel(): JSX.Element {
	const { listSelectedElements, clearSelections } = useSelectedElementsContext()
	const selectedElement = listSelectedElements()?.[0]
	const { t } = useTranslation()

	const [pendingChange, setPendingChange] = useState<PendingChange | undefined>(undefined)
	const hasPendingChanges = !!pendingChange

	const clearPendingChange = useCallback(() => {
		setPendingChange(undefined)
	}, [])

	const { selectedObjects, rundownId } = useSelectedElements(selectedElement, clearPendingChange)

	const [hadSmallestElement, setHadSmallestElement] = useState(false)

	useEffect(() => {
		if (
			selectedObjects.piece ||
			selectedObjects.adLibPiece ||
			selectedObjects.rundownBaselineAdLibPiece ||
			selectedObjects.adLibAction ||
			selectedObjects.rundownBaselineAdLibAction
		)
			setHadSmallestElement(true)
	}, [
		selectedObjects.piece,
		selectedObjects.adLibPiece,
		selectedObjects.rundownBaselineAdLibPiece,
		selectedObjects.adLibAction,
		selectedObjects.rundownBaselineAdLibAction,
	])

	useEffect(() => {
		const pieceChangedId =
			selectedElement?.type !== 'segment' &&
			selectedElement?.type !== 'part' &&
			hadSmallestElement &&
			selectedObjects.piece === undefined &&
			selectedObjects.adLibPiece === undefined &&
			selectedObjects.rundownBaselineAdLibPiece === undefined &&
			selectedObjects.adLibAction === undefined &&
			selectedObjects.rundownBaselineAdLibAction === undefined

		if (pieceChangedId) {
			setHadSmallestElement(false)
			clearSelections()
		}
	}, [
		selectedElement,
		selectedObjects.piece,
		selectedObjects.adLibPiece,
		selectedObjects.rundownBaselineAdLibPiece,
		selectedObjects.adLibAction,
		selectedObjects.rundownBaselineAdLibAction,
		hadSmallestElement,
		clearSelections,
	])

	const handleCommitChanges = async (e: React.MouseEvent) => {
		if (!rundownId || !selectedElement || !pendingChange) return

		const target = getTargetForSelectedElement(selectedElement.type, selectedObjects)
		if (!target) return

		doUserAction(
			t,
			e,
			UserAction.EXECUTE_USER_OPERATION,
			(e, ts) =>
				MeteorCall.userAction.executeUserChangeOperation(
					e,
					ts,
					rundownId,
					target,
					literal<DefaultUserOperationEditProperties>({
						id: DefaultUserOperationsTypes.UPDATE_PROPS,
						payload: pendingChange,
					})
				),
			() => setPendingChange(undefined)
		)
	}

	const handleRevertChanges = (e: React.MouseEvent) => {
		if (!rundownId || !selectedElement) return

		let target = getTargetForSelectedElement(selectedElement.type, selectedObjects)
		if (!target) return

		// Revert can only happen on a per-part or per-segment basis, so if the target is a piece, we need to convert it to a part or segment target
		if (target.segmentExternalId) {
			target =
				target.target !== 'segment' && 'partExternalId' in target && target.partExternalId !== undefined
					? {
							target: 'part',
							segmentExternalId: target.segmentExternalId,
							partExternalId: target.partExternalId,
						}
					: {
							target: 'segment',
							segmentExternalId: target.segmentExternalId,
						}
		} else {
			// we can't revert
			return
		}

		setPendingChange(undefined)

		doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
			MeteorCall.userAction.executeUserChangeOperation(e, ts, rundownId, target, {
				id:
					selectedElement.type === 'segment'
						? DefaultUserOperationsTypes.REVERT_SEGMENT
						: DefaultUserOperationsTypes.REVERT_PART,
			})
		)
	}

	const handleCancel = () => {
		setPendingChange(undefined)
		clearSelections()
	}

	const executeAction = (e: React.MouseEvent, id: string) => {
		if (!rundownId || !selectedElement) return

		const target = getTargetForSelectedElement(selectedElement.type, selectedObjects)
		if (!target) return

		doUserAction(t, e, UserAction.EXECUTE_USER_OPERATION, (e, ts) =>
			MeteorCall.userAction.executeUserChangeOperation(e, ts, rundownId, target, {
				id,
			})
		)
	}

	const { title, userEditOperations, userEditProperties } = useSelectedObjectsUserEditProps(
		selectedElement?.type,
		selectedObjects
	)

	const change = pendingChange ?? {
		pieceTypeProperties: userEditProperties?.pieceTypeProperties?.currentValue ?? { type: '', value: {} },
		globalProperties: userEditProperties?.globalProperties?.currentValue ?? {},
	}

	return (
		<div className={'properties-panel'}>
			<div className="propertiespanel-pop-up">
				<div className="propertiespanel-pop-up__header">
					{userEditOperations &&
						userEditOperations.map((operation) => {
							if (
								(operation.type !== UserEditingType.ACTION && operation.type !== UserEditingType.STATE) ||
								!operation.icon ||
								!operation.isActive
							)
								return null
							return <BlueprintAssetIcon key={operation.id} src={operation.icon} className="svg" />
						})}
					<div className="title">{typeof title === 'object' ? translateMessage(title, t) : title}</div>
					<span className="properties">{t('Properties')}</span>
					<button
						className="propertiespanel-pop-up_close"
						title={t('Close Properties Panel')}
						onClick={clearSelections}
					>
						<FontAwesomeIcon icon="close" size="lg" />
					</button>
				</div>

				<div className="propertiespanel-pop-up__contents">
					{userEditProperties?.pieceTypeProperties && (
						<PropertiesEditor
							properties={userEditProperties.pieceTypeProperties}
							change={change}
							setChange={setPendingChange}
							translationNamespace={userEditProperties.translationNamespaces}
						/>
					)}
					{userEditProperties?.globalProperties && (
						<GlobalPropertiesEditor
							schema={userEditProperties.globalProperties.schema}
							change={change}
							setChange={setPendingChange}
							translationNamespace={userEditProperties.translationNamespaces}
						/>
					)}
					{userEditProperties?.operations && (
						<ActionList actions={userEditProperties?.operations} executeAction={executeAction} />
					)}
				</div>

				<div className="propertiespanel-pop-up__footer">
					<button
						className="propertiespanel-pop-up__button propertiespanel-pop-up__button_restore start"
						title={selectedElement?.type === 'segment' ? t('Restore Segment from NRCS') : t('Restore Part from NRCS')}
						disabled={!selectedElement}
						onClick={handleRevertChanges}
					>
						<svg className="svg" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path
								d="M2 14.5251H15C16.3261 14.5251 17.5979 13.9984 18.5355 13.0607C19.4732 12.123 20 10.8512 20 9.52515C20 8.19906 19.4732 6.92729 18.5355 5.98961C17.5979 5.05193 16.3261 4.52515 15 4.52515H10V0.475147L5 5.47515L10 10.4751V6.52515H15C15.7956 6.52515 16.5587 6.84122 17.1213 7.40383C17.6839 7.96643 18 8.7295 18 9.52515C18 10.3208 17.6839 11.0839 17.1213 11.6465C16.5587 12.2091 15.7956 12.5251 15 12.5251H2V14.5251Z"
								fill="#979797"
							/>
						</svg>
						<span className="propertiespanel-pop-up__label-with-icon">
							{selectedElement?.type === 'segment' ? t('Restore Segment from NRCS') : t('Restore Part from NRCS')}
						</span>
					</button>

					<div className="propertiespanel-pop-up__button-group">
						<button
							className="propertiespanel-pop-up__button end"
							onClick={handleCancel}
							disabled={!hasPendingChanges}
							title={t('Cancel')}
						>
							<span className="propertiespanel-pop-up__label">{t('Cancel')}</span>
						</button>
						<button
							className="propertiespanel-pop-up__button end"
							onClick={handleCommitChanges}
							disabled={!hasPendingChanges}
							title={t('Save')}
						>
							<span className="propertiespanel-pop-up__label">{t('Save')}</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

function PropertiesEditor({
	properties,
	change,
	setChange,
	translationNamespace,
}: {
	properties: UserEditingProperties['pieceTypeProperties']
	change: PendingChange
	setChange: React.Dispatch<React.SetStateAction<PendingChange | undefined>>
	translationNamespace: string[]
}): JSX.Element {
	if (!properties) return <></>

	const selectedGroupId = change.pieceTypeProperties.type
	const selectedGroupSchema = properties.schema[selectedGroupId]?.schema
	const parsedSchema = useMemo(
		() => (selectedGroupSchema ? JSONBlobParse(selectedGroupSchema) : undefined),
		[selectedGroupSchema]
	)

	const updateGroup = useCallback(
		(key: string) => {
			setChange({
				...change,
				pieceTypeProperties: {
					type: key,
					value: properties.schema[key]?.defaultValue ?? {},
				},
			})
		},
		[change]
	)
	const onUpdate = useCallback(
		(update: Record<string, any>) => {
			setChange({
				...change,
				pieceTypeProperties: {
					type: change.pieceTypeProperties.type,
					value: update,
				},
			})
		},
		[change]
	)
	const value = change.pieceTypeProperties.value

	return (
		<>
			<div className="propertiespanel-pop-up__groupselector">
				{Object.entries<UserEditingSourceLayer>(properties.schema).map(([key, group]) => {
					return (
						<button
							className={classNames(
								'propertiespanel-pop-up__groupselector__button',
								RundownUtils.getSourceLayerClassName(group.sourceLayerType),
								selectedGroupId === key && 'active'
							)}
							key={key}
							onClick={() => {
								updateGroup(key)
							}}
						>
							{group.sourceLayerLabel}
						</button>
					)
				})}
			</div>
			<hr />
			{parsedSchema && (
				<div className="properties-panel-pop-up__form styled-schema-form">
					<SchemaFormWithState
						key={(selectedGroupSchema as any as string) ?? 'key'}
						schema={parsedSchema}
						object={value}
						onUpdate={onUpdate}
						translationNamespaces={translationNamespace}
					/>
				</div>
			)}
			<hr />
		</>
	)
}

function GlobalPropertiesEditor({
	schema,
	change,
	setChange,
	translationNamespace,
}: {
	schema: JSONBlob<JSONSchema>
	change: PendingChange
	setChange: React.Dispatch<React.SetStateAction<PendingChange | undefined>>
	translationNamespace: string[]
}): JSX.Element {
	const parsedSchema = schema ? JSONBlobParse(schema) : undefined
	const currentValue = change.globalProperties

	const onUpdate = useCallback(
		(update: Record<string, any>) => {
			setChange({
				...change,
				globalProperties: update,
			})
		},
		[change]
	)

	return (
		<div className="properties-panel-pop-up__form styled-schema-form" style={{ color: 'white' }}>
			{parsedSchema && (
				<SchemaFormWithState
					key={(schema as any as string) ?? 'key'}
					schema={parsedSchema}
					object={currentValue}
					onUpdate={onUpdate}
					translationNamespaces={translationNamespace}
				/>
			)}
		</div>
	)
}

function ActionList({
	actions,
	executeAction,
}: {
	actions: UserEditingDefinitionAction[]
	executeAction: (e: any, id: string) => void
}) {
	const { t } = useTranslation()

	return (
		<div className="propertiespanel-pop-up__buttons-container">
			{actions.map((action) => (
				<button
					title={'User Operation: ' + translateMessage(action.label, t)}
					className="propertiespanel-pop-up__button"
					onClick={(e) => executeAction(e, action.id)}
					key={action.id}
				>
					{action.icon && <BlueprintAssetIcon src={action.icon} className="svg" />}
					<span className="propertiespanel-pop-up__label">{translateMessage(action.label, t)}</span>
				</button>
			))}
		</div>
	)
}

export function hasUserEditableContent(
	obj:
		| ReadonlyDeep<{
				userEditOperations?: CoreUserEditingDefinition[]
				userEditProperties?: CoreUserEditingProperties
		  }>
		| undefined
): boolean {
	return !!(
		obj?.userEditProperties?.pieceTypeProperties ||
		obj?.userEditProperties?.globalProperties ||
		obj?.userEditProperties?.operations?.length
	)
}

function getTargetForSelectedElement(
	type: ReturnType<typeof useSelectedElements>['type'] | undefined,
	selectedObjects: ReturnType<typeof useSelectedElements>['selectedObjects']
): UserOperationTarget | undefined {
	if (!type) return undefined

	let target: UserOperationTarget
	if (type === 'segment' && selectedObjects.segment) {
		target = {
			target: 'segment' as const,
			segmentExternalId: selectedObjects.segment.externalId,
		}
	} else if ((type === 'part' || type === 'partInstance') && selectedObjects.segment && selectedObjects.part) {
		target = {
			target: 'part' as const,
			segmentExternalId: selectedObjects.segment.externalId,
			partExternalId: selectedObjects.part.externalId,
		}
	} else if (type === 'piece' && selectedObjects.segment && selectedObjects.part && selectedObjects.piece) {
		target = {
			target: 'piece' as const,
			segmentExternalId: selectedObjects.segment.externalId,
			partExternalId: selectedObjects.part.externalId,
			pieceExternalId: selectedObjects.piece.externalId,
		}
	} else if (type === 'adLibPiece' && selectedObjects.adLibPiece) {
		target = {
			target: 'adlibPiece' as const,
			segmentExternalId: selectedObjects.segment?.externalId,
			partExternalId: selectedObjects.part?.externalId,
			adlibPieceExternalId: selectedObjects.adLibPiece.externalId,
		}
	} else if (type === 'adLibAction' && selectedObjects.adLibAction) {
		target = {
			target: 'adlibAction' as const,
			segmentExternalId: selectedObjects.segment?.externalId,
			partExternalId: selectedObjects.part?.externalId,
			adlibActionExternalId: selectedObjects.adLibAction.externalId,
		}
	} else if (type === 'rundownBaselineAdLibPiece' && selectedObjects.rundownBaselineAdLibPiece) {
		target = {
			target: 'adlibPiece' as const,
			segmentExternalId: selectedObjects.segment?.externalId,
			partExternalId: selectedObjects.part?.externalId,
			adlibPieceExternalId: selectedObjects.rundownBaselineAdLibPiece.externalId,
		}
	} else if (type === 'rundownBaselineAdLibAction' && selectedObjects.rundownBaselineAdLibAction) {
		target = {
			target: 'adlibAction' as const,
			segmentExternalId: selectedObjects.segment?.externalId,
			partExternalId: selectedObjects.part?.externalId,
			adlibActionExternalId: selectedObjects.rundownBaselineAdLibAction.externalId,
		}
	} else {
		return
	}

	return target
}
