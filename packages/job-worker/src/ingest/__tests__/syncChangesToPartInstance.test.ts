/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/unbound-method */
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import {
	findInstancesToSync,
	PartInstanceToSync,
	SyncChangesToPartInstancesWorker,
} from '../syncChangesToPartInstance.js'
import { mock } from 'jest-mock-extended'
import type { PlayoutModel } from '../../playout/model/PlayoutModel.js'
import type { IngestModelReadonly } from '../model/IngestModel.js'
import type { PlayoutRundownModel } from '../../playout/model/PlayoutRundownModel.js'
import type { PlayoutPartInstanceModel } from '../../playout/model/PlayoutPartInstanceModel.js'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PlayoutModelImpl } from '../../playout/model/implementation/PlayoutModelImpl.js'
import {
	BlueprintSyncIngestNewData,
	PlaylistTimingType,
	ShowStyleBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	DBRundownPlaylist,
	SelectedPartInstance,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { PlayoutRundownModelImpl } from '../../playout/model/implementation/PlayoutRundownModelImpl.js'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PlayoutSegmentModelImpl } from '../../playout/model/implementation/PlayoutSegmentModelImpl.js'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { ProcessedShowStyleCompound } from '../../jobs/index.js'
import { PartialDeep, ReadonlyDeep } from 'type-fest'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { defaultPiece } from '../../__mocks__/defaultCollectionObjects.js'

jest.mock('../../playout/adlibTesting')
import { validateAdlibTestingPartInstanceProperties } from '../../playout/adlibTesting.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
	funcPropSupport: true,
}

function createMockPart(id: string): DBPart {
	return {
		_id: protectString(id),
		_rank: 1,
		externalId: 'mockPartExternalId',
		segmentId: protectString('mockSegmentId'),
		rundownId: protectString('mockRundownId'),
		title: 'mockPartTitle',
		expectedDurationWithTransition: undefined,
		userEditOperations: undefined,
	}
}

