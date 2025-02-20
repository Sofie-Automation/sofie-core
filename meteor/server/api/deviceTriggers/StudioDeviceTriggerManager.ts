import { Meteor } from 'meteor/meteor'
import { ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Complete, literal } from '@sofie-automation/corelib/dist/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import {
	createAction,
	ExecutableAction,
	isPreviewableAction,
	ReactivePlaylistActionContext,
} from '@sofie-automation/meteor-lib/dist/triggers/actionFactory'
import {
	DeviceActionId,
	DeviceTriggerMountedActionId,
	PreviewWrappedAdLib,
	PreviewWrappedAdLibId,
	ShiftRegisterActionArguments,
} from '@sofie-automation/meteor-lib/dist/api/MountedTriggers'
import { isDeviceTrigger } from '@sofie-automation/meteor-lib/dist/triggers/triggerTypeSelectors'
import {
	DBTriggeredActions,
	UITriggeredActionsObj,
} from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { protectString } from '../../lib/tempLib'
import { StudioActionManager, StudioActionManagers } from './StudioActionManagers'
import { DeviceTriggerMountedActionAdlibsPreview, DeviceTriggerMountedActions } from './observer'
import { ContentCache } from './reactiveContentCache'
import { ContentCache as PieceInstancesContentCache } from './reactiveContentCacheForPieceInstances'
import { logger } from '../../logging'
import { SomeAction, SomeBlueprintTrigger } from '@sofie-automation/blueprints-integration'
import { DeviceActions } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'
import { DummyReactiveVar } from '@sofie-automation/meteor-lib/dist/triggers/reactive-var'
import { MeteorTriggersContext } from './triggersContext'
import { TagsService } from './TagsService'

export class StudioDeviceTriggerManager {
	#lastShowStyleBaseId: ShowStyleBaseId | null = null

	lastCache: ContentCache | undefined

	constructor(public studioId: StudioId, protected tagsService: TagsService) {
		if (StudioActionManagers.get(studioId)) {
			logger.error(`A StudioActionManager for "${studioId}" already exists`)
			return
		}

		StudioActionManagers.set(studioId, new StudioActionManager())
	}

	async updateTriggers(cache: ContentCache, showStyleBaseId: ShowStyleBaseId): Promise<void> {
		const studioId = this.studioId
		this.lastCache = cache
		this.#lastShowStyleBaseId = showStyleBaseId

		const [showStyleBase, rundownPlaylist] = await Promise.all([
			cache.ShowStyleBases.findOneAsync(showStyleBaseId),
			cache.RundownPlaylists.findOneAsync({
				activationId: {
					$exists: true,
				},
			}),
		])
		if (!showStyleBase || !rundownPlaylist) {
			return
		}

		const context = await createCurrentContextFromCache(cache, studioId)
		const actionManager = StudioActionManagers.get(studioId)
		if (!actionManager)
			throw new Meteor.Error(
				500,
				`No Studio Action Manager available to handle action context in Studio "${studioId}"`
			)
		actionManager.setContext(context)

		const { obj: sourceLayers } = applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides)

		const allTriggeredActions = await cache.TriggeredActions.find({
			showStyleBaseId: {
				$in: [showStyleBaseId, null],
			},
		}).fetchAsync()

		const upsertedDeviceTriggerMountedActionIds: DeviceTriggerMountedActionId[] = []
		const touchedActionIds: DeviceActionId[] = []

		this.tagsService.clearObservedTags()

