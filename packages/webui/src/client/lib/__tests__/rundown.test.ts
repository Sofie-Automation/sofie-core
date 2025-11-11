import {
	setupDefaultStudioEnvironment,
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	convertToUIShowStyleBase,
	convertToUIStudio,
} from '../../../__mocks__/helpers/database.js'
import { RundownUtils } from '../rundown.js'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { defaultPartInstance, defaultPiece, defaultPieceInstance } from '../../../__mocks__/defaultCollectionObjects.js'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PartInstances, PieceInstances, Pieces, RundownPlaylists } from '../../collections/index.js'
import { MongoMock } from '../../../__mocks__/mongo.js'
import { RundownPlaylistCollectionUtil } from '../../collections/rundownPlaylistUtil.js'
import { RundownPlaylistClientUtil } from '../rundownPlaylistUtil.js'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'

const mockRundownPlaylistsCollection = MongoMock.getInnerMockCollection(RundownPlaylists)
const mockPartInstancesCollection = MongoMock.getInnerMockCollection(PartInstances)
const mockPieceInstancesCollection = MongoMock.getInnerMockCollection(PieceInstances)
const mockPiecesCollection = MongoMock.getInnerMockCollection(Pieces)

// This is a hack, the tests should be rewritten to not use methods unrelated to the testee
jest.mock('../../ui/Collections', () => {
	const mockClientCollections = jest.requireActual('../../ui/Collections')
	const mockLibCollections = jest.requireActual('../../collections/index')
	return {
		...mockClientCollections,
		UIParts: mockLibCollections.Parts, // for most purposes they're equivalent
		UIPartInstances: mockLibCollections.PartInstances, // for most purposes they're equivalent
	}
})

