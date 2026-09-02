import { ProtectedString, protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	PartId,
	PartInstanceId,
	PieceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownBaselineAdLibActionId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
	StudioId,
	TriggeredActionId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	IBlueprintDeviceTrigger,
	PieceLifespan,
	PlayoutActions,
	SomeAction,
	SourceLayerType,
	TriggerType,
} from '@sofie-automation/blueprints-integration'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBTriggeredActions } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { MongoFieldSpecifier, mongoProjectDocument } from '@sofie-automation/corelib/dist/mongo'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { IMeteorCall } from '@sofie-automation/meteor-lib/dist/api/methods'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { TFunction } from 'i18next'

import {
	adLibActionFieldSpecifier,
	adLibPieceFieldSpecifier,
	ContentCache,
	createReactiveContentCache,
	partFieldSpecifier,
	partInstanceFieldSpecifier,
	rundownFieldSpecifier,
	rundownPlaylistFieldSpecifier,
	segmentFieldSpecifier,
} from '../reactiveContentCache'
import { StudioDeviceTriggerManager } from '../StudioDeviceTriggerManager'
import { createMeteorTriggersContext } from '../triggersContext'
import { DeviceTriggerMountedActionAdlibsPreview, DeviceTriggerMountedActions } from '../observer'
import { TagsService } from '../TagsService'
import { StudioActionManagers } from '../StudioActionManagers'
import { DeviceActionId } from '@sofie-automation/meteor-lib/dist/api/MountedTriggers'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

const studioId = protectString<StudioId>('studio0')
const playlistId = protectString<RundownPlaylistId>('playlist0')
const activationId = protectString<RundownPlaylistActivationId>('activation0')
const rundownId = protectString<RundownId>('rundown0')
const showStyleBaseId = protectString<ShowStyleBaseId>('showStyleBase0')
const segmentId0 = protectString<SegmentId>('segment0')
const segmentId1 = protectString<SegmentId>('segment1')
const partId0 = protectString<PartId>('part0')
const partId1 = protectString<PartId>('part1')
const partInstanceId0 = protectString<PartInstanceId>('partInstance0')
const triggeredActionId = protectString<TriggeredActionId>('triggeredAction0')

const sourceLayerId = 'sourceLayer0'
const outputLayerId = 'outputLayer0'

const deviceId = 'device0'
const deviceTriggerId = 'trigger0'

/**
 * Insert a document the way `RundownContentObserver` would: run through the collection's field specifier, so
 * that a field dropped from a projection shows up here as a missing field, rather than silently at runtime.
 */
function insertProjected<TDoc extends { _id: ProtectedString<any> }>(
	collection: { insert: (doc: any) => unknown },
	specifier: MongoFieldSpecifier<TDoc>,
	doc: TDoc
): void {
	collection.insert(mongoProjectDocument(doc, specifier))
}

function adLibPiece(id: string, name: string, partId: PartId | undefined): AdLibPiece {
	return {
		_id: protectString<PieceId>(id),
		_rank: 0,
		name,
		partId,
		externalId: id,
		rundownId,
		lifespan: PieceLifespan.WithinPart,
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		sourceLayerId,
		outputLayerId,
		content: {},
	}
}

function adLibAction(id: string, label: string, rank: number, partId: PartId | undefined): RundownBaselineAdLibAction {
	return {
		_id: protectString<RundownBaselineAdLibActionId>(id),
		partId,
		externalId: id,
		rundownId,
		actionId: `${id}_action`,
		userData: { pickedBy: id },
		userDataManifest: {},
		display: {
			_rank: rank,
			label: { key: label },
			sourceLayerId,
			outputLayerId,
		},
	}
}

/** Cancel functions for every cache built by `createAndPopulateCache`, drained in `afterEach`. */
const cacheCancellations: (() => void)[] = []

/**
 * A playlist with two segments, each holding one part with one adLib piece, plus a global adLib piece and
 * action. The labels are deliberately in the opposite order to the segment ranks, so that a result sorted by
 * label (which is what happens when the rundown/segment/part ranks cannot be resolved) is distinguishable
 * from one sorted by position in the rundown.
 */