		for (const rawTriggeredAction of allTriggeredActions) {
			const triggeredAction = convertDocument(rawTriggeredAction)

			if (!Object.values<SomeBlueprintTrigger>(triggeredAction.triggers).find(isDeviceTrigger)) continue

			const addedPreviewIds: PreviewWrappedAdLibId[] = []

			const updateActionsPromises = Object.entries<SomeAction>(triggeredAction.actions).map(
				async ([key, action]) => {
					// Since the compiled action is cached using this actionId as a key, having the action
					// and the filterChain allows for a quicker invalidation without doing a deepEquals
					const actionId = protectString<DeviceActionId>(
						`${studioId}_${triggeredAction._id}_${key}_${JSON.stringify(action)}`
					)
					const existingAction = actionManager.getAction(actionId)
					let thisAction: ExecutableAction
					// Use the cached action or put a new one in the cache
					if (existingAction) {
						thisAction = existingAction
					} else {
						const compiledAction = createAction(MeteorTriggersContext, action, sourceLayers)
						actionManager.setAction(actionId, compiledAction)
						thisAction = compiledAction
					}
					touchedActionIds.push(actionId)

					const updateMountedActionsPromises = Object.entries<SomeBlueprintTrigger>(
						triggeredAction.triggers
					).map(async ([key, trigger]) => {
						if (!isDeviceTrigger(trigger)) {
							return
						}

						let deviceActionArguments: ShiftRegisterActionArguments | undefined = undefined

						if (action.action === DeviceActions.modifyShiftRegister) {
							deviceActionArguments = {
								type: 'modifyRegister',
								register: action.register,
								operation: action.operation,
								value: action.value,
								limitMin: action.limitMin,
								limitMax: action.limitMax,
							}
						}

						const deviceTriggerMountedActionId = protectString<DeviceTriggerMountedActionId>(
							`${actionId}_${key}`
						)
						upsertedDeviceTriggerMountedActionIds.push(deviceTriggerMountedActionId)
						return DeviceTriggerMountedActions.upsertAsync(deviceTriggerMountedActionId, {
							$set: {
								studioId,
								showStyleBaseId,
								actionType: thisAction.action,
								actionId,
								deviceId: trigger.deviceId,
								deviceTriggerId: trigger.triggerId,
								values: trigger.values,
								deviceActionArguments,
								name: triggeredAction.name,
							},
						})
					})

					if (!isPreviewableAction(thisAction)) {
						const adLibPreviewId = protectString(`${actionId}_preview`)

						addedPreviewIds.push(adLibPreviewId)
						await DeviceTriggerMountedActionAdlibsPreview.upsertAsync(adLibPreviewId, {
							$set: literal<PreviewWrappedAdLib>({
								_id: adLibPreviewId,
								_rank: 0,
								partId: null,
								type: undefined,
								label: thisAction.action,
								item: null,
								triggeredActionId: triggeredAction._id,
								actionId,
								studioId,
								showStyleBaseId,
								sourceLayerType: undefined,
								sourceLayerName: undefined,
								styleClassNames: triggeredAction.styleClassNames,
								isActive: undefined,
								isNext: undefined,
							}),
						})
					} else {
						const previewedAdLibs = await thisAction.preview(context, null)

						const previewedAdlibsUpdatePromises = previewedAdLibs.map(async (adLib) => {
							const adLibPreviewId = protectString<PreviewWrappedAdLibId>(
								`${triggeredAction._id}_${studioId}_${key}_${adLib._id}`
							)

							addedPreviewIds.push(adLibPreviewId)

							this.tagsService.observeTallyTags(adLib)
							const { isActive, isNext } = this.tagsService.getTallyStateFromTags(adLib)
							return DeviceTriggerMountedActionAdlibsPreview.upsertAsync(adLibPreviewId, {
								$set: literal<PreviewWrappedAdLib>({
									...adLib,
									_id: adLibPreviewId,
									triggeredActionId: triggeredAction._id,
									actionId,
									studioId,
									showStyleBaseId,
									sourceLayerType: adLib.sourceLayerId
										? sourceLayers[adLib.sourceLayerId]?.type
										: undefined,
									sourceLayerName: adLib.sourceLayerId
										? {
												name: sourceLayers[adLib.sourceLayerId]?.name,
												abbreviation: sourceLayers[adLib.sourceLayerId]?.abbreviation,
										  }
										: undefined,
									styleClassNames: triggeredAction.styleClassNames,
									isActive,
									isNext,
								}),
							})
						})

						await Promise.all(previewedAdlibsUpdatePromises)
					}

					await Promise.all(updateMountedActionsPromises)
				}
			)

			await Promise.all(updateActionsPromises)

			await DeviceTriggerMountedActionAdlibsPreview.removeAsync({
				triggeredActionId: triggeredAction._id,
				_id: {
					$nin: addedPreviewIds,
				},
			})
		}

		await DeviceTriggerMountedActions.removeAsync({
			studioId,
			showStyleBaseId,
			_id: {
				$nin: upsertedDeviceTriggerMountedActionIds,
			},
		})

