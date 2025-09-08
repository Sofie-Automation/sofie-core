import React from 'react'
import { useTranslation } from 'react-i18next'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import Escape from './../../lib/Escape.js'
import { ContextMenu, MenuItem } from '@jstarpl/react-contextmenu'
import { ReactiveVar } from 'meteor/reactive-var'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { BucketAdLibItem, BucketAdLibActionUi } from './RundownViewBuckets.js'
import RundownViewEventBus, { RundownViewEvents } from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'
import { IAdLibListItem } from './AdLibListItem.js'
import { isActionItem } from './Inspector/ItemRenderers/ActionItemRenderer.js'
import { AdLibPieceUi, ShelfDisplayOptions } from '../../lib/shelf.js'
import { IBlueprintActionTriggerMode } from '@sofie-automation/blueprints-integration'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { BlueprintAssetIcon } from '../../lib/Components/BlueprintAssetIcon.js'
import { CreateNewBucket, Delete, EmptyBucket, Rename } from '../../lib/ui/icons/shelf.js'

export enum ContextType {
	BUCKET = 'bucket',
	BUCKET_ADLIB = 'bucket_adlib',
	ADLIB = 'adlib',
}

interface ShelfContextMenuProps {
	shelfDisplayOptions: ShelfDisplayOptions
	hideDefaultStartExecute: boolean
}

interface ShelfContextMenuContextBase {
	type: ContextType
	details?: object
}

export interface ShelfContextMenuContextBucket extends ShelfContextMenuContextBase {
	type: ContextType.BUCKET
	details: {
		bucket: Bucket
	}
}

export interface ShelfContextMenuContextBucketAdLib extends ShelfContextMenuContextBase {
	type: ContextType.BUCKET_ADLIB
	details: {
		bucket: Bucket
		adLib: BucketAdLibItem
		canQueue?: boolean
		disabled?: boolean
		onToggle?: (aSLine: BucketAdLibItem, queue: boolean, context: any, mode?: IBlueprintActionTriggerMode) => void
	}
}

export interface ShelfContextMenuContextAdLib extends ShelfContextMenuContextBase {
	type: ContextType.ADLIB
	details: {
		adLib: IAdLibListItem
		canQueue?: boolean
		disabled?: boolean
		onToggle?: (
			aSLine: IAdLibListItem,
			queue: boolean,
			context: React.SyntheticEvent,
			mode?: IBlueprintActionTriggerMode
		) => void
	}
}

type ShelfContextMenuContext =
	| ShelfContextMenuContextBucket
	| ShelfContextMenuContextBucketAdLib
	| ShelfContextMenuContextAdLib

const shelfContextMenuContext: ReactiveVar<ShelfContextMenuContext | undefined> = new ReactiveVar(undefined)

export function setShelfContextMenuContext(context: ShelfContextMenuContext | undefined): void {
	shelfContextMenuContext.set(context)
}