describe('client/lib/rundown', () => {
	let env: DefaultEnvironment
	let playlistId: RundownPlaylistId
	let studio: UIStudio
	beforeEach(async () => {
		env = await setupDefaultStudioEnvironment()
		playlistId = (await setupDefaultRundownPlaylist(env)).playlistId
		studio = convertToUIStudio(env.studio)
	})
	describe('RundownUtils.getResolvedSegment', () => {
		test('Basic Segment resolution', () => {
			const showStyleBase = convertToUIShowStyleBase(env.showStyleBase)
			const playlist = RundownPlaylists.findOne(playlistId)
			if (!playlist) throw new Error('Rundown not found')

			const { currentPartInstance, nextPartInstance } =
				RundownPlaylistClientUtil.getSelectedPartInstances(playlist)

			const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
			const { parts, segments } = RundownPlaylistClientUtil.getSegmentsAndPartsSync(playlist)
			const rundown = rundowns[0]
			const segment = segments[0]

			const resolvedSegment = RundownUtils.getResolvedSegment(
				showStyleBase,
				studio,
				playlist,
				rundown,
				segment,
				new Set(segments.slice(0, 0).map((s) => s._id)),
				[],
				new Map(),
				parts.map((part) => part._id),
				currentPartInstance,
				nextPartInstance
			)
			expect(resolvedSegment).toBeTruthy()
			expect(resolvedSegment.parts).toHaveLength(2)
			expect(resolvedSegment).toMatchObject({
				isLiveSegment: false,
				isNextSegment: false,
				currentLivePart: undefined,
				currentNextPart: undefined,
				hasRemoteItems: false,
				hasGuestItems: false,
				hasAlreadyPlayed: false,
				autoNextPart: false,
			})
			expect(resolvedSegment).toMatchSnapshot()
		})

		test('Infinite Piece starting in first Part is populated across the Segment', () => {
			const showStyleBase = convertToUIShowStyleBase(env.showStyleBase)
			const sourceLayerIds = Object.keys(showStyleBase.sourceLayers)
			const outputLayerIds = Object.keys(showStyleBase.outputLayers)

			const playlist = RundownPlaylists.findOne(playlistId)
			if (!playlist) throw new Error('Playlist not found')

			const { currentPartInstance, nextPartInstance } =
				RundownPlaylistClientUtil.getSelectedPartInstances(playlist)

			const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
			const { parts, segments } = RundownPlaylistClientUtil.getSegmentsAndPartsSync(playlist)
			const rundown = rundowns[0]
			const rundownId = rundown._id
			const segment = segments[1]
			const firstPart = parts.find((part) => part.segmentId === segment._id)

			if (!firstPart) throw new Error('Mock Segment 1 not found')

			const infinitePiece: Piece = {
				...defaultPiece(protectString(rundownId + '_infinite_piece'), rundownId, segment._id, firstPart._id),
				externalId: 'MOCK_INFINITE_PIECE',
				name: 'Infinite',
				sourceLayerId: sourceLayerIds[0],
				outputLayerId: outputLayerIds[0],
				enable: {
					start: 1000,
				},
				lifespan: PieceLifespan.OutOnSegmentEnd,
			}

			mockPiecesCollection.insert(infinitePiece)

			const resolvedSegment = RundownUtils.getResolvedSegment(
				showStyleBase,
				studio,
				playlist,
				rundown,
				segment,
				new Set(segments.slice(0, 1).map((s) => s._id)),
				[],
				new Map(),
				parts.map((part) => part._id),
				currentPartInstance,
				nextPartInstance
			)
			expect(resolvedSegment).toBeTruthy()
			expect(resolvedSegment.parts).toHaveLength(3)
			expect(resolvedSegment).toMatchObject({
				isLiveSegment: false,
				isNextSegment: false,
				currentLivePart: undefined,
				currentNextPart: undefined,
				hasRemoteItems: false,
				hasGuestItems: false,
				hasAlreadyPlayed: false,
				autoNextPart: false,
			})
			const resolvedInfinitePiece00 = resolvedSegment.parts[0].pieces.find(
				(piece) => piece.instance.piece._id === infinitePiece._id
			)
			expect(resolvedInfinitePiece00).toBeDefined()
			expect(resolvedInfinitePiece00?.renderedInPoint).toBe(1000)
			expect(resolvedInfinitePiece00?.renderedDuration).toBe(null)
			const resolvedInfinitePiece01 = resolvedSegment.parts[1].pieces.find(
				(piece) => piece.instance.piece._id === infinitePiece._id
			)
			expect(resolvedInfinitePiece01).toBeDefined()
			expect(resolvedInfinitePiece01?.renderedInPoint).toBe(0)
			expect(resolvedInfinitePiece01?.renderedDuration).toBe(null)
		})

		test('Infinite Piece starting in first Part is cropped by another Piece', () => {
			const showStyleBase = convertToUIShowStyleBase(env.showStyleBase)
			const sourceLayerIds = Object.keys(showStyleBase.sourceLayers)
			const outputLayerIds = Object.keys(showStyleBase.outputLayers)

			const playlist = RundownPlaylists.findOne(playlistId)
			if (!playlist) throw new Error('Playlist not found')

			const { currentPartInstance, nextPartInstance } =
				RundownPlaylistClientUtil.getSelectedPartInstances(playlist)

			const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
			const { parts, segments } = RundownPlaylistClientUtil.getSegmentsAndPartsSync(playlist)
			const rundown = rundowns[0]
			const rundownId = rundown._id
			const segment = segments[1]
			const firstPart = parts.find((part) => part.segmentId === segment._id)

			if (!firstPart) throw new Error('Mock Segment 1 not found')

			const infinitePiece: Piece = {
				...defaultPiece(protectString(rundownId + '_infinite_piece'), rundownId, segment._id, firstPart._id),
				externalId: 'MOCK_INFINITE_PIECE',
				name: 'Infinite',
				sourceLayerId: sourceLayerIds[0],
				outputLayerId: outputLayerIds[0],
				enable: {
					start: 1000,
				},
				lifespan: PieceLifespan.OutOnSegmentChange,
			}
			mockPiecesCollection.insert(infinitePiece)

			const croppingPiece: Piece = {
				...defaultPiece(protectString(rundownId + '_cropping_piece'), rundownId, segment._id, firstPart._id),
				externalId: 'MOCK_CROPPING_PIECE',
				name: 'Cropping',
				sourceLayerId: sourceLayerIds[0],
				outputLayerId: outputLayerIds[0],
				enable: {
					start: 4000,
					duration: 1000,
				},
				lifespan: PieceLifespan.WithinPart,
			}
			mockPiecesCollection.insert(croppingPiece)

			const resolvedSegment = RundownUtils.getResolvedSegment(
				showStyleBase,
				studio,
				playlist,
				rundown,
				segment,
				new Set(segments.slice(0, 1).map((s) => s._id)),
				[],
				new Map(),
				parts.map((part) => part._id),
				currentPartInstance,
				nextPartInstance
			)
			expect(resolvedSegment).toBeTruthy()
			expect(resolvedSegment.parts).toHaveLength(3)
			expect(resolvedSegment).toMatchObject({
				isLiveSegment: false,
				isNextSegment: false,
				currentLivePart: undefined,
				currentNextPart: undefined,
				hasRemoteItems: false,
				hasGuestItems: false,
				hasAlreadyPlayed: false,
				autoNextPart: false,
			})

			expect(resolvedSegment.parts[0].pieces).toHaveLength(2)

			const resolvedInfinitePiece00 = resolvedSegment.parts[0].pieces.find(
				(piece) => piece.instance.piece._id === infinitePiece._id
			)
			expect(resolvedInfinitePiece00).toBeDefined()
			expect(resolvedInfinitePiece00?.renderedInPoint).toBe(1000)
			expect(resolvedInfinitePiece00?.renderedDuration).toBe(3000)

			const resolvedCroppingPiece00 = resolvedSegment.parts[0].pieces.find(
				(piece) => piece.instance.piece._id === croppingPiece._id
			)
			expect(resolvedCroppingPiece00).toBeDefined()
			expect(resolvedCroppingPiece00?.renderedInPoint).toBe(4000)
			expect(resolvedCroppingPiece00?.renderedDuration).toBe(1000)

			expect(resolvedSegment.parts[1].pieces).toHaveLength(0)
		})

		test("User-Stopped Infinite Piece starting in first Part maintains it's length when followed by another Piece", () => {
			const showStyleBase = convertToUIShowStyleBase(env.showStyleBase)
			const sourceLayerIds = Object.keys(showStyleBase.sourceLayers)
			const outputLayerIds = Object.keys(showStyleBase.outputLayers)

			const playlistActivationId = protectString('mock_activation_0')
			mockRundownPlaylistsCollection.update(unprotectString(playlistId), {
				$set: {
					activationId: playlistActivationId,
				},
			})

			let playlist = RundownPlaylists.findOne(playlistId)
			if (!playlist) throw new Error('Playlist not found')

			const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)
			const { parts, segments } = RundownPlaylistClientUtil.getSegmentsAndPartsSync(playlist)
			const rundown = rundowns[0]
			const rundownId = rundown._id
			const segment = segments[1]
			const firstPart = parts.find((part) => part.segmentId === segment._id)

			if (!firstPart) throw new Error('Mock Segment 1 not found')

			const infinitePiece: Piece = {
				...defaultPiece(protectString(rundownId + '_infinite_piece'), rundownId, segment._id, firstPart._id),
				externalId: 'MOCK_INFINITE_PIECE',
				name: 'Infinite',
				sourceLayerId: sourceLayerIds[0],
				outputLayerId: outputLayerIds[0],
				enable: {
					start: 1000,
				},
				lifespan: PieceLifespan.OutOnSegmentChange,
			}
			mockPiecesCollection.insert(infinitePiece)

			const followingPiece: Piece = {
				...defaultPiece(protectString(rundownId + '_cropping_piece'), rundownId, segment._id, firstPart._id),
				externalId: 'MOCK_CROPPING_PIECE',
				name: 'Cropping',
				sourceLayerId: sourceLayerIds[0],
				outputLayerId: outputLayerIds[0],
				enable: {
					start: 4000,
					duration: 1000,
				},
				lifespan: PieceLifespan.WithinPart,
			}
			mockPiecesCollection.insert(followingPiece)

			const segmentPlayoutId = protectString('mock_segment_playout_0')
			const mockCurrentPartInstance: PartInstance = {
				...defaultPartInstance(
					protectString(rundownId + '_partInstance_0'),
					playlistActivationId,
					segmentPlayoutId,
					firstPart
				),
			}

			mockPartInstancesCollection.insert(mockCurrentPartInstance)

			const infinitePieceInstance: PieceInstance = {
				...defaultPieceInstance(
					protectString('instance_' + infinitePiece._id),
					playlistActivationId,
					rundown._id,
					mockCurrentPartInstance._id,
					infinitePiece
				),
				userDuration: {
					endRelativeToPart: 2000,
				},
			}

			mockPieceInstancesCollection.insert(infinitePieceInstance)

			const followingPieceInstance: PieceInstance = {
				...defaultPieceInstance(
					protectString('instance_' + followingPiece._id),
					playlistActivationId,
					rundown._id,
					mockCurrentPartInstance._id,
					followingPiece
				),
			}

			mockPieceInstancesCollection.insert(followingPieceInstance)

			mockRundownPlaylistsCollection.update(unprotectString(playlistId), {
				$set: {
					currentPartInfo: {
						partInstanceId: mockCurrentPartInstance._id,
						rundownId: mockCurrentPartInstance.rundownId,
						manuallySelected: false,
						consumesQueuedSegmentId: false,
					},
				},
			})

			playlist = RundownPlaylists.findOne(playlistId)
			if (!playlist) throw new Error('Playlist not found')
			const { currentPartInstance, nextPartInstance } =
				RundownPlaylistClientUtil.getSelectedPartInstances(playlist)

			const resolvedSegment = RundownUtils.getResolvedSegment(
				showStyleBase,
				studio,
				playlist,
				rundown,
				segment,
				new Set(segments.slice(0, 1).map((s) => s._id)),
				[],
				new Map(),
				parts.map((part) => part._id),
				currentPartInstance,
				nextPartInstance
			)
			expect(resolvedSegment).toBeTruthy()
			expect(resolvedSegment.parts).toHaveLength(3)
			expect(resolvedSegment).toMatchObject({
				isLiveSegment: true,
				isNextSegment: false,
				currentNextPart: undefined,
				hasRemoteItems: false,
				hasGuestItems: false,
				autoNextPart: false,
			})

			expect(resolvedSegment.parts[0].pieces).toHaveLength(2)

			const resolvedInfinitePiece00 = resolvedSegment.parts[0].pieces.find(
				(piece) => piece.instance._id === infinitePieceInstance._id
			)
			expect(resolvedInfinitePiece00).toBeDefined()
			expect(resolvedInfinitePiece00?.renderedInPoint).toBe(1000)
			expect(resolvedInfinitePiece00?.renderedDuration).toBe(1000)

			const resolvedCroppingPiece00 = resolvedSegment.parts[0].pieces.find(
				(piece) => piece.instance._id === followingPieceInstance._id
			)
			expect(resolvedCroppingPiece00).toBeDefined()
			expect(resolvedCroppingPiece00?.renderedInPoint).toBe(4000)
			expect(resolvedCroppingPiece00?.renderedDuration).toBe(1000)

			expect(resolvedSegment.parts[1].pieces).toHaveLength(0)
		})
	})
})