describe('SyncChangesToPartInstancesWorker', () => {
	describe('findInstancesToSync', () => {
		function createMockPlayoutModel(): PlayoutModel {
			return mock<PlayoutModel>(
				{
					currentPartInstance: null,
					nextPartInstance: null,
					previousPartInstance: null,
				},
				mockOptions
			)
		}
		function createMockPlayoutRundownModel(): PlayoutRundownModel {
			return mock<PlayoutRundownModel>({}, mockOptions)
		}
		function createMockIngestModelReadonly(): IngestModelReadonly {
			return mock<IngestModelReadonly>({}, mockOptions)
		}

		test('No partInstances', async () => {
			const context = setupDefaultJobEnvironment()

			const playoutModel = createMockPlayoutModel()
			const ingestModel = createMockIngestModelReadonly()
			const rundownModel = createMockPlayoutRundownModel()

			const instancesToSync = findInstancesToSync(context, playoutModel, ingestModel, rundownModel, new Set())
			expect(instancesToSync).toHaveLength(0)
		})

		// TODO - this needs a lot more fleshing out
	})

	describe('syncChangesToPartInstance', () => {
		function createMockPlayoutModel(partialModel?: Partial<Pick<PlayoutModel, 'nextPartInstance'>>) {
			const mockPlayoutModel = mock<PlayoutModel>(
				{
					currentPartInstance: null,
					nextPartInstance: partialModel?.nextPartInstance ?? null,
					previousPartInstance: null,

					clearAllNotifications: jest.fn(),
					// setPartInstanceAsNext: jest.fn(),
					// removeUntakenPartInstances: jest.fn(),
				},
				mockOptions
			)

			Object.defineProperty(mockPlayoutModel, 'playlist', {
				get: () =>
					({
						tTimers: [
							{ index: 1, label: 'Timer 1', mode: null, state: null },
							{ index: 2, label: 'Timer 2', mode: null, state: null },
							{ index: 3, label: 'Timer 3', mode: null, state: null },
						],
					}) satisfies Partial<DBRundownPlaylist>,
			})

			return mockPlayoutModel
		}
		function createMockPlayoutRundownModel(): PlayoutRundownModel {
			return mock<PlayoutRundownModel>({}, mockOptions)
		}
		function createMockIngestModelReadonly(): IngestModelReadonly {
			return mock<IngestModelReadonly>(
				{
					findPart: jest.fn(() => undefined),
					getGlobalPieces: jest.fn(() => []),
					getAllOrderedParts: jest.fn(() => []),
					getOrderedSegments: jest.fn(() => []),
					findAdlibPiece: jest.fn(() => undefined),
				},
				mockOptions
			)
		}

		function createMockPartInstance(id: string): PlayoutPartInstanceModel {
			return mock<PlayoutPartInstanceModel>(
				{
					partInstance: {
						_id: protectString(id),
						part: createMockPart(id),
						segmentId: protectString('mockSegmentId'),
						rundownId: protectString('mockRundownId'),
						takeCount: 0,
						rehearsal: false,
						playlistActivationId: protectString('mockPlaylistActivationId'),
						segmentPlayoutId: protectString('mockSegmentPlayoutId'),
					} satisfies PlayoutPartInstanceModel['partInstance'],
					pieceInstances: [] satisfies PlayoutPartInstanceModel['pieceInstances'],

					recalculateExpectedDurationWithTransition: jest.fn(),
					snapshotMakeCopy: jest.fn(() => Date.now() as any),
					snapshotRestore: jest.fn(() => {
						throw new Error('snapshotRestore not expected')
					}),
				},
				mockOptions
			)
		}

		beforeEach(() => {
			jest.clearAllMocks()
		})

		test('successful with empty blueprint method', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)

			const syncIngestUpdateToPartInstanceFn = jest.fn()
			context.updateShowStyleBlueprint({
				syncIngestUpdateToPartInstance: syncIngestUpdateToPartInstanceFn,
			})
			const blueprint = await context.getShowStyleBlueprint(showStyleCompound._id)

			const playoutModel = createMockPlayoutModel()
			const ingestModel = createMockIngestModelReadonly()
			const rundownModel = createMockPlayoutRundownModel()

			const worker = new SyncChangesToPartInstancesWorker(
				context,
				playoutModel,
				ingestModel,
				showStyleCompound,
				blueprint
			)

			const partInstance = createMockPartInstance('mockPartInstanceId')
			const part = createMockPart('mockPartId')

			const instanceToSync: PartInstanceToSync = {
				playoutRundownModel: rundownModel,
				existingPartInstance: partInstance,
				previousPartInstance: null,
				playStatus: 'next',
				newPart: part,
				newPartChanged: false,
				proposedPieceInstances: Promise.resolve([]),
			}

			await worker.syncChangesToPartInstance(instanceToSync)

			expect(partInstance.snapshotMakeCopy).toHaveBeenCalledTimes(1)
			expect(partInstance.snapshotRestore).toHaveBeenCalledTimes(0)
			expect(syncIngestUpdateToPartInstanceFn).toHaveBeenCalledTimes(1)
			expect(validateAdlibTestingPartInstanceProperties).toHaveBeenCalledTimes(1)

			// An unchanged Part must report partChanged: false to the blueprint
			const newData = syncIngestUpdateToPartInstanceFn.mock.calls[0][2] as BlueprintSyncIngestNewData
			expect(newData.partChanged).toBe(false)
		})

		test('propagates partChanged=true to the blueprint when the Part changed', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)

			const syncIngestUpdateToPartInstanceFn = jest.fn()
			context.updateShowStyleBlueprint({
				syncIngestUpdateToPartInstance: syncIngestUpdateToPartInstanceFn,
			})
			const blueprint = await context.getShowStyleBlueprint(showStyleCompound._id)

			const playoutModel = createMockPlayoutModel()
			const ingestModel = createMockIngestModelReadonly()
			const rundownModel = createMockPlayoutRundownModel()

			const worker = new SyncChangesToPartInstancesWorker(
				context,
				playoutModel,
				ingestModel,
				showStyleCompound,
				blueprint
			)

			const partInstance = createMockPartInstance('mockPartInstanceId')
			const part = createMockPart('mockPartId')

			const instanceToSync: PartInstanceToSync = {
				playoutRundownModel: rundownModel,
				existingPartInstance: partInstance,
				previousPartInstance: null,
				playStatus: 'next',
				newPart: part,
				newPartChanged: true,
				proposedPieceInstances: Promise.resolve([]),
			}

			await worker.syncChangesToPartInstance(instanceToSync)

			expect(syncIngestUpdateToPartInstanceFn).toHaveBeenCalledTimes(1)
			const newData = syncIngestUpdateToPartInstanceFn.mock.calls[0][2] as BlueprintSyncIngestNewData
			expect(newData.partChanged).toBe(true)
		})

		test('removePartInstance for next calls recreateNextPartInstance', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)

			type TsyncIngestUpdateToPartInstanceFn = jest.MockedFunction<
				Required<ShowStyleBlueprintManifest>['syncIngestUpdateToPartInstance']
			>
			const syncIngestUpdateToPartInstanceFn: TsyncIngestUpdateToPartInstanceFn = jest.fn()
			context.updateShowStyleBlueprint({
				syncIngestUpdateToPartInstance: syncIngestUpdateToPartInstanceFn,
			})
			const blueprint = await context.getShowStyleBlueprint(showStyleCompound._id)

			const partInstance = createMockPartInstance('mockPartInstanceId')
			const part = createMockPart('mockPartId')

			const playoutModel = createMockPlayoutModel({ nextPartInstance: partInstance })
			const ingestModel = createMockIngestModelReadonly()
			const rundownModel = createMockPlayoutRundownModel()

			const worker = new SyncChangesToPartInstancesWorker(
				context,
				playoutModel,
				ingestModel,
				showStyleCompound,
				blueprint
			)
			// Mock the method, we can test it separately
			worker.recreateNextPartInstance = jest.fn()

			const instanceToSync: PartInstanceToSync = {
				playoutRundownModel: rundownModel,
				existingPartInstance: partInstance,
				previousPartInstance: null,
				playStatus: 'next',
				newPart: part,
				newPartChanged: false,
				proposedPieceInstances: Promise.resolve([]),
			}

			syncIngestUpdateToPartInstanceFn.mockImplementationOnce((context) => {
				// Remove the partInstance
				context.removePartInstance()
			})

			await worker.syncChangesToPartInstance(instanceToSync)

			expect(partInstance.snapshotMakeCopy).toHaveBeenCalledTimes(1)
			expect(partInstance.snapshotRestore).toHaveBeenCalledTimes(0)
			expect(syncIngestUpdateToPartInstanceFn).toHaveBeenCalledTimes(1)
			expect(validateAdlibTestingPartInstanceProperties).toHaveBeenCalledTimes(0)
			expect(worker.recreateNextPartInstance).toHaveBeenCalledTimes(1)
			expect(worker.recreateNextPartInstance).toHaveBeenCalledWith(part)
		})
	})

	describe('recreateNextPartInstance', () => {
		async function createSimplePlayoutModel(
			context: MockJobContext,
			showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>
		) {
			const playlistId = protectString<RundownPlaylistId>('mockPlaylistId')
			const playlistLock = await context.lockPlaylist(playlistId)

			const rundown: DBRundown = {
				_id: protectString('mockRundownId'),
				externalId: 'mockExternalId',
				playlistId: playlistId,
				showStyleBaseId: showStyleCompound._id,
				showStyleVariantId: showStyleCompound.showStyleVariantId,
				name: 'mockName',
				studioId: context.studioId,
				source: {
					type: 'http',
				},
				created: 0,
				modified: 0,
				importVersions: {
					blueprint: '',
					core: '',
					showStyleBase: '',
					showStyleVariant: '',
					studio: '',
				},
				timing: { type: PlaylistTimingType.None },
			}

			const segment: DBSegment = {
				_id: protectString('mockSegmentId'),
				rundownId: rundown._id,
				name: 'mockSegmentName',
				externalId: 'mockSegmentExternalId',
				_rank: 0,
			}

			const part0: DBPart = {
				_id: protectString('mockPartId0'),
				segmentId: segment._id,
				rundownId: rundown._id,
				title: 'mockPartTitle0',
				_rank: 0,
				expectedDuration: 0,
				expectedDurationWithTransition: 0,
				externalId: 'mockPartExternalId0',
			}

			const nextPartInstance: DBPartInstance = {
				_id: protectString('mockPartInstanceId'),
				part: part0,
				segmentId: segment._id,
				rundownId: rundown._id,
				takeCount: 0,
				rehearsal: false,
				playlistActivationId: protectString('mockPlaylistActivationId'),
				segmentPlayoutId: protectString('mockSegmentPlayoutId'),
			}

			const playlist: DBRundownPlaylist = {
				_id: playlistId,
				externalId: 'mockExternalId',
				activationId: protectString('mockActivationId'),
				currentPartInfo: null,
				nextPartInfo: {
					rundownId: nextPartInstance.rundownId,
					partInstanceId: nextPartInstance._id,
					manuallySelected: false,
					consumesQueuedSegmentId: false,
				},
				previousPartsInfo: [],
				studioId: context.studioId,
				name: 'mockName',
				created: 0,
				modified: 0,
				timing: { type: PlaylistTimingType.None },
				rundownIdsInOrder: [],
				tTimers: [
					{ index: 1, label: '', mode: null, state: null },
					{ index: 2, label: '', mode: null, state: null },
					{ index: 3, label: '', mode: null, state: null },
				],
			}

			const segmentModel = new PlayoutSegmentModelImpl(segment, [part0])
			const rundownModel = new PlayoutRundownModelImpl(rundown, [segmentModel], [])
			const playoutModel = new PlayoutModelImpl(
				context,
				playlistLock,
				playlistId,
				[],
				playlist,
				[nextPartInstance],
				new Map(),
				[rundownModel],
				undefined
			)

			return { playlistId, playoutModel, part0, nextPartInstance }
		}

		function createMockIngestModelReadonly(unsavedPieces?: {
			rundownId: RundownId
			pieces: ReadonlyDeep<Piece>[]
		}): IngestModelReadonly {
			return mock<IngestModelReadonly>(
				{
					findPart: jest.fn(() => undefined),
					rundownId: unsavedPieces?.rundownId,
					getAllPieces: jest.fn(() => unsavedPieces?.pieces ?? []),
				},
				mockOptions
			)
		}

		test('clear auto chosen partInstance', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)
			const blueprint = await context.getShowStyleBlueprint(showStyleCompound._id)

			const { playoutModel } = await createSimplePlayoutModel(context, showStyleCompound)

			const ingestModel = createMockIngestModelReadonly()

			const worker = new SyncChangesToPartInstancesWorker(
				context,
				playoutModel,
				ingestModel,
				showStyleCompound,
				blueprint
			)

			expect(playoutModel.nextPartInstance).toBeTruthy()
			expect(playoutModel.playlist.nextPartInfo).toEqual({
				partInstanceId: playoutModel.nextPartInstance!.partInstance._id,
				rundownId: playoutModel.nextPartInstance!.partInstance.rundownId,
				consumesQueuedSegmentId: false,
				manuallySelected: false,
			} satisfies SelectedPartInstance)

			await worker.recreateNextPartInstance(undefined)

			expect(playoutModel.nextPartInstance).toBeFalsy()
		})

		test('clear manually chosen partInstance', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)
			const blueprint = await context.getShowStyleBlueprint(showStyleCompound._id)

			const { playoutModel } = await createSimplePlayoutModel(context, showStyleCompound)

			const ingestModel = createMockIngestModelReadonly()

			const worker = new SyncChangesToPartInstancesWorker(
				context,
				playoutModel,
				ingestModel,
				showStyleCompound,
				blueprint
			)

			expect(playoutModel.nextPartInstance).toBeTruthy()
			// Force the next part to be manually selected, and verify
			playoutModel.setPartInstanceAsNext(playoutModel.nextPartInstance, true, false)
			expect(playoutModel.playlist.nextPartInfo).toEqual({
				partInstanceId: playoutModel.nextPartInstance!.partInstance._id,
				rundownId: playoutModel.nextPartInstance!.partInstance.rundownId,
				consumesQueuedSegmentId: false,
				manuallySelected: true,
			} satisfies SelectedPartInstance)

			await worker.recreateNextPartInstance(undefined)

			expect(playoutModel.nextPartInstance).toBeFalsy()
		})

		test('clear manually chosen partInstance with replacement part', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)
			const blueprint = await context.getShowStyleBlueprint(showStyleCompound._id)

			const { playoutModel, part0 } = await createSimplePlayoutModel(context, showStyleCompound)

			const ingestModel = createMockIngestModelReadonly()

			const worker = new SyncChangesToPartInstancesWorker(
				context,
				playoutModel,
				ingestModel,
				showStyleCompound,
				blueprint
			)

			expect(playoutModel.nextPartInstance).toBeTruthy()
			const partInstanceIdBefore = playoutModel.nextPartInstance!.partInstance._id

			// Force the next part to be manually selected, and verify
			playoutModel.setPartInstanceAsNext(playoutModel.nextPartInstance, true, false)
			expect(playoutModel.playlist.nextPartInfo).toEqual({
				partInstanceId: playoutModel.nextPartInstance!.partInstance._id,
				rundownId: playoutModel.nextPartInstance!.partInstance.rundownId,
				consumesQueuedSegmentId: false,
				manuallySelected: true,
			} satisfies SelectedPartInstance)

			await worker.recreateNextPartInstance(part0)

			expect(playoutModel.nextPartInstance).toBeTruthy()
			// Must have been regenerated
			expect(playoutModel.nextPartInstance!.partInstance._id).not.toEqual(partInstanceIdBefore)
			expect(playoutModel.nextPartInstance!.partInstance).toMatchObject({
				part: {
					_id: part0._id,
				},
			} satisfies PartialDeep<DBPartInstance>)

			// Make sure the part is still manually selected
			expect(playoutModel.playlist.nextPartInfo).toEqual({
				partInstanceId: playoutModel.nextPartInstance!.partInstance._id,
				rundownId: playoutModel.nextPartInstance!.partInstance.rundownId,
				consumesQueuedSegmentId: false,
				manuallySelected: true,
			} satisfies SelectedPartInstance)
		})

		test('replacement partInstance uses the unsaved Pieces from the IngestModel', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)
			const blueprint = await context.getShowStyleBlueprint(showStyleCompound._id)

			const { playoutModel, part0 } = await createSimplePlayoutModel(context, showStyleCompound)

			// The database still holds the Piece as it was before the ingest operation
			const savedPiece = defaultPiece(protectString('mockPieceId0'), part0.rundownId, part0.segmentId, part0._id)
			await context.mockCollections.Pieces.insertOne(savedPiece)

			// The IngestModel holds the updated Piece, which has not been written to the database yet
			const unsavedPiece: Piece = { ...savedPiece, name: 'Updated Piece' }
			const ingestModel = createMockIngestModelReadonly({
				rundownId: part0.rundownId,
				pieces: [unsavedPiece],
			})

			const worker = new SyncChangesToPartInstancesWorker(
				context,
				playoutModel,
				ingestModel,
				showStyleCompound,
				blueprint
			)

			// Force the next part to be manually selected, so that it gets re-created
			playoutModel.setPartInstanceAsNext(playoutModel.nextPartInstance, true, false)

			await worker.recreateNextPartInstance(part0)

			expect(playoutModel.nextPartInstance).toBeTruthy()
			expect(playoutModel.nextPartInstance!.pieceInstances).toHaveLength(1)
			expect(playoutModel.nextPartInstance!.pieceInstances[0].pieceInstance.piece.name).toBe('Updated Piece')
		})
	})
})