function createAndPopulateCache(
	pieceLabels: { inPart0: string; inPart1: string } = { inPart0: 'B piece', inPart1: 'A piece' }
): ContentCache {
	const { cache, cancel } = createReactiveContentCache(() => {
		// Nothing to react to: the test drives `updateTriggers` itself
	}, 0)
	cacheCancellations.push(cancel)

	insertProjected<DBRundownPlaylist>(cache.RundownPlaylists, rundownPlaylistFieldSpecifier, {
		_id: playlistId,
		externalId: 'playlist0',
		studioId,
		created: 0,
		modified: 0,
		activationId,
		name: 'Playlist 0',
		timing: { type: 'none' },
		rundownIdsInOrder: [rundownId],
		currentPartInfo: {
			partInstanceId: partInstanceId0,
			rundownId,
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		},
		nextPartInfo: null,
		previousPartInfo: null,
	} as any)

	insertProjected<DBRundown>(cache.Rundowns, rundownFieldSpecifier, {
		_id: rundownId,
		playlistId,
		showStyleBaseId,
	} as any)

	cache.ShowStyleBases.insert({
		_id: showStyleBaseId,
		name: 'ShowStyleBase 0',
		sourceLayersWithOverrides: wrapDefaultObject({
			[sourceLayerId]: {
				_id: sourceLayerId,
				_rank: 0,
				name: 'Source Layer 0',
				type: SourceLayerType.LIVE_SPEAK,
			},
		}),
		outputLayersWithOverrides: wrapDefaultObject({
			[outputLayerId]: {
				_id: outputLayerId,
				_rank: 0,
				name: 'Output Layer 0',
				isPGM: true,
			},
		}),
	} as any as DBShowStyleBase)

	insertProjected<DBSegment>(cache.Segments, segmentFieldSpecifier, {
		_id: segmentId0,
		_rank: 0,
		externalId: 'segment0',
		rundownId,
		name: 'Segment 0',
	})
	insertProjected<DBSegment>(cache.Segments, segmentFieldSpecifier, {
		_id: segmentId1,
		_rank: 1,
		externalId: 'segment1',
		rundownId,
		name: 'Segment 1',
	})

	insertProjected<DBPart>(cache.Parts, partFieldSpecifier, {
		_id: partId0,
		_rank: 0,
		externalId: 'part0',
		rundownId,
		segmentId: segmentId0,
		title: 'Part 0',
		expectedDurationWithTransition: undefined,
	})
	insertProjected<DBPart>(cache.Parts, partFieldSpecifier, {
		_id: partId1,
		_rank: 0,
		externalId: 'part1',
		rundownId,
		segmentId: segmentId1,
		title: 'Part 1',
		expectedDurationWithTransition: undefined,
	})

	insertProjected<DBPartInstance>(cache.PartInstances, partInstanceFieldSpecifier, {
		_id: partInstanceId0,
		rundownId,
		segmentId: segmentId0,
		playlistActivationId: activationId,
		segmentPlayoutId: protectString('segmentPlayout0'),
		takeCount: 1,
		rehearsal: false,
		part: {
			_id: partId0,
			_rank: 0,
			externalId: 'part0',
			rundownId,
			segmentId: segmentId0,
			title: 'Part 0',
			expectedDurationWithTransition: undefined,
		},
	} as any)

	insertProjected<AdLibPiece>(
		cache.AdLibPieces,
		adLibPieceFieldSpecifier,
		adLibPiece('adLibPiece0', pieceLabels.inPart0, partId0)
	)
	insertProjected<AdLibPiece>(
		cache.AdLibPieces,
		adLibPieceFieldSpecifier,
		adLibPiece('adLibPiece1', pieceLabels.inPart1, partId1)
	)
	insertProjected<RundownBaselineAdLibAction>(
		cache.AdLibActions,
		adLibActionFieldSpecifier,
		adLibAction('adLibAction0', 'C action', 1, partId0)
	)

	insertProjected<RundownBaselineAdLibItem>(
		cache.RundownBaselineAdLibPieces,
		adLibPieceFieldSpecifier,
		adLibPiece('baselinePiece0', 'Z baseline piece', undefined)
	)
	insertProjected<RundownBaselineAdLibAction>(
		cache.RundownBaselineAdLibActions,
		adLibActionFieldSpecifier,
		adLibAction('baselineAction0', 'Y baseline action', 1, undefined)
	)

	cache.TriggeredActions.insert({
		_id: triggeredActionId,
		_rank: 0,
		showStyleBaseId,
		blueprintUniqueId: null,
		name: 'Play all the adLibs',
		triggersWithOverrides: wrapDefaultObject<Record<string, IBlueprintDeviceTrigger>>({
			trigger0: {
				type: TriggerType.device,
				deviceId,
				triggerId: deviceTriggerId,
			},
		}),
		actionsWithOverrides: wrapDefaultObject<Record<string, SomeAction>>({
			action0: {
				action: PlayoutActions.adlib,
				filterChain: [{ object: 'view' }],
			},
		}),
	} as any as DBTriggeredActions)

	return cache
}

