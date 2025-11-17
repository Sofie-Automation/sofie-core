import { JSONBlobStringify, PieceLifespan, StatusCode } from '@sofie-automation/blueprints-integration'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import {
	PartInstanceId,
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import {
	PeripheralDevice,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { EmptyPieceTimelineObjectsBlob, Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { MockJobContext, setupDefaultJobEnvironment } from '../../../../__mocks__/context.js'
import {
	defaultAdLibPiece,
	defaultPart,
	defaultPiece,
	defaultRundown,
	defaultRundownPlaylist,
	defaultSegment,
} from '../../../../__mocks__/defaultCollectionObjects.js'
import { setupMockShowStyleCompound } from '../../../../__mocks__/presetCollections.js'
import { ProcessedShowStyleCompound } from '../../../../jobs/index.js'
import { runWithPlaylistLock } from '../../../../playout/lock.js'
import { PlayoutModelImpl } from '../PlayoutModelImpl.js'
import { PlayoutRundownModelImpl } from '../PlayoutRundownModelImpl.js'
import { PlayoutSegmentModelImpl } from '../PlayoutSegmentModelImpl.js'
import _ from 'underscore'

const TIME_FAR_PAST = 1000
const TIME_CONNECTED = 2000
const TIME_PING = 3000

describe('PlayoutModelImpl', () => {
	let context: MockJobContext
	let showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>

	beforeAll(async () => {
		context = setupDefaultJobEnvironment()
		showStyleCompound = await setupMockShowStyleCompound(context)
	})

	describe('nowInPlayout', () => {
		beforeEach(async () => {
			jest.useFakeTimers()
		})

		afterEach(async () =>
			Promise.all([
				context.mockCollections.RundownBaselineAdLibPieces.remove({}),
				context.mockCollections.RundownBaselineAdLibActions.remove({}),
				context.mockCollections.RundownBaselineObjects.remove({}),
				context.mockCollections.AdLibActions.remove({}),
				context.mockCollections.AdLibPieces.remove({}),
				context.mockCollections.Pieces.remove({}),
				context.mockCollections.Parts.remove({}),
				context.mockCollections.Segments.remove({}),
				context.mockCollections.Rundowns.remove({}),
				context.mockCollections.RundownPlaylists.remove({}),
			])
		)

		it('returns the current time', async () => {
			const { playlistId: playlistId0, rundownId: rundownId0 } = await setupRundownWithAutoplayPart0(
				context,
				protectString('rundown00'),
				showStyleCompound
			)

			const playlist = await context.mockCollections.RundownPlaylists.findOne(playlistId0)

			const TIME_NOW = 5000

			const peripheralDevices = [setupMockPlayoutGateway(protectString('playoutGateway0'))]

			const { partInstances, groupedPieceInstances, rundowns } = await getPlayoutModelImplArugments(
				context,
				playlistId0,
				rundownId0
			)

			if (!playlist) throw new Error('Playlist not found!')

			jest.setSystemTime(TIME_NOW)

			await runWithPlaylistLock(context, playlistId0, async (lock) => {
				const model = new PlayoutModelImpl(
					context,
					lock,
					playlistId0,
					peripheralDevices,
					playlist,
					partInstances,
					groupedPieceInstances,
					rundowns,
					undefined
				)

				const now = model.getNowInPlayout()
				expect(now).toBeGreaterThanOrEqual(TIME_NOW)
				expect(now - TIME_NOW).toBeLessThan(100)
			})
		})

		it('never returns a smaller value', async () => {
			const { playlistId: playlistId0, rundownId: rundownId0 } = await setupRundownWithAutoplayPart0(
				context,
				protectString('rundown00'),
				showStyleCompound
			)

			const playlist = await context.mockCollections.RundownPlaylists.findOne(playlistId0)
			const TIME_NOW = 5000

			const peripheralDevices = [
				setupMockPlayoutGateway(protectString('playoutGateway0')),
				setupMockPlayoutGateway(protectString('playoutGateway1')),
			]

			const { partInstances, groupedPieceInstances, rundowns } = await getPlayoutModelImplArugments(
				context,
				playlistId0,
				rundownId0
			)

			if (!playlist) throw new Error('Playlist not found!')

			jest.setSystemTime(TIME_NOW)

			await runWithPlaylistLock(context, playlistId0, async (lock) => {
				const model = new PlayoutModelImpl(
					context,
					lock,
					playlistId0,
					peripheralDevices,
					playlist,
					partInstances,
					groupedPieceInstances,
					rundowns,
					undefined
				)

				const TIME_DELTA = 1000

				peripheralDevices[0].latencies = [20, 30, 50, 10]
				peripheralDevices[1].latencies = [20, 30, 50, 10]

				jest.advanceTimersByTime(TIME_DELTA)

				const now0 = model.getNowInPlayout()
				expect(now0).toBeGreaterThanOrEqual(TIME_NOW)

				peripheralDevices[0].latencies = [0]
				peripheralDevices[1].latencies = [0]

				const now1 = model.getNowInPlayout()
				expect(now1).toBeGreaterThanOrEqual(now0)

				jest.advanceTimersByTime(TIME_DELTA)

				const now2 = model.getNowInPlayout()
				expect(now2).toBeGreaterThanOrEqual(now1)

				peripheralDevices[0].latencies = [100, 200, 100, 50]
				peripheralDevices[1].latencies = [100, 200, 100, 50]

				const now3 = model.getNowInPlayout()
				expect(now3).toBeGreaterThanOrEqual(now2)
			})
		})
	})
})

async function getPlayoutModelImplArugments(
	context: MockJobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId
) {
	const partInstances = await context.mockCollections.PartInstances.findFetch({
		rundownId,
	})
	const pieceInstances = await context.mockCollections.PieceInstances.findFetch({
		rundownId,
	})
	const groupedPieceInstances: Map<PartInstanceId, PieceInstance[]> = new Map(
		Object.entries<PieceInstance[]>(
			_.groupBy(pieceInstances, (pieceInstance) => unprotectString(pieceInstance.partInstanceId))
		)
	) as any
	const rundowns: PlayoutRundownModelImpl[] = await Promise.all(
		(
			await context.mockCollections.Rundowns.findFetch({
				playlistId,
			})
		).map(async (rundown) => {
			const segments = await context.mockCollections.Segments.findFetch({
				rundownId: rundown._id,
			})

			const allSegmentModelImpl = await Promise.all(
				segments.map(async (segment) => {
					const parts = await context.mockCollections.Parts.findFetch({
						rundownId: rundown._id,
					})
					return new PlayoutSegmentModelImpl(segment, parts)
				})
			)
			return new PlayoutRundownModelImpl(rundown, allSegmentModelImpl, [])
		})
	)

	return {
		partInstances,
		groupedPieceInstances,
		rundowns,
	}
}

function setupMockPlayoutGateway(id: PeripheralDeviceId): PeripheralDevice {
	return {
		_id: id,
		category: PeripheralDeviceCategory.PLAYOUT,
		type: PeripheralDeviceType.PLAYOUT,
		subType: '',
		connected: true,
		configManifest: {
			deviceConfigSchema: JSONBlobStringify({}),
			subdeviceManifest: {},
		},
		connectionId: '',
		created: TIME_FAR_PAST,
		deviceName: `Dummy ${id}`,
		lastConnected: TIME_CONNECTED,
		lastSeen: TIME_PING,
		name: `Dummy ${id}`,
		status: {
			statusCode: StatusCode.GOOD,
			messages: [],
		},
		token: '',
	}
}

async function setupRundownWithAutoplayPart0(
	context: MockJobContext,
	rundownId: RundownId,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
): Promise<{ playlistId: RundownPlaylistId; rundownId: RundownId }> {
	const outputLayerIds = Object.keys(showStyle.outputLayers)
	const sourceLayerIds = Object.keys(showStyle.sourceLayers)

	const playlistId = await context.mockCollections.RundownPlaylists.insertOne(
		defaultRundownPlaylist(protectString(`playlist_${rundownId}`), context.studioId)
	)

	const rundown: DBRundown = defaultRundown(
		unprotectString(rundownId),
		context.studioId,
		null,
		playlistId,
		showStyle._id,
		showStyle.showStyleVariantId
	)
	rundown._id = rundownId
	await context.mockCollections.Rundowns.insertOne(rundown)

	const segment0: DBSegment = {
		...defaultSegment(protectString(rundownId + '_segment0'), rundown._id),
		_rank: 0,
		externalId: 'MOCK_SEGMENT_0',
		name: 'Segment 0',
	}
	await context.mockCollections.Segments.insertOne(segment0)

	const part00: DBPart = {
		...defaultPart(protectString(rundownId + '_part0_0'), rundown._id, segment0._id),
		externalId: 'MOCK_PART_0_0',
		title: 'Part 0 0',

		expectedDuration: 20000,
		autoNext: true,
	}
	await context.mockCollections.Parts.insertOne(part00)

	const piece000: Piece = {
		...defaultPiece(protectString(rundownId + '_piece000'), rundown._id, part00.segmentId, part00._id),
		externalId: 'MOCK_PIECE_000',
		name: 'Piece 000',
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
	}
	await context.mockCollections.Pieces.insertOne(piece000)

	const piece001: Piece = {
		...defaultPiece(protectString(rundownId + '_piece001'), rundown._id, part00.segmentId, part00._id),
		externalId: 'MOCK_PIECE_001',
		name: 'Piece 001',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
	}
	await context.mockCollections.Pieces.insertOne(piece001)

	const adLibPiece000: AdLibPiece = {
		...defaultAdLibPiece(protectString(rundownId + '_adLib000'), segment0.rundownId, part00._id),
		expectedDuration: 1000,
		externalId: 'MOCK_ADLIB_000',
		name: 'AdLib 0',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
	}

	await context.mockCollections.AdLibPieces.insertOne(adLibPiece000)

	const part01: DBPart = {
		...defaultPart(protectString(rundownId + '_part0_1'), rundown._id, segment0._id),
		_rank: 1,
		externalId: 'MOCK_PART_0_1',
		title: 'Part 0 1',
	}
	await context.mockCollections.Parts.insertOne(part01)

	const piece010: Piece = {
		...defaultPiece(protectString(rundownId + '_piece010'), rundown._id, part01.segmentId, part01._id),
		externalId: 'MOCK_PIECE_010',
		name: 'Piece 010',
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
	}
	await context.mockCollections.Pieces.insertOne(piece010)

	const segment1: DBSegment = {
		...defaultSegment(protectString(rundownId + '_segment1'), rundown._id),
		_rank: 1,
		externalId: 'MOCK_SEGMENT_2',
		name: 'Segment 1',
	}
	await context.mockCollections.Segments.insertOne(segment1)

	const part10: DBPart = {
		...defaultPart(protectString(rundownId + '_part1_0'), rundown._id, segment1._id),
		_rank: 0,
		externalId: 'MOCK_PART_1_0',
		title: 'Part 1 0',
	}
	await context.mockCollections.Parts.insertOne(part10)

	const piece100: Piece = {
		...defaultPiece(protectString(rundownId + '_piece100'), rundown._id, part10.segmentId, part10._id),
	}
	await context.mockCollections.Pieces.insertOne(piece100)

	const part11: DBPart = {
		...defaultPart(protectString(rundownId + '_part1_1'), rundown._id, segment1._id),
		_rank: 1,
	}
	await context.mockCollections.Parts.insertOne(part11)

	const piece110: Piece = {
		...defaultPiece(protectString(rundownId + '_piece110'), rundown._id, part11.segmentId, part11._id),
	}
	await context.mockCollections.Pieces.insertOne(piece110)

	const part12: DBPart = {
		...defaultPart(protectString(rundownId + '_part1_2'), rundown._id, segment1._id),
		_rank: 2,
	}
	await context.mockCollections.Parts.insertOne(part12)

	const piece120: Piece = {
		...defaultPiece(protectString(rundownId + '_piece120'), rundown._id, part12.segmentId, part12._id),
	}
	await context.mockCollections.Pieces.insertOne(piece120)

	const segment2: DBSegment = {
		...defaultSegment(protectString(rundownId + '_segment2'), rundown._id),
		_rank: 2,
	}
	await context.mockCollections.Segments.insertOne(segment2)

	const part20: DBPart = {
		...defaultPart(protectString(rundownId + '_part2_0'), rundown._id, segment2._id),
		_rank: 0,
	}
	await context.mockCollections.Parts.insertOne(part20)

	const piece200: Piece = {
		...defaultPiece(protectString(rundownId + '_piece200'), rundown._id, part20.segmentId, part20._id),
	}
	await context.mockCollections.Pieces.insertOne(piece200)

	const part21: DBPart = {
		...defaultPart(protectString(rundownId + '_part2_1'), rundown._id, segment2._id),
		_rank: 1,
	}
	await context.mockCollections.Parts.insertOne(part21)

	const piece210: Piece = {
		...defaultPiece(protectString(rundownId + '_piece210'), rundown._id, part21.segmentId, part21._id),
	}
	await context.mockCollections.Pieces.insertOne(piece210)

	const part22: DBPart = {
		...defaultPart(protectString(rundownId + '_part2_2'), rundown._id, segment2._id),
		_rank: 2,
	}
	await context.mockCollections.Parts.insertOne(part22)

	const segment3: DBSegment = {
		...defaultSegment(protectString(rundownId + '_segment3'), rundown._id),
		_rank: 3,
	}
	await context.mockCollections.Segments.insertOne(segment3)

	const part30: DBPart = {
		...defaultPart(protectString(rundownId + '_part3_0'), rundown._id, segment2._id),
		_rank: 0,
	}
	await context.mockCollections.Parts.insertOne(part30)

	const globalAdLib0: RundownBaselineAdLibItem = {
		_id: protectString(rundownId + '_globalAdLib0'),
		_rank: 0,
		externalId: 'MOCK_GLOBAL_ADLIB_0',
		lifespan: PieceLifespan.OutOnRundownChange,
		rundownId: segment0.rundownId,
		name: 'Global AdLib 0',
		sourceLayerId: sourceLayerIds[0],
		outputLayerId: outputLayerIds[0],
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	const globalAdLib1: RundownBaselineAdLibItem = {
		_id: protectString(rundownId + '_globalAdLib1'),
		_rank: 0,
		externalId: 'MOCK_GLOBAL_ADLIB_1',
		lifespan: PieceLifespan.OutOnRundownChange,
		rundownId: segment0.rundownId,
		name: 'Global AdLib 1',
		sourceLayerId: sourceLayerIds[1],
		outputLayerId: outputLayerIds[0],
		content: {},
		timelineObjectsString: EmptyPieceTimelineObjectsBlob,
	}

	await context.mockCollections.RundownBaselineAdLibPieces.insertOne(globalAdLib0)
	await context.mockCollections.RundownBaselineAdLibPieces.insertOne(globalAdLib1)

	return { playlistId, rundownId }
}