		actionManager.deleteActionsOtherThan(touchedActionIds)
	}

	protected async updateTriggersFromLastCache(): Promise<void> {
		if (!this.lastCache || !this.#lastShowStyleBaseId) return
		return this.updateTriggers(this.lastCache, this.#lastShowStyleBaseId)
	}

	async updatePieceInstances(cache: PieceInstancesContentCache, showStyleBaseId: ShowStyleBaseId): Promise<void> {
		const shouldUpdateTriggers = this.tagsService.updatePieceInstances(cache, showStyleBaseId)
		if (shouldUpdateTriggers) {
			await this.updateTriggersFromLastCache()
		}
	}

	async clearTriggers(): Promise<void> {
		const studioId = this.studioId
		const showStyleBaseId = this.#lastShowStyleBaseId

		if (!showStyleBaseId) {
			return
		}

		const actionManager = StudioActionManagers.get(studioId)
		if (!actionManager)
			throw new Meteor.Error(
				500,
				`No Studio Action Manager available to handle action context in Studio "${studioId}"`
			)

		const mountedActions = await DeviceTriggerMountedActions.find({
			studioId,
			showStyleBaseId,
		}).fetchAsync()
		for (const mountedAction of mountedActions) {
			actionManager.deleteAction(mountedAction.actionId)
		}

		await Promise.all([
			DeviceTriggerMountedActions.removeAsync({
				studioId,
				showStyleBaseId,
			}),
			DeviceTriggerMountedActionAdlibsPreview.removeAsync({
				studioId,
				showStyleBaseId,
			}),
		])

		actionManager.deleteContext()

		this.#lastShowStyleBaseId = null
		return
	}

	async stop(): Promise<void> {
		StudioActionManagers.delete(this.studioId)
		return await this.clearTriggers()
	}
}

function convertDocument(doc: ReadonlyObjectDeep<DBTriggeredActions>): UITriggeredActionsObj {
	return literal<Complete<UITriggeredActionsObj>>({
		_id: doc._id,
		_rank: doc._rank,

		showStyleBaseId: doc.showStyleBaseId,
		name: doc.name,

		actions: applyAndValidateOverrides<Record<string, SomeAction>>(doc.actionsWithOverrides).obj,
		triggers: applyAndValidateOverrides<Record<string, SomeBlueprintTrigger>>(doc.triggersWithOverrides).obj,

		styleClassNames: doc.styleClassNames,
	})
}

async function createCurrentContextFromCache(
	cache: ContentCache,
	studioId: StudioId
): Promise<ReactivePlaylistActionContext> {
	const rundownPlaylist = await cache.RundownPlaylists.findOneAsync({
		activationId: {
			$exists: true,
		},
	})

	if (!rundownPlaylist) throw new Error('There should be an active RundownPlaylist!')

	const [currentPartInstance, nextPartInstance] = await Promise.all([
		rundownPlaylist.currentPartInfo
			? cache.PartInstances.findOneAsync(rundownPlaylist.currentPartInfo.partInstanceId)
			: undefined,
		rundownPlaylist.nextPartInfo
			? cache.PartInstances.findOneAsync(rundownPlaylist.nextPartInfo.partInstanceId)
			: undefined,
	])

	const currentSegmentPartIds = currentPartInstance
		? await cache.Parts.find({
				segmentId: currentPartInstance.part.segmentId,
		  }).mapAsync((part) => part._id)
		: []
	const nextSegmentPartIds = nextPartInstance
		? nextPartInstance.part.segmentId === currentPartInstance?.part.segmentId
			? currentSegmentPartIds
			: await cache.Parts.find({
					segmentId: nextPartInstance.part.segmentId,
			  }).mapAsync((part) => part._id)
		: []

	return {
		studioId: new DummyReactiveVar(studioId),
		currentPartInstanceId: new DummyReactiveVar(currentPartInstance?._id ?? null),
		currentPartId: new DummyReactiveVar(currentPartInstance?.part._id ?? null),
		nextPartId: new DummyReactiveVar(nextPartInstance?.part._id ?? null),
		currentRundownId: new DummyReactiveVar(
			currentPartInstance?.part.rundownId ?? nextPartInstance?.part.rundownId ?? null
		),
		rundownPlaylist: new DummyReactiveVar(rundownPlaylist),
		rundownPlaylistId: new DummyReactiveVar(rundownPlaylist._id),
		currentSegmentPartIds: new DummyReactiveVar(currentSegmentPartIds),
		nextSegmentPartIds: new DummyReactiveVar(nextSegmentPartIds),
	}
}
