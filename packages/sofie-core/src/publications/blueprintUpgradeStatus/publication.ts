import { BlueprintId, ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	CustomPublish,
	CustomPublishCollection,
	setUpCollectionOptimizedObserver,
	TriggerUpdate,
} from '../../lib/customPublication'
import type { PublicationRegistry } from '../../publicationRegistry'
import {
	ContentCache,
	CoreSystemFields,
	createReactiveContentCache,
	ShowStyleBaseFields,
	StudioFields,
} from './reactiveContentCache'
import { UpgradesContentObserver } from './upgradesContentObserver'
import { BlueprintMapEntry, checkDocUpgradeStatus, checkSystemUpgradeStatus } from './checkStatus'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	UIBlueprintUpgradeStatus,
	UIBlueprintUpgradeStatusId,
} from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'
import { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { assertConnectionHasOneOfPermissions } from '../../security/auth'

type BlueprintUpgradeStatusArgs = Record<string, never>

export interface BlueprintUpgradeStatusState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface BlueprintUpgradeStatusUpdateProps {
	newCache: ContentCache

	invalidateSystem: boolean
	invalidateStudioIds: StudioId[]
	invalidateShowStyleBaseIds: ShowStyleBaseId[]
	invalidateBlueprintIds: BlueprintId[]
}

async function setupBlueprintUpgradeStatusPublicationObservers(
	_args: ReadonlyDeep<BlueprintUpgradeStatusArgs>,
	triggerUpdate: TriggerUpdate<BlueprintUpgradeStatusUpdateProps>,
	signal: AbortSignal
): Promise<void> {
	// TODO - can this be done cheaper?
	const cache = createReactiveContentCache()

	// Push update
	triggerUpdate({ newCache: cache })

	await UpgradesContentObserver.create(cache, signal)

	cache.CoreSystem.observeChanges(
		{
			added: () => triggerUpdate({ invalidateSystem: true }),
			changed: () => triggerUpdate({ invalidateSystem: true }),
			removed: () => triggerUpdate({ invalidateSystem: true }),
		},
		undefined,
		{ signal }
	)
	cache.Studios.observeChanges(
		{
			added: (id) => triggerUpdate({ invalidateStudioIds: [id] }),
			changed: (id) => triggerUpdate({ invalidateStudioIds: [id] }),
			removed: (id) => triggerUpdate({ invalidateStudioIds: [id] }),
		},
		undefined,
		{ signal }
	)
	cache.ShowStyleBases.observeChanges(
		{
			added: (id) => triggerUpdate({ invalidateShowStyleBaseIds: [id] }),
			changed: (id) => triggerUpdate({ invalidateShowStyleBaseIds: [id] }),
			removed: (id) => triggerUpdate({ invalidateShowStyleBaseIds: [id] }),
		},
		undefined,
		{ signal }
	)
	cache.Blueprints.observeChanges(
		{
			added: (id) => triggerUpdate({ invalidateBlueprintIds: [id] }),
			changed: (id) => triggerUpdate({ invalidateBlueprintIds: [id] }),
			removed: (id) => triggerUpdate({ invalidateBlueprintIds: [id] }),
		},
		undefined,
		{ signal }
	)
}

function getDocumentId(
	type: 'coreSystem' | 'studio' | 'showStyle',
	id: ProtectedString<any>
): UIBlueprintUpgradeStatusId {
	return protectString(`${type}:${id}`)
}

export async function manipulateBlueprintUpgradeStatusPublicationData(
	_args: BlueprintUpgradeStatusArgs,
	state: Partial<BlueprintUpgradeStatusState>,
	collection: CustomPublishCollection<UIBlueprintUpgradeStatus>,
	updateProps: Partial<ReadonlyDeep<BlueprintUpgradeStatusUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// We know that `collection` does diffing when 'commiting' all of the changes we have made
	// meaning that for anything we will call `replace()` on, we can `remove()` it first for no extra cost

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the notes
		collection.remove(null)

		return
	}

	const studioBlueprintsMap = new Map<BlueprintId, BlueprintMapEntry>()
	const showStyleBlueprintsMap = new Map<BlueprintId, BlueprintMapEntry>()
	const systemBlueprintsMap = new Map<BlueprintId, BlueprintMapEntry>()
	state.contentCache.Blueprints.findFetch({}).forEach((blueprint) => {
		switch (blueprint.blueprintType) {
			case BlueprintManifestType.SHOWSTYLE:
				showStyleBlueprintsMap.set(blueprint._id, {
					_id: blueprint._id,
					configPresets: blueprint.showStyleConfigPresets,
					configSchema: blueprint.showStyleConfigSchema,
					blueprintHash: blueprint.blueprintHash,
					hasFixUpFunction: blueprint.hasFixUpFunction,
				})
				break
			case BlueprintManifestType.STUDIO:
				studioBlueprintsMap.set(blueprint._id, {
					_id: blueprint._id,
					configPresets: blueprint.studioConfigPresets,
					configSchema: blueprint.studioConfigSchema,
					blueprintHash: blueprint.blueprintHash,
					hasFixUpFunction: blueprint.hasFixUpFunction,
				})
				break
			case BlueprintManifestType.SYSTEM:
				systemBlueprintsMap.set(blueprint._id, {
					_id: blueprint._id,
					configPresets: {},
					configSchema: undefined, // TODO
					blueprintHash: blueprint.blueprintHash,
					hasFixUpFunction: false,
				})
				break
			// TODO - default?
		}
	})

	const updateAll = !updateProps || !!updateProps?.newCache
	if (updateAll) {
		// Remove all the notes
		collection.remove(null)

		state.contentCache.Studios.findFetch({}).forEach((studio) => {
			updateStudioUpgradeStatus(collection, studioBlueprintsMap, studio)
		})

		state.contentCache.ShowStyleBases.findFetch({}).forEach((showStyleBase) => {
			updateShowStyleUpgradeStatus(collection, showStyleBlueprintsMap, showStyleBase)
		})

		state.contentCache.CoreSystem.findFetch({}).forEach((coreSystem) => {
			updateCoreSystemUpgradeStatus(collection, systemBlueprintsMap, coreSystem)
		})
	} else {
		const regenerateForStudioIds = new Set(updateProps.invalidateStudioIds)
		const regenerateForShowStyleBaseIds = new Set(updateProps.invalidateShowStyleBaseIds)

		if (updateProps.invalidateBlueprintIds) {
			// Find Studios whose blueprint triggered an invalidation
			const invalidatedStudios = state.contentCache.Studios.findFetch({
				blueprintId: { $in: updateProps.invalidateBlueprintIds },
			})
			for (const studio of invalidatedStudios) {
				regenerateForStudioIds.add(studio._id)
			}

			// Find ShowStyleBases whose blueprint triggered an invalidation
			const invalidatedShowStyles = state.contentCache.ShowStyleBases.findFetch({
				blueprintId: { $in: updateProps.invalidateBlueprintIds },
			})
			for (const showStyle of invalidatedShowStyles) {
				regenerateForShowStyleBaseIds.add(showStyle._id)
			}
		}

		// Regenerate Studios
		for (const studioId of regenerateForStudioIds) {
			const studio = state.contentCache.Studios.findOne(studioId)

			if (studio) {
				updateStudioUpgradeStatus(collection, studioBlueprintsMap, studio)
			} else {
				// Has already been removed
				collection.remove(getDocumentId('studio', studioId))
			}
		}

		// Regenerate ShowStyles
		for (const showStyleBaseId of regenerateForShowStyleBaseIds) {
			const showStyleBase = state.contentCache.ShowStyleBases.findOne(showStyleBaseId)

			if (showStyleBase) {
				updateShowStyleUpgradeStatus(collection, showStyleBlueprintsMap, showStyleBase)
			} else {
				// Has already been removed
				collection.remove(getDocumentId('showStyle', showStyleBaseId))
			}
		}

		if (updateProps.invalidateSystem) {
			state.contentCache.CoreSystem.findFetch({}).forEach((coreSystem) => {
				updateCoreSystemUpgradeStatus(collection, systemBlueprintsMap, coreSystem)
			})
		}
	}
}

