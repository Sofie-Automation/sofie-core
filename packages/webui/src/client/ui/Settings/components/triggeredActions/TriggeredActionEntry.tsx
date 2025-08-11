import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { faCopy, faPencilAlt, faPlus, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	PlayoutActions,
	SomeAction,
	SomeBlueprintTrigger,
	SourceLayerType,
	TriggerType,
} from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import { DBBlueprintTrigger } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { useTracker, useTrackerAsync } from '../../../../lib/ReactMeteorData/ReactMeteorData.js'
import { ActionEditor } from './actionEditors/ActionEditor.js'
import { OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { flatten, getRandomString } from '../../../../lib/tempLib.js'
import {
	createAction,
	isPreviewableAction,
	PlainActionContext,
} from '@sofie-automation/meteor-lib/dist/triggers/actionFactory'
import { PreviewContext } from './TriggeredActionsEditor.js'
import { IWrappedAdLib } from '@sofie-automation/meteor-lib/dist/triggers/actionFilterChainCompilers'
import { RundownUtils } from '../../../../lib/rundown.js'
import { useTranslation } from 'react-i18next'
import { TriggerEditor } from './triggerEditors/TriggerEditor.js'
import { EditAttribute } from '../../../../lib/EditAttribute.js'
import { iconDragHandle } from '../../../RundownList/icons.js'
import { useDrag, useDrop } from 'react-dnd'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import {
	applyAndValidateOverrides,
	ObjectOverrideSetOp,
	SomeObjectOverrideOp,
	wrapDefaultObject,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleBaseId, TriggeredActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { isHotkeyTrigger } from '@sofie-automation/meteor-lib/dist/triggers/triggerTypeSelectors'
import { getAllCurrentAndDeletedItemsFromOverrides, useOverrideOpHelper } from '../../util/OverrideOpHelper.js'
import { TriggeredActions } from '../../../../collections/index.js'
import { catchError } from '../../../../lib/lib.js'
import { toTriggersComputation, UiTriggersContext } from '../../../../lib/triggers/triggersContext.js'
import { last, literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { LabelActual } from '../../../../lib/Components/LabelAndOverrides.js'

interface IProps {
	sourceLayers: SourceLayers | undefined
	outputLayers: OutputLayers | undefined
	triggeredActionId: TriggeredActionId
	selected?: boolean
	previewContext: PreviewContext | null
	locked?: boolean
	onEdit: (id: TriggeredActionId, e: React.UIEvent) => void
	onRemove: (id: TriggeredActionId, e: React.UIEvent) => void
	onDuplicate: (id: TriggeredActionId, e: React.UIEvent) => void
	onFocus?: (id: TriggeredActionId) => void
}

let LAST_UP_SETTING = false

export const TRIGGERED_ACTION_ENTRY_DRAG_TYPE = 'TriggeredActionEntry'

interface ITriggeredActionEntryDragObject {
	id: TriggeredActionId
}

interface ITriggeredActionEntryDropResult {
	overId: TriggeredActionId
	overRank: number | null
	overShowStyleBaseId: ShowStyleBaseId | null
}

export const TriggeredActionEntry: React.FC<IProps> = React.memo(function TriggeredActionEntry({
	sourceLayers,
	outputLayers,
	triggeredActionId,
	selected,
	locked,
	previewContext,
	onEdit,
	onRemove,
	onDuplicate,
	onFocus,
}: IProps): React.ReactElement | null {
	const triggeredAction = useTracker(() => TriggeredActions.findOne(triggeredActionId), [triggeredActionId])

	const { t } = useTranslation()
	const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null)
	const [selectedAction, setSelectedAction] = useState<string | null>(null)

	const [{ isDragging }, drag, dragPreview] = useDrag<
		ITriggeredActionEntryDragObject,
		ITriggeredActionEntryDropResult,
		{
			isDragging: boolean
		}
	>({
		type: TRIGGERED_ACTION_ENTRY_DRAG_TYPE,
		item: { id: triggeredActionId },
		// The collect function utilizes a "monitor" instance (see the Overview for what this is)
		// to pull important pieces of state from the DnD system.
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
		end: (_, monitor) => {
			if (monitor.didDrop()) {
				const dropResult = monitor.getDropResult() as
					| {
							overId: TriggeredActionId
							overRank?: number
							overShowStyleBaseId?: ShowStyleBaseId
					  }
					| undefined
				if (dropResult && dropResult.overRank !== undefined && dropResult.overShowStyleBaseId) {
					let pairRank =
						TriggeredActions.findOne(
							{
								_rank: {
									$lt: dropResult.overRank,
								},
							},
							{
								sort: {
									_rank: -1,
								},
							}
						)?._rank ?? -1000
					if (pairRank === triggeredAction?._rank) {
						pairRank =
							TriggeredActions.findOne(
								{
									_rank: {
										$gt: dropResult.overRank,
									},
								},
								{
									sort: {
										_rank: 1,
									},
								}
							)?._rank ?? dropResult.overRank + 1000
					}
					const newRank = (pairRank + dropResult.overRank) / 2
					TriggeredActions.update(triggeredActionId, {
						$set: {
							_rank: newRank,
							showStyleBaseId: dropResult.overShowStyleBaseId,
						},
					})
				}
			}
		},
	})

	const [{ isOver }, drop] = useDrop<
		ITriggeredActionEntryDragObject,
		ITriggeredActionEntryDropResult,
		{
			isOver: boolean
			canDrop: boolean
		}
	>({
		// The type (or types) to accept - strings or symbols
		accept: TRIGGERED_ACTION_ENTRY_DRAG_TYPE,
		// Props to collect
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			canDrop: monitor.canDrop(),
		}),
		drop: () => {
			return {
				overId: triggeredActionId,
				overRank: triggeredAction?._rank ?? null,
				overShowStyleBaseId: triggeredAction?.showStyleBaseId ?? null,
			}
		},
	})

	const resolvedActions = useMemo(
		() =>
			triggeredAction?.actionsWithOverrides
				? applyAndValidateOverrides(triggeredAction.actionsWithOverrides).obj
				: undefined,
		[triggeredAction?.actionsWithOverrides]
	)

	const previewItems = useTrackerAsync<IWrappedAdLib[], IWrappedAdLib[]>(
		async (computation) => {
			try {
				if (!resolvedActions || !selected || !sourceLayers) return []

				const triggerComputation = toTriggersComputation(computation)

				const executableActions = Object.values<SomeAction>(resolvedActions).map((value) =>
					createAction(UiTriggersContext, value, sourceLayers)
				)
				const ctx = previewContext
				if (!ctx || !ctx.rundownPlaylist) return []

				const actionCtx = ctx as PlainActionContext

				return flatten(
					await Promise.all(
						executableActions.map(
							async (action): Promise<IWrappedAdLib[]> =>
								isPreviewableAction(action) ? action.preview(actionCtx, triggerComputation) : []
						)
					)
				)
			} catch (e) {
				catchError('TriggeredActionEntry previewItems')(e)
			}
			return []
		},
		[selected, resolvedActions, sourceLayers, previewContext],
		[]
	)

	function getType(sourceLayerId: string | undefined): SourceLayerType {
		return sourceLayerId && sourceLayers
			? (sourceLayers[sourceLayerId]?.type ?? SourceLayerType.UNKNOWN)
			: SourceLayerType.UNKNOWN
	}

	function getShortName(sourceLayerId: string | undefined) {
		return sourceLayerId && sourceLayers
			? (sourceLayers[sourceLayerId]?.abbreviation ?? sourceLayers[sourceLayerId]?.name ?? t('Unknown'))
			: t('Unknown')
	}

	const saveActionsOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			if (!triggeredAction?._id) return

			TriggeredActions.update(triggeredAction?._id, {
				$set: {
					[`actionsWithOverrides.overrides`]: newOps,
				},
			})
		},
		[triggeredAction?._id]
	)
	const actionsOverridesHelper = useOverrideOpHelper(
		saveActionsOverrides,
		triggeredAction?.actionsWithOverrides ?? wrapDefaultObject({})
	)

	const saveTriggersOverrides = useCallback(
		(newOps: SomeObjectOverrideOp[]) => {
			if (!triggeredAction?._id) return

			TriggeredActions.update(triggeredAction?._id, {
				$set: {
					[`triggersWithOverrides.overrides`]: newOps,
				},
			})
		},
		[triggeredAction?._id]
	)
	const triggersOverridesHelper = useOverrideOpHelper(
		saveTriggersOverrides,
		triggeredAction?.triggersWithOverrides ?? wrapDefaultObject({})
	)

	const removeTrigger = useCallback(
		(id: string) => {
			triggersOverridesHelper().deleteItem(id).commit()

			setSelectedTrigger(null)
		},
		[triggersOverridesHelper]
	)

	const focusTrigger = useCallback(
		(id: string) => {
			if (!triggeredAction?._id) return
			setSelectedTrigger(id)
		},
		[triggeredAction?._id]
	)

	const closeTrigger = useCallback(() => setSelectedTrigger(null), [])

	const changeTrigger = useCallback(
		(id: string, newVal: DBBlueprintTrigger) => {
			if (!triggeredAction?._id) return

			if (isHotkeyTrigger(newVal)) {
				LAST_UP_SETTING = !!newVal.up
			}

			triggersOverridesHelper().replaceItem(id, newVal).commit()

			setSelectedTrigger(null)
		},
		[triggeredAction?._id, triggersOverridesHelper]
	)

	const resetTrigger = useCallback(
		(id: string) => {
			if (!triggeredAction?._id) return

			triggersOverridesHelper().resetItem(id).commit()

			setSelectedTrigger(null)
		},
		[triggeredAction?._id, triggersOverridesHelper]
	)

	const addTrigger = useCallback(() => {
		if (!triggeredAction?._id) return

		const id = getRandomString()
		const newTrigger = {
			type: TriggerType.hotkey,
			keys: '',
			up: LAST_UP_SETTING,
		}

		TriggeredActions.update(triggeredAction?._id, {
			$push: {
				'triggersWithOverrides.overrides': literal<ObjectOverrideSetOp>({
					op: 'set',
					path: id,
					value: newTrigger,
				}),
			},
		})

		setSelectedTrigger(id)
		setSelectedAction(null)
	}, [triggeredAction?._id])

	const addAction = useCallback(() => {
		if (!triggeredAction?._id) return

		const id = getRandomString()
		const newAction = {
			action: PlayoutActions.adlib,
			filterChain: [],
		}

		TriggeredActions.update(triggeredAction?._id, {
			$set: {
				'actionsWithOverrides.overrides': [
					literal<ObjectOverrideSetOp>({
						op: 'set',
						path: id,
						value: newAction,
					}),
				],
			},
		})

		setSelectedTrigger(null)
		setSelectedAction(id)
	}, [triggeredAction?._id])

	const removeAction = useCallback(
		(id: string) => {
			if (!triggeredAction?._id) return

			actionsOverridesHelper().deleteItem(id).commit()

			setSelectedAction(null)
		},
		[triggeredAction?._id, actionsOverridesHelper]
	)

	const onResetActions = useCallback(() => {
		saveActionsOverrides([])
	}, [saveActionsOverrides])

	const restoreAction = useCallback(
		(id: string) => {
			actionsOverridesHelper().resetItem(id).commit()
		},
		[actionsOverridesHelper]
	)

	const closeAction = useCallback(() => setSelectedAction(null), [])
	const focusAction = useCallback(() => onFocus?.(triggeredActionId), [triggeredActionId, onFocus])

	useEffect(() => {
		if (!triggeredAction?.triggersWithOverrides) return

		const resolvedActions = applyAndValidateOverrides(triggeredAction.triggersWithOverrides).obj

		const lastTriggerObj = last(Object.values<SomeBlueprintTrigger>(resolvedActions))
		const selectedTriggerObj = selectedTrigger ? resolvedActions[selectedTrigger] : null
		if (!selectedTriggerObj || !isHotkeyTrigger(selectedTriggerObj)) {
			if (!isHotkeyTrigger(lastTriggerObj)) return
			LAST_UP_SETTING = lastTriggerObj?.up ?? LAST_UP_SETTING
			return
		}
		LAST_UP_SETTING = !!selectedTriggerObj?.up
	}, [triggeredAction?.triggersWithOverrides, selectedTrigger])

	const sortedWrappedTriggers = useMemo(
		() =>
			triggeredAction
				? getAllCurrentAndDeletedItemsFromOverrides<SomeBlueprintTrigger>(triggeredAction.triggersWithOverrides, null)
				: [],
		[triggeredAction]
	)
	const sortedWrappedActions = useMemo(
		() =>
			triggeredAction
				? getAllCurrentAndDeletedItemsFromOverrides<SomeAction>(triggeredAction.actionsWithOverrides, null)
				: [],
		[triggeredAction]
	)

	// do not render anything until we get the triggered action from the collection
	if (!triggeredAction) return null

	return (
		<div
			className={classNames('triggered-action-entry selectable', {
				'selectable-selected': selected,
				'drag-over': isOver,
				dragged: isDragging,
			})}
			ref={(el) => {
				dragPreview(el)
				drop(el)
			}}
			data-obj-id={triggeredAction._id}
		>
			{!selected && !locked ? (
				<div className="triggered-action-entry__drag-handle" ref={drag}>
					{!selected && iconDragHandle()}
				</div>
			) : (
				<div className="triggered-action-entry__drag-handle locked"></div>
			)}
			<div className="triggered-action-entry__triggers">
				{sortedWrappedTriggers.map((item) => (
					<TriggerEditor
						key={item.id}
						id={item.id}
						trigger={item.type === 'normal' ? item.computed : item.defaults}
						opened={selectedTrigger === item.id}
						canReset={item.defaults !== undefined && item.overrideOps.length > 0}
						isDeleted={item.type === 'deleted'}
						onResetTrigger={resetTrigger}
						onChangeTrigger={changeTrigger}
						onFocus={focusTrigger}
						onClose={closeTrigger}
						onRemove={removeTrigger}
					/>
				))}
				<button
					className={classNames('triggered-action-entry__add-trigger', {
						force: sortedWrappedTriggers.filter((trigger) => trigger.type === 'normal').length === 0,
					})}
					onClick={addTrigger}
				>
					<FontAwesomeIcon icon={faPlus} />
				</button>
			</div>
			<div className="triggered-action-entry__actions">
				{sortedWrappedActions.map((item) =>
					item.type === 'normal' ? (
						<ActionEditor
							key={item.id}
							action={item.computed}
							actionId={item.id}
							sourceLayers={sourceLayers}
							outputLayers={outputLayers}
							onActionFocus={setSelectedAction}
							overrideHelper={actionsOverridesHelper}
							onFocus={focusAction}
							onClose={closeAction}
							opened={selectedAction === item.id}
							onRemove={removeAction}
						/>
					) : (
						<button
							key={item.id}
							className="triggered-action-entry__action-add clickable"
							onClick={() => restoreAction(item.id)}
						>
							{t('Restore Deleted Action')}
						</button>
					)
				)}
				{sortedWrappedActions.length === 0 ? (
					<div className="triggered-action-entry__action">
						<button className="triggered-action-entry__action-add clickable" onClick={addAction}>
							{t('Select Action')}
						</button>
					</div>
				) : null}
			</div>
			<div className="triggered-action-entry__modify">
				{!!sortedWrappedActions.find((action) => action.overrideOps.length > 0) && (
					<button className="action-btn" onClick={onResetActions} title={t('Reset Action')}>
						<FontAwesomeIcon icon={faSync} />
					</button>
				)}
				<button
					className="action-btn"
					onClick={(e) => onDuplicate(triggeredActionId, e)}
					title={t('Duplicate Action Trigger')}
				>
					<FontAwesomeIcon icon={faCopy} />
				</button>
				<button className="action-btn" onClick={(e) => onEdit(triggeredActionId, e)} title={t('Edit Action Trigger')}>
					<FontAwesomeIcon icon={faPencilAlt} />
				</button>
				<button
					className="action-btn"
					onClick={(e) => onRemove(triggeredActionId, e)}
					title={t('Delete Action Trigger')}
				>
					<FontAwesomeIcon icon={faTrash} />
				</button>
			</div>
			{selected ? (
				<>
					<ul className="triggered-action-entry__preview">
						{previewItems.map((item) => (
							<li key={item._id as string}>
								<span className={RundownUtils.getSourceLayerClassName(getType(item.sourceLayerId))}>
									{getShortName(item.sourceLayerId)}
								</span>
								{typeof item.label === 'string' ? item.label : translateMessage(item.label, t)}
							</li>
						))}
						{previewItems.length === 0 ? (
							previewContext?.rundownPlaylist ? (
								<span className="dimmed">
									{t('No Ad-Lib matches in the current state of Rundown: "{{rundownPlaylistName}}"', {
										rundownPlaylistName: previewContext?.rundownPlaylist?.name,
									})}
								</span>
							) : (
								<span className="dimmed">{t('No matching Rundowns available to be used for preview')}</span>
							)
						) : null}
					</ul>
					<div className="properties-grid mt-2 w-100">
						<label className="field">
							<LabelActual label={t('Label')} />
							<div className="field-content">
								<EditAttribute
									type="text"
									obj={triggeredAction}
									collection={TriggeredActions}
									attribute="name"
									mutateDisplayValue={(val) => (typeof val === 'object' ? undefined : val)}
									mutateUpdateValue={(val) =>
										val === '' && typeof triggeredAction.name === 'object' ? triggeredAction.name : val
									}
									label={
										typeof triggeredAction.name === 'object'
											? t('Multilingual description, editing will overwrite')
											: ''
									}
								/>
							</div>
							<span className="text-s dimmed field-hint">{t('Optional description of the action')}</span>
						</label>
						<label className="field">
							<LabelActual label={t('Style class names')} />
							<div className="field-content">
								<EditAttribute
									type="text"
									obj={triggeredAction}
									collection={TriggeredActions}
									attribute="styleClassNames"
								/>
							</div>
							<span className="text-s dimmed field-hint">
								{t('Space separated list of style class names to use when displaying the action')}
							</span>
						</label>
					</div>
				</>
			) : null}
		</div>
	)
})