describe('StudioDeviceTriggerManager', () => {
	let manager: StudioDeviceTriggerManager | undefined

	function createManager(meteorCall: IMeteorCall = {} as IMeteorCall): StudioDeviceTriggerManager {
		manager = new StudioDeviceTriggerManager(studioId, new TagsService(), (getCache) =>
			createMeteorTriggersContext(meteorCall, getCache)
		)
		return manager
	}

	function mountedActionIds(): DeviceActionId[] {
		return DeviceTriggerMountedActions.findFetch({}).map((action) => action.actionId)
	}

	function previewLabels(): (string | ITranslatableMessage)[] {
		return DeviceTriggerMountedActionAdlibsPreview.findFetch({}).map((preview) => preview.label)
	}

	afterEach(async () => {
		// Note: `clearTriggers` before `stop`, as `stop` drops the StudioActionManager before clearing
		await manager?.clearTriggers()
		await manager?.stop()
		manager = undefined
		while (cacheCancellations.length) cacheCancellations.pop()?.()
		DeviceTriggerMountedActions.remove({})
		DeviceTriggerMountedActionAdlibsPreview.remove({})
	})

	it('mounts the actions and previews from the content cache', async () => {
		const manager = createManager()

		await manager.updateTriggers(createAndPopulateCache(), showStyleBaseId)

		expect(
			DeviceTriggerMountedActions.findFetch({}).map((action) => ({
				deviceId: action.deviceId,
				deviceTriggerId: action.deviceTriggerId,
				actionType: action.actionType,
				studioId: action.studioId,
				showStyleBaseId: action.showStyleBaseId,
			}))
		).toEqual([
			{
				deviceId,
				deviceTriggerId,
				actionType: PlayoutActions.adlib,
				studioId,
				showStyleBaseId,
			},
		])

		// Sorted by position in the rundown (segment/part rank), not by label
		expect(previewLabels()).toEqual([
			'B piece',
			{ key: 'C action' },
			'A piece',
			'Z baseline piece',
			{ key: 'Y baseline action' },
		])
	})

	it('reads the replacement cache after the set of rundowns changes', async () => {
		const manager = createManager()

		await manager.updateTriggers(createAndPopulateCache(), showStyleBaseId)
		const actionIdsBefore = mountedActionIds()
		expect(previewLabels()).toContain('B piece')

		// A new ContentCache, as `RundownContentObserver` builds whenever the rundown set changes
		await manager.updateTriggers(
			createAndPopulateCache({ inPart0: 'B piece v2', inPart1: 'A piece v2' }),
			showStyleBaseId
		)

		expect(previewLabels()).toEqual([
			'B piece v2',
			{ key: 'C action' },
			'A piece v2',
			'Z baseline piece',
			{ key: 'Y baseline action' },
		])

		// The compiled action is cached across updates, so the second run reads the new cache only because the
		// TriggersContext looks it up on each query rather than capturing it
		expect(mountedActionIds()).toEqual(actionIdsBefore)
	})

	it('executes the action with the adLib data from the cache', async () => {
		const executeAction = jest.fn(async () => ClientAPI.responseSuccess(undefined))
		const segmentAdLibPieceStart = jest.fn(async () => ClientAPI.responseSuccess(undefined))
		const baselineAdLibPieceStart = jest.fn(async () => ClientAPI.responseSuccess(undefined))
		const manager = createManager({
			userAction: { executeAction, segmentAdLibPieceStart, baselineAdLibPieceStart },
		} as unknown as IMeteorCall)

		await manager.updateTriggers(createAndPopulateCache(), showStyleBaseId)

		const actionManager = StudioActionManagers.get(studioId)
		const action = actionManager?.getAction(mountedActionIds()[0])
		const context = actionManager?.getContext()
		if (!action || !context) throw new Error('Expected a compiled action and a context')

		await action.execute(((message: any) => message) as TFunction, 'test', context)

		// `userData` and `actionId` are only ever read here, so this is the only place a projection dropping
		// them would show up
		expect(executeAction.mock.calls.map((call) => call.slice(2))).toEqual([
			[playlistId, protectString('adLibAction0'), 'adLibAction0_action', { pickedBy: 'adLibAction0' }, undefined],
			[
				playlistId,
				protectString('baselineAction0'),
				'baselineAction0_action',
				{ pickedBy: 'baselineAction0' },
				undefined,
			],
		])
		expect(segmentAdLibPieceStart.mock.calls.map((call) => call.slice(2))).toEqual([
			[playlistId, partInstanceId0, protectString('adLibPiece0'), false],
			[playlistId, partInstanceId0, protectString('adLibPiece1'), false],
		])
		expect(baselineAdLibPieceStart.mock.calls.map((call) => call.slice(2))).toEqual([
			[playlistId, partInstanceId0, protectString('baselinePiece0'), false],
		])
	})
})