function updateCoreSystemUpgradeStatus(
	collection: CustomPublishCollection<UIBlueprintUpgradeStatus>,
	blueprintsMap: Map<BlueprintId, BlueprintMapEntry>,
	coreSystem: Pick<ICoreSystem, CoreSystemFields>
) {
	const status = checkSystemUpgradeStatus(blueprintsMap, coreSystem)

	collection.replace({
		...status,
		_id: getDocumentId('coreSystem', coreSystem._id),
		documentType: 'coreSystem',
		documentId: coreSystem._id,
		name: coreSystem.name ?? 'System',
	})
}

function updateStudioUpgradeStatus(
	collection: CustomPublishCollection<UIBlueprintUpgradeStatus>,
	blueprintsMap: Map<BlueprintId, BlueprintMapEntry>,
	studio: Pick<DBStudio, StudioFields>
) {
	const status = checkDocUpgradeStatus(blueprintsMap, studio)

	collection.replace({
		...status,
		_id: getDocumentId('studio', studio._id),
		documentType: 'studio',
		documentId: studio._id,
		name: studio.name,
	})
}

function updateShowStyleUpgradeStatus(
	collection: CustomPublishCollection<UIBlueprintUpgradeStatus>,
	blueprintsMap: Map<BlueprintId, BlueprintMapEntry>,
	showStyleBase: Pick<DBShowStyleBase, ShowStyleBaseFields>
) {
	const status = checkDocUpgradeStatus(blueprintsMap, showStyleBase)

	collection.replace({
		...status,
		_id: getDocumentId('showStyle', showStyleBase._id),
		documentType: 'showStyle',
		documentId: showStyleBase._id,
		name: showStyleBase.name,
	})
}

export async function createBlueprintUpgradeStatusSubscriptionHandle(
	pub: CustomPublish<UIBlueprintUpgradeStatus>
): Promise<void> {
	await setUpCollectionOptimizedObserver<
		UIBlueprintUpgradeStatus,
		BlueprintUpgradeStatusArgs,
		BlueprintUpgradeStatusState,
		BlueprintUpgradeStatusUpdateProps
	>(
		`pub_${MeteorPubSub.uiBlueprintUpgradeStatuses}`,
		{},
		setupBlueprintUpgradeStatusPublicationObservers,
		manipulateBlueprintUpgradeStatusPublicationData,
		pub,
		100
	)
}

export function registerBlueprintUpgradeStatusPublications(registry: PublicationRegistry): void {
	registry.customPublish(
		MeteorPubSub.uiBlueprintUpgradeStatuses,
		CustomCollectionName.UIBlueprintUpgradeStatuses,
		async (context, pub) => {
			assertConnectionHasOneOfPermissions(context.connection, 'configure', 'service')

			await createBlueprintUpgradeStatusSubscriptionHandle(pub)
		}
	)
}