export default function ShelfContextMenu(props: Readonly<ShelfContextMenuProps>): JSX.Element {
	const { t } = useTranslation()

	const context = useTracker(() => {
		return shelfContextMenuContext.get()
	}, [])

	const clearContext = () => {
		shelfContextMenuContext.set(undefined)
	}

	const getActionItem = (piece: IAdLibListItem | BucketAdLibActionUi) => {
		return (piece as AdLibPieceUi).adlibAction
	}

	const renderStartExecuteAdLib = function renderStartExecuteAdLib<T extends IAdLibListItem | BucketAdLibItem>(item: {
		adLib: T
		onToggle?: (adLib: T, queue: boolean, e: any, mode?: IBlueprintActionTriggerMode) => void
		disabled?: boolean
	}): JSX.Element | JSX.Element[] | null {
		if (isActionItem(item.adLib)) {
			const adLibAction = getActionItem(item.adLib)
			const triggerModes = adLibAction?.triggerModes
				?.sort(
					(a, b) =>
						a.display._rank - b.display._rank ||
						translateMessage(a.display.label, t).localeCompare(translateMessage(b.display.label, t))
				)
				.map((mode) => (
					<MenuItem
						key={mode.data}
						onClick={(e) => {
							e.persist()
							item.onToggle?.(item.adLib, false, e, mode)
						}}
						disabled={item.disabled}
					>
						{mode.display.icon ? <BlueprintAssetIcon src={mode.display.icon} className="svg" /> : null}
						{translateMessage(mode.display.label, t)}
					</MenuItem>
				))
			return (
				(triggerModes !== undefined && triggerModes.length > 0 && triggerModes) ||
				(!props.hideDefaultStartExecute ? (
					<MenuItem
						onClick={(e) => {
							e.persist()
							item.onToggle?.(item.adLib, false, e)
						}}
						disabled={item.disabled}
					>
						{(adLibAction?.display.triggerLabel && translateMessage(adLibAction?.display.triggerLabel, t)) ??
							t('Execute')}
					</MenuItem>
				) : null)
			)
		} else {
			return !props.hideDefaultStartExecute ? (
				<>
					<MenuItem
						onClick={(e) => {
							e.persist()
							item.onToggle?.(item.adLib, false, e)
						}}
						disabled={item.disabled}
					>
						{t('Start this AdLib')}
					</MenuItem>
					{item.adLib.sourceLayer?.isQueueable && (
						<MenuItem
							onClick={(e) => {
								e.persist()
								item.onToggle?.(item.adLib, true, e)
							}}
							disabled={item.disabled}
						>
							{t('Queue this AdLib')}
						</MenuItem>
					)}
				</>
			) : null
		}
	}

	const startExecuteMenuItems =
		context?.type === ContextType.ADLIB
			? renderStartExecuteAdLib(context.details)
			: context?.type === ContextType.BUCKET_ADLIB
				? renderStartExecuteAdLib(context.details)
				: null

	return (
		<Escape to="viewport">
			<ContextMenu id="shelf-context-menu" onHide={clearContext}>
				{context?.type === ContextType.BUCKET && (
					<div className="react-contextmenu-label">{context.details.bucket.name}</div>
				)}
				{(context?.type === ContextType.BUCKET_ADLIB || context?.type === ContextType.ADLIB) && (
					<>
						{(startExecuteMenuItems !== null || context.type === ContextType.BUCKET_ADLIB) && (
							<>
								<div className="react-contextmenu-label">{context.details.adLib.name}</div>
								{startExecuteMenuItems}
								<hr />
							</>
						)}
					</>
				)}
				{context?.type === ContextType.BUCKET_ADLIB && (
					<>
						<MenuItem
							onClick={(e) => {
								e.persist()
								RundownViewEventBus.emit(RundownViewEvents.RENAME_BUCKET_ADLIB, {
									piece: context.details.adLib,
									bucket: context.details.bucket,
									context: e,
								})
							}}
						>
							<Rename className="svg" />
							{t('Rename this AdLib')}
						</MenuItem>
						<MenuItem
							onClick={(e) => {
								e.persist()
								RundownViewEventBus.emit(RundownViewEvents.DELETE_BUCKET_ADLIB, {
									piece: context.details.adLib,
									bucket: context.details.bucket,
									context: e,
								})
							}}
						>
							<Delete className="svg" />
							{t('Delete this AdLib')}
						</MenuItem>
						<hr />
					</>
				)}
				{context?.type === ContextType.BUCKET && (
					<>
						<MenuItem
							onClick={(e) => {
								e.persist()
								RundownViewEventBus.emit(RundownViewEvents.EMPTY_BUCKET, {
									bucket: context.details.bucket,
									context: e,
								})
							}}
						>
							<EmptyBucket className="svg" />
							{t('Empty this Bucket')}
						</MenuItem>
						<MenuItem
							onClick={(e) => {
								e.persist()
								RundownViewEventBus.emit(RundownViewEvents.RENAME_BUCKET, {
									bucket: context.details.bucket,
									context: e,
								})
							}}
						>
							<Rename className="svg" />
							{t('Rename this Bucket')}
						</MenuItem>
						<MenuItem
							onClick={(e) => {
								e.persist()
								RundownViewEventBus.emit(RundownViewEvents.DELETE_BUCKET, {
									bucket: context.details.bucket,
									context: e,
								})
							}}
						>
							<Delete className="svg" />
							{t('Delete this Bucket')}
						</MenuItem>
						<hr />
					</>
				)}
				{props.shelfDisplayOptions.enableBuckets && context?.type !== ContextType.BUCKET_ADLIB && (
					<MenuItem
						onClick={(e) => {
							e.persist()
							RundownViewEventBus.emit(RundownViewEvents.CREATE_BUCKET, {
								context: e,
							})
						}}
					>
						<CreateNewBucket className="svg" />
						{t('Create new Bucket')}
					</MenuItem>
				)}
			</ContextMenu>
		</Escape>
	)
}
