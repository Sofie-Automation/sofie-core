import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { TagsService } from '../TagsService'
import {
	PartInstanceId,
	PieceInstanceId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ContentCache } from '../reactiveContentCacheForPieceInstances'
import { ReactiveCacheCollection } from '../../../publications/lib/ReactiveCacheCollection'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { literal, normalizeArray } from '@sofie-automation/corelib/dist/lib'
import { ISourceLayer, PieceLifespan, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { IWrappedAdLib } from '@sofie-automation/meteor-lib/dist/triggers/actionFilterChainCompilers'

const createTestee = () => new TagsService()

const playlistId = protectString<RundownPlaylistId>('playlist0')
const activationId = protectString<RundownPlaylistActivationId>('activation0')
const showStyleBaseId = protectString<ShowStyleBaseId>('showStyleBase0')
const partInstanceId0 = protectString<PartInstanceId>('partInstance0')
const partInstanceId1 = protectString<PartInstanceId>('partInstance1')
const partInstanceId2 = protectString<PartInstanceId>('partInstance2')
const pieceInstanceId0 = protectString<PieceInstanceId>('pieceInstance0')
const pieceInstanceId1 = protectString<PieceInstanceId>('pieceInstance1')
const pieceInstanceId2 = protectString<PieceInstanceId>('pieceInstance2')
const pieceInstanceId3 = protectString<PieceInstanceId>('pieceInstance3')

const sourceLayerId0 = 'sourceLayerId0'
const sourceLayerId1 = 'sourceLayerId1'

const tag0 = 'tag0'
const tag1 = 'tag1'
const tag2 = 'tag2'
const tag3 = 'tag3'

const tag4 = 'tag4'
const tag5 = 'tag5'
const tag6 = 'tag6'

const partInstanceId3 = protectString<PartInstanceId>('partInstance3')
const partInstanceId4 = protectString<PartInstanceId>('partInstance4')
const pieceInstanceId4 = protectString<PieceInstanceId>('pieceInstance4')
const pieceInstanceId5 = protectString<PieceInstanceId>('pieceInstance5')

function createAndPopulateMockCache(): ContentCache {
	const newCache: ContentCache = {
		RundownPlaylists: new ReactiveCacheCollection('rundownPlaylists'),
		ShowStyleBases: new ReactiveCacheCollection('showStyleBases'),
		PieceInstances: new ReactiveCacheCollection('pieceInstances'),
		PartInstances: new ReactiveCacheCollection('partInstances'),
	}

	newCache.RundownPlaylists.insert({
		_id: playlistId,
		activationId: activationId,
		currentPartInfo: {
			partInstanceId: partInstanceId0,
		},
		nextPartInfo: {
			partInstanceId: partInstanceId1,
		},
	} as DBRundownPlaylist)

	newCache.ShowStyleBases.insert({
		_id: showStyleBaseId,
		sourceLayersWithOverrides: wrapDefaultObject(
			normalizeArray(
				[
					literal<ISourceLayer>({
						_id: sourceLayerId0,
						_rank: 0,
						name: 'Camera',
						type: SourceLayerType.CAMERA,
						exclusiveGroup: 'main',
					}),
					literal<ISourceLayer>({
						_id: sourceLayerId1,
						_rank: 1,
						name: 'Graphic',
						type: SourceLayerType.GRAPHICS,
					}),
				],
				'_id'
			)
		),
	} as DBShowStyleBase)

	newCache.PieceInstances.insert({
		_id: pieceInstanceId0,
		piece: {
			tags: [tag0, tag2],
			sourceLayerId: sourceLayerId0,
			enable: { start: 0 },
			lifespan: PieceLifespan.WithinPart,
		},
		partInstanceId: partInstanceId0,
	} as PieceInstance)
	newCache.PieceInstances.insert({
		_id: pieceInstanceId1,
		piece: {
			tags: [tag1],
			sourceLayerId: sourceLayerId0,
			enable: { start: 0 },
			lifespan: PieceLifespan.WithinPart,
		},
		partInstanceId: partInstanceId1,
	} as PieceInstance)
	newCache.PieceInstances.insert({
		_id: pieceInstanceId2,
		piece: {
			tags: [tag2],
			sourceLayerId: sourceLayerId1,
			enable: { start: 0 },
			lifespan: PieceLifespan.WithinPart,
		},
		partInstanceId: partInstanceId1,
	} as PieceInstance)
	newCache.PieceInstances.insert({
		_id: pieceInstanceId3,
		piece: {
			tags: [tag3],
			sourceLayerId: sourceLayerId0,
			enable: { start: 0 },
			lifespan: PieceLifespan.WithinPart,
		},
		partInstanceId: partInstanceId2,
	} as PieceInstance)

	newCache.PartInstances.insert({
		_id: partInstanceId0,
	} as DBPartInstance)
	newCache.PartInstances.insert({
		_id: partInstanceId1,
	} as DBPartInstance)
	newCache.PartInstances.insert({
		_id: partInstanceId2,
	} as DBPartInstance)

	return newCache
}

describe('TagsService', () => {
	test('adlib that has no tags', () => {
		const testee = createTestee()
		const cache = createAndPopulateMockCache()

		testee.updatePieceInstances(cache, showStyleBaseId)
		const result = testee.getTallyStateFromTags({} as IWrappedAdLib)
		expect(result).toEqual({ isActive: false, isNext: false })
	})

	test('adlib that is neither on air or next', () => {
		const testee = createTestee()
		const cache = createAndPopulateMockCache()

		testee.updatePieceInstances(cache, showStyleBaseId)
		const result = testee.getTallyStateFromTags({
			currentPieceTags: [tag3],
		} as IWrappedAdLib)
		expect(result).toEqual({ isActive: false, isNext: false })
	})

	test('adlib that is both on air and next', () => {
		const testee = createTestee()
		const cache = createAndPopulateMockCache()

		testee.updatePieceInstances(cache, showStyleBaseId)
		const result = testee.getTallyStateFromTags({
			currentPieceTags: [tag2],
		} as IWrappedAdLib)

		expect(result).toEqual({ isActive: true, isNext: true })
	})

	test('adlib that is only on air', () => {
		const testee = createTestee()
		const cache = createAndPopulateMockCache()

		testee.updatePieceInstances(cache, showStyleBaseId)
		const result = testee.getTallyStateFromTags({
			currentPieceTags: [tag0],
		} as IWrappedAdLib)
		expect(result).toEqual({ isActive: true, isNext: false })
	})

	test('adlib that is only next', () => {
		const testee = createTestee()
		const cache = createAndPopulateMockCache()

		testee.updatePieceInstances(cache, showStyleBaseId)
		const result = testee.getTallyStateFromTags({
			currentPieceTags: [tag1],
		} as IWrappedAdLib)
		expect(result).toEqual({ isActive: false, isNext: true })
	})

	test('updatePieceInstances returns true if observed tags are present in pieces', () => {
		const testee = createTestee()
		const cache = createAndPopulateMockCache()

		testee.observeTallyTags({
			currentPieceTags: [tag1],
		} as IWrappedAdLib)
		const result = testee.updatePieceInstances(cache, showStyleBaseId)

		expect(result).toEqual(true)
	})

	test('updatePieceInstances returns false if observed tags are not included in pieces', () => {
		const testee = createTestee()
		const cache = createAndPopulateMockCache()

		testee.observeTallyTags({
			currentPieceTags: [tag4],
		} as IWrappedAdLib)
		const result = testee.updatePieceInstances(cache, showStyleBaseId)

		expect(result).toEqual(false)
	})

	test('updatePieceInstances returns true if observed tags are no longer present on pieces', () => {
		const testee = createTestee()
		const cache = createAndPopulateMockCache()

		testee.observeTallyTags({
			currentPieceTags: [tag1],
		} as IWrappedAdLib)
		testee.updatePieceInstances(cache, showStyleBaseId)

		cache.PieceInstances.find({}).forEach((pieceInstance) => {
			pieceInstance.piece.tags = [tag2]
		})
		const result = testee.updatePieceInstances(cache, showStyleBaseId)

		expect(result).toEqual(true)
	})

	test('piece in previousPartsInfo[0] (most-recent previous) is treated as on-air', () => {
		// partInstanceId3 = previous (index 0), partInstanceId0 = current
		const testee = createTestee()
		const cache: ContentCache = {
			RundownPlaylists: new ReactiveCacheCollection('rundownPlaylists'),
			ShowStyleBases: new ReactiveCacheCollection('showStyleBases'),
			PieceInstances: new ReactiveCacheCollection('pieceInstances'),
			PartInstances: new ReactiveCacheCollection('partInstances'),
		}
		cache.RundownPlaylists.insert({
			_id: playlistId,
			activationId,
			previousPartsInfo: [{ partInstanceId: partInstanceId3 }],
			currentPartInfo: { partInstanceId: partInstanceId0 },
			nextPartInfo: { partInstanceId: partInstanceId1 },
		} as DBRundownPlaylist)
		cache.ShowStyleBases.insert({
			_id: showStyleBaseId,
			sourceLayersWithOverrides: wrapDefaultObject(
				normalizeArray(
					[
						literal<ISourceLayer>({
							_id: sourceLayerId0,
							_rank: 0,
							name: 'Camera',
							type: SourceLayerType.CAMERA,
						}),
					],
					'_id'
				)
			),
		} as DBShowStyleBase)
		// Piece in the previous part — started playback, not yet stopped
		cache.PieceInstances.insert({
			_id: pieceInstanceId4,
			piece: {
				tags: [tag5],
				sourceLayerId: sourceLayerId0,
				enable: { start: 0 },
				lifespan: PieceLifespan.WithinPart,
			},
			partInstanceId: partInstanceId3,
			plannedStartedPlayback: 1000,
		} as PieceInstance)
		// Piece in the current part
		cache.PieceInstances.insert({
			_id: pieceInstanceId0,
			piece: {
				tags: [tag0],
				sourceLayerId: sourceLayerId0,
				enable: { start: 0 },
				lifespan: PieceLifespan.WithinPart,
			},
			partInstanceId: partInstanceId0,
		} as PieceInstance)
		cache.PartInstances.insert({ _id: partInstanceId3 } as DBPartInstance)
		cache.PartInstances.insert({ _id: partInstanceId0 } as DBPartInstance)
		cache.PartInstances.insert({ _id: partInstanceId1 } as DBPartInstance)

		testee.updatePieceInstances(cache, showStyleBaseId)

		// tag5 is from previous part → on-air; tag0 is from current → on-air; neither is next
		expect(testee.getTallyStateFromTags({ currentPieceTags: [tag5] } as IWrappedAdLib)).toEqual({
			isActive: true,
			isNext: false,
		})
		expect(testee.getTallyStateFromTags({ currentPieceTags: [tag0] } as IWrappedAdLib)).toEqual({
			isActive: true,
			isNext: false,
		})
	})

	test('pieces in all entries of previousPartsInfo are treated as on-air', () => {
		// partInstanceId4 = older previous (index 1), partInstanceId3 = recent previous (index 0), partInstanceId0 = current
		const testee = createTestee()
		const cache: ContentCache = {
			RundownPlaylists: new ReactiveCacheCollection('rundownPlaylists'),
			ShowStyleBases: new ReactiveCacheCollection('showStyleBases'),
			PieceInstances: new ReactiveCacheCollection('pieceInstances'),
			PartInstances: new ReactiveCacheCollection('partInstances'),
		}
		cache.RundownPlaylists.insert({
			_id: playlistId,
			activationId,
			// most-recent-first: index 0 = partInstanceId3, index 1 = partInstanceId4
			previousPartsInfo: [{ partInstanceId: partInstanceId3 }, { partInstanceId: partInstanceId4 }],
			currentPartInfo: { partInstanceId: partInstanceId0 },
		} as DBRundownPlaylist)
		cache.ShowStyleBases.insert({
			_id: showStyleBaseId,
			sourceLayersWithOverrides: wrapDefaultObject(
				normalizeArray(
					[
						literal<ISourceLayer>({
							_id: sourceLayerId0,
							_rank: 0,
							name: 'Camera',
							type: SourceLayerType.CAMERA,
						}),
					],
					'_id'
				)
			),
		} as DBShowStyleBase)
		// Piece in the most-recent previous part (index 0)
		cache.PieceInstances.insert({
			_id: pieceInstanceId4,
			piece: {
				tags: [tag5],
				sourceLayerId: sourceLayerId0,
				enable: { start: 0 },
				lifespan: PieceLifespan.WithinPart,
			},
			partInstanceId: partInstanceId3,
			plannedStartedPlayback: 1000,
		} as PieceInstance)
		// Piece in the older previous part (index 1) — still has started playback, not stopped
		cache.PieceInstances.insert({
			_id: pieceInstanceId5,
			piece: {
				tags: [tag6],
				sourceLayerId: sourceLayerId0,
				enable: { start: 0 },
				lifespan: PieceLifespan.WithinPart,
			},
			partInstanceId: partInstanceId4,
			plannedStartedPlayback: 500,
		} as PieceInstance)
		// Piece in the current part
		cache.PieceInstances.insert({
			_id: pieceInstanceId0,
			piece: {
				tags: [tag0],
				sourceLayerId: sourceLayerId0,
				enable: { start: 0 },
				lifespan: PieceLifespan.WithinPart,
			},
			partInstanceId: partInstanceId0,
		} as PieceInstance)
		cache.PartInstances.insert({ _id: partInstanceId4 } as DBPartInstance)
		cache.PartInstances.insert({ _id: partInstanceId3 } as DBPartInstance)
		cache.PartInstances.insert({ _id: partInstanceId0 } as DBPartInstance)

		testee.updatePieceInstances(cache, showStyleBaseId)

		// All three tags should be on-air
		expect(testee.getTallyStateFromTags({ currentPieceTags: [tag5] } as IWrappedAdLib)).toEqual({
			isActive: true,
			isNext: false,
		})
		expect(testee.getTallyStateFromTags({ currentPieceTags: [tag6] } as IWrappedAdLib)).toEqual({
			isActive: true,
			isNext: false,
		})
		expect(testee.getTallyStateFromTags({ currentPieceTags: [tag0] } as IWrappedAdLib)).toEqual({
			isActive: true,
			isNext: false,
		})
	})
})
