/* eslint-disable @typescript-eslint/no-non-null-assertion */
import _ from 'underscore'
import {
	IBlueprintPart,
	IBlueprintPiece,
	IBlueprintPieceType,
	PieceLifespan,
} from '@sofie-automation/blueprints-integration'
import { PlayoutModel } from '../../../../playout/model/PlayoutModel.js'
import { MockJobContext, setupDefaultJobEnvironment } from '../../../../__mocks__/context.js'
import { runJobWithPlayoutModel } from '../../../../playout/lock.js'
import { defaultRundownPlaylist } from '../../../../__mocks__/defaultCollectionObjects.js'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { clone, getRandomId, literal, normalizeArrayToMapFunc, omit } from '@sofie-automation/corelib/dist/lib'
import {
	PartInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupDefaultRundown, setupMockShowStyleCompound } from '../../../../__mocks__/presetCollections.js'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { JobContext } from '../../../../jobs/index.js'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { getCurrentTime } from '../../../../lib/index.js'
import {
	EmptyPieceTimelineObjectsBlob,
	Piece,
	serializePieceTimelineObjectsBlob,
} from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PlayoutPartInstanceModel } from '../../../../playout/model/PlayoutPartInstanceModel.js'
import { convertPartInstanceToBlueprints, convertPieceInstanceToBlueprints } from '../../lib.js'
import { TimelineObjRundown, TimelineObjType } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { PlayoutPartInstanceModelImpl } from '../../../../playout/model/implementation/PlayoutPartInstanceModelImpl.js'
import { writePartInstancesAndPieceInstances } from '../../../../playout/model/implementation/SavePlayoutModel.js'
import { PlayoutPieceInstanceModel } from '../../../../playout/model/PlayoutPieceInstanceModel.js'
import { DatabasePersistedModel } from '../../../../modelBase.js'
import { SelectedPartInstance } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

import * as PlayoutAdlib from '../../../../playout/adlibUtils.js'
type TinnerStopPieces = jest.MockedFunction<typeof PlayoutAdlib.innerStopPieces>
const innerStopPiecesMock = jest.spyOn(PlayoutAdlib, 'innerStopPieces') as TinnerStopPieces
const insertQueuedPartWithPiecesOrig = PlayoutAdlib.insertQueuedPartWithPieces
type TinsertQueuedPartWithPieces = jest.MockedFunction<typeof PlayoutAdlib.insertQueuedPartWithPieces>
const insertQueuedPartWithPiecesMock = jest.spyOn(
	PlayoutAdlib,
	'insertQueuedPartWithPieces'
) as TinsertQueuedPartWithPieces

jest.mock('../../../../playout/resolvedPieces')
import { getResolvedPiecesForCurrentPartInstance } from '../../../../playout/resolvedPieces.js'
type TgetResolvedPiecesForCurrentPartInstance = jest.MockedFunction<typeof getResolvedPiecesForCurrentPartInstance>
const getResolvedPiecesForCurrentPartInstanceMock =
	getResolvedPiecesForCurrentPartInstance as TgetResolvedPiecesForCurrentPartInstance

jest.mock('../../../postProcess')
import { postProcessPieces, postProcessTimelineObjects } from '../../../postProcess.js'
import { ActionPartChange, PartAndPieceInstanceActionService } from '../PartAndPieceInstanceActionService.js'
import { mock } from 'jest-mock-extended'
import { QuickLoopService } from '../../../../playout/model/services/QuickLoopService.js'
const { postProcessPieces: postProcessPiecesOrig, postProcessTimelineObjects: postProcessTimelineObjectsOrig } =
	jest.requireActual('../../../postProcess')

type TpostProcessPieces = jest.MockedFunction<typeof postProcessPieces>
const postProcessPiecesMock = postProcessPieces as TpostProcessPieces
postProcessPiecesMock.mockImplementation(() => [])

type TpostProcessTimelineObjects = jest.MockedFunction<typeof postProcessTimelineObjects>
const postProcessTimelineObjectsMock = postProcessTimelineObjects as TpostProcessTimelineObjects
postProcessTimelineObjectsMock.mockImplementation(postProcessTimelineObjectsOrig)

// TODO: These should be rewritten to only test as far as the PartInstanceWithPieces interface
describe('Test blueprint api context', () => {
	async function generateSparsePieceInstances(
		context: MockJobContext,
		activationId: RundownPlaylistActivationId,
		rundownId: RundownId
	): Promise<PlayoutPartInstanceModel[]> {
		const parts = await context.mockCollections.Parts.findFetch({ rundownId })
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]

			// make into a partInstance
			await context.mockCollections.PartInstances.insertOne({
				_id: protectString(`${part._id}_instance`),
				rundownId: part.rundownId,
				segmentId: part.segmentId,
				playlistActivationId: activationId,
				segmentPlayoutId: protectString(''),
				takeCount: i,
				rehearsal: false,
				part,
			})

			const pieces = await context.mockCollections.Pieces.findFetch({
				startPartId: part._id,
				startRundownId: rundownId,
			})
			for (const p of pieces) {
				await context.mockCollections.PieceInstances.insertOne({
					_id: protectString(`${part._id}_piece_${p._id}`),
					rundownId: rundownId,
					partInstanceId: protectString(`${part._id}_instance`),
					playlistActivationId: activationId,
					piece: p,
				})
			}

			const count = ((i + 2) % 4) + 1 // Some consistent randomness
			for (let o = 0; o < count; o++) {
				await context.mockCollections.PieceInstances.insertOne({
					_id: protectString(`${part._id}_piece${o}`),
					rundownId: rundownId,
					partInstanceId: protectString(`${part._id}_instance`),
					playlistActivationId: activationId,
					piece: {
						_id: protectString(`${part._id}_piece_inner${o}`),
						externalId: '-',
						enable: { start: 0 },
						name: 'mock',
						sourceLayerId: '',
						outputLayerId: '',
						startPartId: part._id,
						content: {
							index: o,
						} as any,
						timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						lifespan: PieceLifespan.WithinPart,
						pieceType: IBlueprintPieceType.Normal,
						invalid: false,
					},
				})
			}
		}

		const partInstances = await context.mockCollections.PartInstances.findFetch({ rundownId })
		return Promise.all(
			partInstances.map(async (partInstance) => {
				// This isn't performant, but that shouldn't matter here
				const pieceInstances = await context.mockCollections.PieceInstances.findFetch({
					partInstanceId: partInstance._id,
				})
				return new PlayoutPartInstanceModelImpl(partInstance, pieceInstances, false, mock<QuickLoopService>())
			})
		)
	}

	async function getTestee(jobContext: JobContext, playoutModel: PlayoutModel) {
		const playlist = playoutModel.playlist
		expect(playlist).toBeTruthy()
		const rundown = playoutModel.rundowns[0]
		expect(rundown).toBeTruthy()

		const activationId = playlist.activationId as RundownPlaylistActivationId
		expect(activationId).toBeTruthy()

		const showStyle = await jobContext.getShowStyleCompound(
			rundown.rundown.showStyleVariantId,
			rundown.rundown.showStyleBaseId
		)

		const service = new PartAndPieceInstanceActionService(jobContext, playoutModel, showStyle, rundown)

		return {
			playlist,
			rundown,
			service,
			activationId,
		}
	}

	async function wrapWithPlayoutModel<T>(
		context: JobContext,
		playlistId: RundownPlaylistId,
		fcn: (playoutModel: PlayoutModel & DatabasePersistedModel) => Promise<T>
	): Promise<T> {
		return runJobWithPlayoutModel(context, { playlistId }, null, fcn as any)
	}

	async function setupMyDefaultRundown(
		insertExtraContents?: (jobContext: MockJobContext, rundownId: RundownId) => Promise<void>
	): Promise<{
		jobContext: MockJobContext
		playlistId: RundownPlaylistId
		rundownId: RundownId
		allPartInstances: PlayoutPartInstanceModel[]
	}> {
		const context = setupDefaultJobEnvironment()

		const playlistId: RundownPlaylistId = protectString('playlist0')
		const activationId: RundownPlaylistActivationId = getRandomId()

		await context.mockCollections.RundownPlaylists.insertOne({
			...defaultRundownPlaylist(playlistId, context.studioId),
			// Mark playlist as active
			activationId: activationId,
		})

		const showStyleCompound = await setupMockShowStyleCompound(context)
		expect(showStyleCompound).toBeTruthy()

		const rundownId: RundownId = getRandomId()

		await setupDefaultRundown(context, showStyleCompound, playlistId, rundownId)

		if (insertExtraContents) await insertExtraContents(context, rundownId)

		const allPartInstances = await generateSparsePieceInstances(context, activationId, rundownId)
		expect(allPartInstances).toHaveLength(5)

		return {
			jobContext: context,
			playlistId: playlistId,
			rundownId: rundownId,
			allPartInstances,
		}
	}

	async function saveAllToDatabase(
		context: JobContext,
		playoutModel: PlayoutModel & DatabasePersistedModel,
		allPartInstances: PlayoutPartInstanceModel[]
	) {
		// We need to push changes back to 'mongo' for these tests
		await Promise.all(
			writePartInstancesAndPieceInstances(
				context,
				normalizeArrayToMapFunc(allPartInstances as PlayoutPartInstanceModelImpl[], (p) => p.partInstance._id)
			)
		)
		await playoutModel.saveAllToDatabase()
	}

	async function setPartInstances(
		jobContext: MockJobContext,
		playlistId: RundownPlaylistId,
		currentPartInstance: PlayoutPartInstanceModel | DBPartInstance | PieceInstance | undefined | null,
		nextPartInstance: PlayoutPartInstanceModel | DBPartInstance | PieceInstance | undefined | null,
		previousPartInstance?: PlayoutPartInstanceModel | DBPartInstance | PieceInstance | null
	) {
		const convertInfo = (
			info: PlayoutPartInstanceModel | DBPartInstance | PieceInstance | null
		): SelectedPartInstance | null => {
			if (!info) {
				return null
			} else if ('partInstanceId' in info) {
				return {
					partInstanceId: info.partInstanceId,
					rundownId: info.rundownId,
					manuallySelected: false,
					consumesQueuedSegmentId: false,
				}
			} else if ('partInstance' in info) {
				return {
					partInstanceId: info.partInstance._id,
					rundownId: info.partInstance.rundownId,
					manuallySelected: false,
					consumesQueuedSegmentId: false,
				}
			} else {
				return {
					partInstanceId: info._id,
					rundownId: info.rundownId,
					manuallySelected: false,
					consumesQueuedSegmentId: false,
				}
			}
		}

		if (currentPartInstance !== undefined) {
			await jobContext.mockCollections.RundownPlaylists.update(playlistId, {
				$set: {
					currentPartInfo: convertInfo(currentPartInstance),
				},
			})
		}

		if (nextPartInstance !== undefined) {
			await jobContext.mockCollections.RundownPlaylists.update(playlistId, {
				$set: {
					nextPartInfo: convertInfo(nextPartInstance),
				},
			})
		}

		if (previousPartInstance !== undefined) {
			await jobContext.mockCollections.RundownPlaylists.update(playlistId, {
				$set: {
					previousPartInfo: convertInfo(previousPartInstance),
				},
			})
		}
	}

	describe('PartAndPieceInstanceActionService', () => {
		describe('getPartInstance', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// @ts-ignore
					await expect(service.getPartInstance()).rejects.toThrow('Unknown part "undefined"')
					// @ts-ignore
					await expect(service.getPartInstance('abc')).rejects.toThrow('Unknown part "abc"')
					// @ts-ignore
					await expect(service.getPartInstance(6)).rejects.toThrow('Unknown part "6"')
					// @ts-ignore
					await expect(service.getPartInstance('previous')).rejects.toThrow('Unknown part "previous"')
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					expect(playoutModel.loadedPartInstances).toHaveLength(0)

					await expect(service.getPartInstance('next')).resolves.toBeUndefined()
					await expect(service.getPartInstance('current')).resolves.toBeUndefined()
				})

				await setPartInstances(jobContext, playlistId, allPartInstances[1], undefined)
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					expect(playoutModel.loadedPartInstances).toHaveLength(2)

					// Check the current part
					await expect(service.getPartInstance('next')).resolves.toBeUndefined()
					await expect(service.getPartInstance('current')).resolves.toMatchObject({
						_id: allPartInstances[1].partInstance._id,
					})
				})

				await setPartInstances(jobContext, playlistId, null, allPartInstances[2])
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					expect(playoutModel.loadedPartInstances).toHaveLength(3)

					// Now the next part
					await expect(service.getPartInstance('next')).resolves.toMatchObject({
						_id: allPartInstances[2].partInstance._id,
					})
					await expect(service.getPartInstance('current')).resolves.toBeUndefined()
				})
			})
		})
		describe('getPieceInstances', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// @ts-ignore
					await expect(service.getPieceInstances()).rejects.toThrow('Unknown part "undefined"')
					// @ts-ignore
					await expect(service.getPieceInstances('abc')).rejects.toThrow('Unknown part "abc"')
					// @ts-ignore
					await expect(service.getPieceInstances(6)).rejects.toThrow('Unknown part "6"')
					// @ts-ignore
					await expect(service.getPieceInstances('previous')).rejects.toThrow('Unknown part "previous"')
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					expect(playoutModel.loadedPartInstances).toHaveLength(0)

					await expect(service.getPieceInstances('next')).resolves.toHaveLength(0)
					await expect(service.getPieceInstances('current')).resolves.toHaveLength(0)
				})

				await setPartInstances(jobContext, playlistId, allPartInstances[1], undefined)
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					expect(playoutModel.loadedPartInstances).toHaveLength(2)

					// Check the current part
					await expect(service.getPieceInstances('next')).resolves.toHaveLength(0)
					await expect(service.getPieceInstances('current')).resolves.toHaveLength(5)
				})

				await setPartInstances(jobContext, playlistId, null, allPartInstances[2])
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					expect(playoutModel.loadedPartInstances).toHaveLength(3)

					// Now the next part
					await expect(service.getPieceInstances('next')).resolves.toHaveLength(1)
					await expect(service.getPieceInstances('current')).resolves.toHaveLength(0)
				})
			})
		})
		describe('getResolvedPieceInstances', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// @ts-ignore
					await expect(service.getResolvedPieceInstances()).rejects.toThrow('Unknown part "undefined"')
					// @ts-ignore
					await expect(service.getResolvedPieceInstances('abc')).rejects.toThrow('Unknown part "abc"')
					// @ts-ignore
					await expect(service.getResolvedPieceInstances(6)).rejects.toThrow('Unknown part "6"')
					// @ts-ignore
					await expect(service.getResolvedPieceInstances('previous')).rejects.toThrow(
						'Unknown part "previous"'
					)
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					expect(playoutModel.loadedPartInstances).toHaveLength(0)

					expect(getResolvedPiecesForCurrentPartInstanceMock).toHaveBeenCalledTimes(0)

					await expect(service.getResolvedPieceInstances('next')).resolves.toHaveLength(0)
					await expect(service.getResolvedPieceInstances('current')).resolves.toHaveLength(0)
					expect(getResolvedPiecesForCurrentPartInstanceMock).toHaveBeenCalledTimes(0)
				})

				let mockCalledIds: PartInstanceId[] = []
				getResolvedPiecesForCurrentPartInstanceMock.mockImplementation(
					(
						service2: JobContext,
						sourceLayers: SourceLayers,
						partInstance: PlayoutPartInstanceModel,
						now?: number
					) => {
						expect(service2).toBe(jobContext)
						expect(sourceLayers).toBeTruthy()
						expect(now).toBeFalsy()
						mockCalledIds.push(partInstance.partInstance._id)
						return [
							{
								instance: {
									_id: 'abc',
									piece: {
										timelineObjectsString: EmptyPieceTimelineObjectsBlob,
									},
								} as any as PieceInstance,
								resolvedStart: 0,
								timelinePriority: 0,
							},
						]
					}
				)

				await setPartInstances(jobContext, playlistId, allPartInstances[1], undefined)
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					expect(playoutModel.loadedPartInstances).toHaveLength(2)
					// Check the current part
					await expect(service.getResolvedPieceInstances('next')).resolves.toHaveLength(0)
					await expect(
						service.getResolvedPieceInstances('current').then((res) => res.map((p) => p._id))
					).resolves.toEqual(['abc'])
					expect(getResolvedPiecesForCurrentPartInstanceMock).toHaveBeenCalledTimes(1)
					expect(mockCalledIds).toEqual([allPartInstances[1].partInstance._id])
				})

				mockCalledIds = []
				getResolvedPiecesForCurrentPartInstanceMock.mockClear()

				await setPartInstances(jobContext, playlistId, null, allPartInstances[2])
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					expect(playoutModel.loadedPartInstances).toHaveLength(3)

					// Now the next part
					await expect(
						service.getResolvedPieceInstances('next').then((res) => res.map((p) => p._id))
					).resolves.toEqual(['abc'])
					await expect(service.getResolvedPieceInstances('current')).resolves.toHaveLength(0)
					expect(getResolvedPiecesForCurrentPartInstanceMock).toHaveBeenCalledTimes(1)
					expect(mockCalledIds).toEqual([allPartInstances[2].partInstance._id])
				})
			})
		})
		describe('findLastPieceOnLayer', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// We need to push changes back to 'mongo' for these tests
					await playoutModel.saveAllToDatabase()

					// @ts-ignore
					await expect(service.findLastPieceOnLayer()).resolves.toBeUndefined()
					// @ts-ignore
					await expect(service.findLastPieceOnLayer(9867, 'hi')).resolves.toBeUndefined()
				})
			})

			test('basic and original only', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					allPartInstances[0].setTaken(getCurrentTime(), 0)

					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, playoutModel, allPartInstances)

					// const allPartInstances = playoutModel.SortedLoadedPartInstances
					expect(allPartInstances).toHaveLength(5)

					const sourceLayerIds = Object.keys(service.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					// No playback has begun, so nothing should happen
					await expect(service.findLastPieceOnLayer(sourceLayerIds[0], undefined)).resolves.toBeUndefined()
					await expect(service.findLastPieceOnLayer(sourceLayerIds[1], undefined)).resolves.toBeUndefined()

					// Insert a piece that is played
					const insertedPieceInstance = allPartInstances[0].insertAdlibbedPiece(
						{
							_id: getRandomId(),
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						undefined
					)
					insertedPieceInstance.setPlannedStartedPlayback(1000)
					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, playoutModel, allPartInstances)

					await expect(service.findLastPieceOnLayer(sourceLayerIds[0], undefined)).resolves.toMatchObject({
						_id: insertedPieceInstance.pieceInstance._id,
					})
					await expect(
						service.findLastPieceOnLayer(sourceLayerIds[0], { originalOnly: true })
					).resolves.toBeUndefined()

					// Insert another more recent piece that is played
					const insertedPieceInstance2 = allPartInstances[0].insertAdlibbedPiece(
						{
							_id: getRandomId(),
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						undefined
					)
					insertedPieceInstance2.setPlannedStartedPlayback(2000)

					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, playoutModel, allPartInstances)

					await expect(service.findLastPieceOnLayer(sourceLayerIds[0], undefined)).resolves.toMatchObject({
						_id: insertedPieceInstance2.pieceInstance._id,
					})
					await expect(
						service.findLastPieceOnLayer(sourceLayerIds[0], { originalOnly: true })
					).resolves.toBeUndefined()
				})
			})

			test('excludeCurrentPart', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await setPartInstances(jobContext, playlistId, allPartInstances[2], undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					allPartInstances[0].setTaken(getCurrentTime(), 0)

					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, playoutModel, allPartInstances)

					expect(allPartInstances).toHaveLength(5)

					const sourceLayerIds = Object.keys(service.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					// No playback has begun, so nothing should happen
					await expect(service.findLastPieceOnLayer(sourceLayerIds[0], undefined)).resolves.toBeUndefined()
					await expect(service.findLastPieceOnLayer(sourceLayerIds[1], undefined)).resolves.toBeUndefined()

					// Insert a couple of pieces that are played
					const insertedPieceInstance = allPartInstances[0].insertAdlibbedPiece(
						{
							_id: getRandomId(),
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						undefined
					)
					insertedPieceInstance.setPlannedStartedPlayback(1000)
					const insertedPieceInstance2 = allPartInstances[2].insertAdlibbedPiece(
						{
							_id: getRandomId(),
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						undefined
					)
					insertedPieceInstance2.setPlannedStartedPlayback(2000)
					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, playoutModel, allPartInstances)

					// Check it
					await expect(service.findLastPieceOnLayer(sourceLayerIds[0], undefined)).resolves.toMatchObject({
						_id: insertedPieceInstance2.pieceInstance._id,
					})
					await expect(
						service.findLastPieceOnLayer(sourceLayerIds[0], { excludeCurrentPart: true })
					).resolves.toMatchObject({
						_id: insertedPieceInstance.pieceInstance._id,
					})
				})
			})

			test('piecePrivateDataFilter', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await setPartInstances(jobContext, playlistId, allPartInstances[2], undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					allPartInstances[0].setTaken(getCurrentTime(), 0)

					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, playoutModel, allPartInstances)

					expect(allPartInstances).toHaveLength(5)

					const sourceLayerIds = Object.keys(service.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					// No playback has begun, so nothing should happen
					await expect(service.findLastPieceOnLayer(sourceLayerIds[0], undefined)).resolves.toBeUndefined()
					await expect(service.findLastPieceOnLayer(sourceLayerIds[1], undefined)).resolves.toBeUndefined()

					// Insert a couple of pieces that are played
					const insertedPieceInstance = allPartInstances[0].insertAdlibbedPiece(
						{
							_id: getRandomId(),
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							enable: { start: 0 },
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						undefined
					)
					insertedPieceInstance.setPlannedStartedPlayback(1000)
					const insertedPieceInstance2 = allPartInstances[2].insertAdlibbedPiece(
						{
							_id: getRandomId(),
							externalId: '',
							name: 'abc',
							sourceLayerId: sourceLayerIds[0],
							outputLayerId: '',
							enable: { start: 0 },
							privateData: {
								prop1: 'hello',
								prop2: '5',
							},
							lifespan: PieceLifespan.OutOnSegmentChange,
							pieceType: IBlueprintPieceType.Normal,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						},
						undefined
					)
					insertedPieceInstance2.setPlannedStartedPlayback(2000)
					// We need to push changes back to 'mongo' for these tests
					await saveAllToDatabase(jobContext, playoutModel, allPartInstances)

					// Check it
					await expect(service.findLastPieceOnLayer(sourceLayerIds[0], undefined)).resolves.toMatchObject({
						_id: insertedPieceInstance2.pieceInstance._id,
					})
					await expect(
						service.findLastPieceOnLayer(sourceLayerIds[0], { piecePrivateDataFilter: {} })
					).resolves.toMatchObject({
						_id: insertedPieceInstance2.pieceInstance._id,
					})
					await expect(
						service.findLastPieceOnLayer(sourceLayerIds[0], { piecePrivateDataFilter: { prop1: 'hello' } })
					).resolves.toMatchObject({ _id: insertedPieceInstance2.pieceInstance._id })
					await expect(
						service.findLastPieceOnLayer(sourceLayerIds[0], {
							piecePrivateDataFilter: { prop1: { $ne: 'hello' } },
						})
					).resolves.toMatchObject({ _id: insertedPieceInstance.pieceInstance._id })
				})
			})
		})

		describe('findLastScriptedPieceOnLayer', () => {
			test('No Current Part', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// We need to push changes back to 'mongo' for these tests
					await playoutModel.saveAllToDatabase()

					const sourceLayerIds = Object.keys(service.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					// No playback has begun, so nothing should happen
					await expect(
						service.findLastScriptedPieceOnLayer(sourceLayerIds[0], undefined)
					).resolves.toBeUndefined()
					await expect(
						service.findLastScriptedPieceOnLayer(sourceLayerIds[1], undefined)
					).resolves.toBeUndefined()
				})
			})

			test('First Part', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const segmentIds = (await jobContext.mockCollections.Segments.findFetch({ rundownId }))
					.sort((a, b) => a._rank - b._rank)
					.map((s) => s._id)

				const partInstances = (
					await jobContext.mockCollections.PartInstances.findFetch({ segmentId: segmentIds[0] })
				).sort((a, b) => a.part._rank - b.part._rank)
				expect(partInstances).toHaveLength(2)

				const pieceInstances = await jobContext.mockCollections.PieceInstances.findFetch({
					partInstanceId: { $in: partInstances.map((p) => p._id) },
				})
				expect(pieceInstances).toHaveLength(10)

				// Set Part 1 as current part
				await setPartInstances(jobContext, playlistId, partInstances[0], undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					const sourceLayerIds = Object.keys(service.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					const expectedPieceInstanceSourceLayer0 = pieceInstances.find(
						(p) =>
							p.partInstanceId === playoutModel.playlist.currentPartInfo?.partInstanceId &&
							p.piece.sourceLayerId === sourceLayerIds[0]
					)
					expect(expectedPieceInstanceSourceLayer0).not.toBeUndefined()

					const expectedPieceSourceLayer0 = await jobContext.mockCollections.Pieces.findOne({
						_id: expectedPieceInstanceSourceLayer0?.piece._id,
					})
					await expect(
						service.findLastScriptedPieceOnLayer(sourceLayerIds[0], undefined)
					).resolves.toMatchObject({
						_id: expectedPieceSourceLayer0?._id,
					})

					const expectedPieceInstanceSourceLayer1 = pieceInstances.find(
						(p) =>
							p.partInstanceId === playoutModel.playlist.currentPartInfo?.partInstanceId &&
							p.piece.sourceLayerId === sourceLayerIds[1]
					)
					expect(expectedPieceInstanceSourceLayer1).not.toBeUndefined()

					const expectedPieceSourceLayer1 = await jobContext.mockCollections.Pieces.findOne({
						_id: expectedPieceInstanceSourceLayer1?.piece._id,
					})
					await expect(
						service.findLastScriptedPieceOnLayer(sourceLayerIds[1], undefined)
					).resolves.toMatchObject({
						_id: expectedPieceSourceLayer1?._id,
					})
				})
			})

			test('First Part, Ignore Current Part', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const segmentIds = (await jobContext.mockCollections.Segments.findFetch({ rundownId }))
					.sort((a, b) => a._rank - b._rank)
					.map((s) => s._id)

				const partInstances = (
					await jobContext.mockCollections.PartInstances.findFetch({ segmentId: segmentIds[0] })
				).sort((a, b) => a.part._rank - b.part._rank)
				expect(partInstances).toHaveLength(2)

				// Set Part 1 as current part
				await setPartInstances(jobContext, playlistId, partInstances[0], undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					const sourceLayerIds = Object.keys(service.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					await expect(
						service.findLastScriptedPieceOnLayer(sourceLayerIds[0], { excludeCurrentPart: true })
					).resolves.toBeUndefined()
				})
			})

			test('Second Part', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const segmentIds = (await jobContext.mockCollections.Segments.findFetch({ rundownId }))
					.sort((a, b) => a._rank - b._rank)
					.map((s) => s._id)

				const partInstances = (
					await jobContext.mockCollections.PartInstances.findFetch({ segmentId: segmentIds[0] })
				).sort((a, b) => a.part._rank - b.part._rank)
				expect(partInstances).toHaveLength(2)

				const pieceInstances = await jobContext.mockCollections.PieceInstances.findFetch({
					partInstanceId: { $in: partInstances.map((p) => p._id) },
				})
				expect(pieceInstances).toHaveLength(10)

				// Set Part 2 as current part
				await setPartInstances(jobContext, playlistId, partInstances[1], undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					const sourceLayerIds = Object.keys(service.showStyleCompound.sourceLayers)
					expect(sourceLayerIds).toHaveLength(4)

					const expectedPieceInstanceSourceLayer0 = pieceInstances.find(
						(p) =>
							p.partInstanceId === playoutModel.playlist.currentPartInfo?.partInstanceId &&
							p.piece.sourceLayerId === sourceLayerIds[0]
					)
					expect(expectedPieceInstanceSourceLayer0).not.toBeUndefined()

					const expectedPieceSourceLayer0 = await jobContext.mockCollections.Pieces.findOne({
						_id: expectedPieceInstanceSourceLayer0?.piece._id,
					})
					await expect(
						service.findLastScriptedPieceOnLayer(sourceLayerIds[0], undefined)
					).resolves.toMatchObject({
						_id: expectedPieceSourceLayer0?._id,
					})

					// Part 2 does not have any pieces on this sourcelayer, so we should find the piece from part 1
					const expectedPieceInstanceSourceLayer1 = pieceInstances.find(
						(p) => p.partInstanceId === partInstances[0]._id && p.piece.sourceLayerId === sourceLayerIds[1]
					)
					expect(expectedPieceInstanceSourceLayer0).not.toBeUndefined()

					const expectedPieceSourceLayer1 = await jobContext.mockCollections.Pieces.findOne({
						_id: expectedPieceInstanceSourceLayer1?.piece._id,
					})
					await expect(
						service.findLastScriptedPieceOnLayer(sourceLayerIds[1], undefined)
					).resolves.toMatchObject({
						_id: expectedPieceSourceLayer1?._id,
					})
				})
			})
		})

		describe('getPartInstanceForPreviousPiece', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// @ts-ignore
					await expect(service.getPartInstanceForPreviousPiece()).rejects.toThrow(
						'Cannot find PartInstance from invalid PieceInstance'
					)
					// @ts-ignore
					await expect(service.getPartInstanceForPreviousPiece({})).rejects.toThrow(
						'Cannot find PartInstance from invalid PieceInstance'
					)
					// @ts-ignore
					await expect(service.getPartInstanceForPreviousPiece('abc')).rejects.toThrow(
						'Cannot find PartInstance from invalid PieceInstance'
					)
					await expect(
						service.getPartInstanceForPreviousPiece({
							// @ts-ignore
							partInstanceId: 6,
						})
					).rejects.toThrow('Cannot find PartInstance for PieceInstance')
					await expect(
						// @ts-ignore
						service.getPartInstanceForPreviousPiece({
							partInstanceId: 'abc',
						})
					).rejects.toThrow('Cannot find PartInstance for PieceInstance')
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				// Try with nothing in the cache
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					expect(playoutModel.loadedPartInstances).toHaveLength(0)

					await expect(
						service.getPartInstanceForPreviousPiece({
							partInstanceId: allPartInstances[1].partInstance._id,
						} as any)
					).resolves.toMatchObject({
						_id: allPartInstances[1].partInstance._id,
					})

					await expect(
						service.getPartInstanceForPreviousPiece({
							partInstanceId: allPartInstances[4].partInstance._id,
						} as any)
					).resolves.toMatchObject({
						_id: allPartInstances[4].partInstance._id,
					})
				})

				// Again with stuff in the cache
				await setPartInstances(jobContext, playlistId, allPartInstances[1], undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					expect(playoutModel.loadedPartInstances).toHaveLength(2)

					await expect(
						service.getPartInstanceForPreviousPiece({
							partInstanceId: allPartInstances[1].partInstance._id,
						} as any)
					).resolves.toMatchObject({
						_id: allPartInstances[1].partInstance._id,
					})

					await expect(
						service.getPartInstanceForPreviousPiece({
							partInstanceId: allPartInstances[4].partInstance._id,
						} as any)
					).resolves.toMatchObject({
						_id: allPartInstances[4].partInstance._id,
					})
				})
			})
		})

		describe('getPartForPreviousPiece', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// @ts-ignore
					await expect(service.getPartForPreviousPiece()).rejects.toThrow(
						'Cannot find Part from invalid Piece'
					)
					// @ts-ignore
					await expect(service.getPartForPreviousPiece({})).rejects.toThrow(
						'Cannot find Part from invalid Piece'
					)
					// @ts-ignore
					await expect(service.getPartForPreviousPiece('abc')).rejects.toThrow(
						'Cannot find Part from invalid Piece'
					)
					await expect(
						service.getPartForPreviousPiece({
							// @ts-ignore
							partInstanceId: 6,
						})
					).rejects.toThrow('Cannot find Part from invalid Piece')
					await expect(
						// @ts-ignore
						service.getPartForPreviousPiece({
							_id: 'abc',
						})
					).rejects.toThrow('Cannot find Piece abc')
				})
			})

			test('valid parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				// Try with nothing in the cache
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					expect(playoutModel.loadedPartInstances).toHaveLength(0)

					const pieceInstance0 = (await jobContext.mockCollections.PieceInstances.findOne({
						partInstanceId: allPartInstances[0].partInstance._id,
					})) as PieceInstance
					expect(pieceInstance0).not.toBeUndefined()

					await expect(
						service.getPartForPreviousPiece({ _id: unprotectString(pieceInstance0.piece._id) })
					).resolves.toMatchObject({
						_id: allPartInstances[0].partInstance.part._id,
					})

					const pieceInstance1 = (await jobContext.mockCollections.PieceInstances.findOne({
						partInstanceId: allPartInstances[1].partInstance._id,
					})) as PieceInstance
					expect(pieceInstance1).not.toBeUndefined()

					await expect(
						service.getPartForPreviousPiece({ _id: unprotectString(pieceInstance1.piece._id) })
					).resolves.toMatchObject({
						_id: allPartInstances[1].partInstance.part._id,
					})
				})
			})
		})

		describe('queuePart', () => {
			beforeEach(() => {
				postProcessPiecesMock.mockClear()
				insertQueuedPartWithPiecesMock.mockClear()
			})

			test('bad parameters', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// No next-part
					// @ts-ignore
					await expect(service.queuePart()).rejects.toThrow('Cannot queue part when no current partInstance')
				})

				const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance).toBeTruthy()
				await setPartInstances(jobContext, playlistId, partInstance, undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// Next part has already been modified
					service.nextPartState = ActionPartChange.SAFE_CHANGE
					// @ts-ignore
					await expect(service.queuePart('previous')).rejects.toThrow(
						'Cannot queue part when next part has already been modified'
					)
					service.nextPartState = ActionPartChange.NONE

					await expect(service.queuePart({} as any, [])).rejects.toThrow(
						'New part must contain at least one piece'
					)

					expect(postProcessPiecesMock).toHaveBeenCalledTimes(0)
					expect(insertQueuedPartWithPiecesMock).toHaveBeenCalledTimes(0)

					postProcessPiecesMock.mockImplementationOnce(() => {
						throw new Error('Mock process error')
					})
					await expect(service.queuePart({} as any, [{}] as any)).rejects.toThrow('Mock process error')
					expect(postProcessPiecesMock).toHaveBeenCalledTimes(1)
					expect(insertQueuedPartWithPiecesMock).toHaveBeenCalledTimes(0)

					const partInstanceModel = playoutModel.getPartInstance(partInstance._id) as PlayoutPartInstanceModel
					expect(partInstanceModel).toBeTruthy()

					partInstanceModel.updatePartProps({
						autoNext: true,
						expectedDuration: 700,
					})
					partInstanceModel.setPlannedStartedPlayback(getCurrentTime())

					expect(partInstanceModel.isTooCloseToAutonext(true)).toBeTruthy()
					await expect(service.queuePart({} as any, [{}] as any)).rejects.toThrow(
						'Too close to an autonext to queue a part'
					)

					expect(service.nextPartState).toEqual(ActionPartChange.NONE)
					expect(service.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})

			test('good', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance).toBeTruthy()
				await setPartInstances(jobContext, playlistId, partInstance, undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					const newPiece: IBlueprintPiece = {
						name: 'test piece',
						sourceLayerId: 'sl1',
						outputLayerId: 'o1',
						externalId: '-',
						enable: { start: 0 },
						lifespan: PieceLifespan.OutOnRundownEnd,
						content: {
							timelineObjects: [],
						},
					}
					const newPart: IBlueprintPart = {
						externalId: 'nope',
						title: 'something',
					}

					expect(postProcessPiecesMock).toHaveBeenCalledTimes(0)
					expect(insertQueuedPartWithPiecesMock).toHaveBeenCalledTimes(0)

					// Create it with most of the real flow
					postProcessPiecesMock.mockImplementationOnce(postProcessPiecesOrig)
					insertQueuedPartWithPiecesMock.mockImplementationOnce(insertQueuedPartWithPiecesOrig)
					expect((await service.queuePart(newPart, [newPiece]))._id).toEqual(
						playoutModel.playlist.nextPartInfo?.partInstanceId
					)

					expect(postProcessPiecesMock).toHaveBeenCalledTimes(1)
					expect(insertQueuedPartWithPiecesMock).toHaveBeenCalledTimes(1)

					// Verify some properties not exposed to the blueprints
					const newPartInstance = playoutModel.getPartInstance(
						playoutModel.playlist.nextPartInfo!.partInstanceId
					)!
					expect(newPartInstance).toBeTruthy()
					expect(newPartInstance.partInstance.part._rank).toBeLessThan(9000)
					expect(newPartInstance.partInstance.part._rank).toEqual(0.5)
					expect(newPartInstance.partInstance.orphaned).toEqual('adlib-part')

					const newNextPieceInstances = await service.getPieceInstances('next')
					expect(newNextPieceInstances).toHaveLength(1)
					expect(newNextPieceInstances[0].partInstanceId).toEqual(
						unprotectString(newPartInstance.partInstance._id)
					)

					expect(service.nextPartState).toEqual(ActionPartChange.SAFE_CHANGE)
					expect(service.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})

			test('queued part does not hijack infinites from following parts', async () => {
				// makes sure that infinites which would normally start in the part AFTER the part that is being queued,
				// are not starting in the queued part itself

				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown(
					async (context, rundownId) => {
						const secondPart = await context.mockCollections.Parts.findOne({ externalId: 'MOCK_PART_0_1' })
						if (!secondPart) throw Error('could not find mock part')
						const piece001: Piece = {
							_id: protectString(rundownId + '_piece012'),
							externalId: 'MOCK_PIECE_012',
							startRundownId: rundownId,
							startSegmentId: secondPart.segmentId,
							startPartId: secondPart._id,
							name: 'Piece 012',
							enable: {
								start: 0,
							},
							sourceLayerId: '',
							outputLayerId: '',
							pieceType: IBlueprintPieceType.Normal,
							lifespan: PieceLifespan.OutOnSegmentEnd,
							invalid: false,
							content: {},
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						}
						await context.mockCollections.Pieces.insertOne(piece001)
					}
				)

				const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance).toBeTruthy()
				await setPartInstances(jobContext, playlistId, partInstance, undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					const newPiece: IBlueprintPiece = {
						name: 'test piece',
						sourceLayerId: 'sl1',
						outputLayerId: 'o1',
						externalId: '-',
						enable: { start: 0 },
						lifespan: PieceLifespan.OutOnRundownEnd,
						content: {
							timelineObjects: [],
						},
					}
					const newPart: IBlueprintPart = {
						externalId: 'nope',
						title: 'something',
					}

					// Create it with most of the real flow
					postProcessPiecesMock.mockImplementationOnce(postProcessPiecesOrig)
					insertQueuedPartWithPiecesMock.mockImplementationOnce(insertQueuedPartWithPiecesOrig)
					expect((await service.queuePart(newPart, [newPiece]))._id).toEqual(
						playoutModel.playlist.nextPartInfo?.partInstanceId
					)

					const newNextPartInstances = await service.getPieceInstances('next')
					expect(newNextPartInstances).toHaveLength(1)
					expect(newNextPartInstances[0].piece.name).toBe('test piece')
				})
			})
		})

		describe('insertPiece', () => {
			beforeEach(() => {
				postProcessPiecesMock.mockClear()
			})

			test('bad parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				await setPartInstances(jobContext, playlistId, allPartInstances[0], undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					const currentPartInstance = playoutModel.currentPartInstance!
					expect(currentPartInstance).toBeTruthy()
					currentPartInstance.setTaken(getCurrentTime(), 0)

					const insertSpy = jest.spyOn(currentPartInstance, 'insertAdlibbedPiece')

					// @ts-ignore
					await expect(service.insertPiece()).rejects.toThrow('Unknown part "undefined"')
					// @ts-ignore
					await expect(service.insertPiece('previous')).rejects.toThrow('Unknown part "previous"')
					// @ts-ignore
					await expect(service.insertPiece('next')).rejects.toThrow('Cannot insert piece when no active part')

					expect(postProcessPiecesMock).toHaveBeenCalledTimes(0)
					expect(insertSpy).toHaveBeenCalledTimes(0)

					postProcessPiecesMock.mockImplementationOnce(() => {
						throw new Error('Mock process error')
					})
					await expect(service.insertPiece('current', {} as any)).rejects.toThrow('Mock process error')
					expect(postProcessPiecesMock).toHaveBeenCalledTimes(1)
					expect(insertSpy).toHaveBeenCalledTimes(0)
				})
			})

			test('good', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				const partInstance = allPartInstances[0]

				await setPartInstances(jobContext, playlistId, partInstance, undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					postProcessPiecesMock.mockImplementationOnce(() => [
						{
							_id: 'fake4', // Should be ignored
							timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						} as any,
					])

					const currentPartInstance = playoutModel.currentPartInstance!
					expect(currentPartInstance).toBeTruthy()
					currentPartInstance.setTaken(getCurrentTime(), 0)

					const insertSpy = jest.spyOn(currentPartInstance, 'insertAdlibbedPiece')

					const newPieceInstanceId = (await service.insertPiece('current', { externalId: 'input1' } as any))
						._id
					expect(newPieceInstanceId).toMatch(/randomId(\d+)_part0_0_instance_randomId(\d+)/)
					expect(postProcessPiecesMock).toHaveBeenCalledTimes(1)
					expect(postProcessPiecesMock).toHaveBeenCalledWith(
						expect.anything(),
						[{ externalId: 'input1' }],
						'blueprint0',
						partInstance.partInstance.rundownId,
						partInstance.partInstance.segmentId,
						partInstance.partInstance.part._id,
						true
					)
					expect(insertSpy).toHaveBeenCalledTimes(1)

					// check some properties not exposed to the blueprints
					const newPieceInstance = playoutModel.findPieceInstance(protectString(newPieceInstanceId))
						?.pieceInstance as PlayoutPieceInstanceModel
					expect(newPieceInstance).toBeTruthy()
					expect(newPieceInstance.pieceInstance.dynamicallyInserted).toBeTruthy()
					expect(newPieceInstance.pieceInstance.partInstanceId).toEqual(partInstance.partInstance._id)
				})
			})
		})

		describe('updatePieceInstance', () => {
			test('bad parameters', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				const pieceInstance = (await jobContext.mockCollections.PieceInstances.findOne({
					partInstanceId: allPartInstances[0].partInstance._id,
				})) as PieceInstance
				expect(pieceInstance).toBeTruthy()
				const pieceInstanceOther = (await jobContext.mockCollections.PieceInstances.findOne({
					partInstanceId: allPartInstances[1].partInstance._id,
				})) as PieceInstance
				expect(pieceInstanceOther).toBeTruthy()

				await setPartInstances(jobContext, playlistId, undefined, undefined, allPartInstances[0])

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					await expect(service.updatePieceInstance('abc', {})).rejects.toThrow(
						'Some valid properties must be defined'
					)
					await expect(service.updatePieceInstance('abc', { _id: 'bad', nope: 'ok' } as any)).rejects.toThrow(
						'Some valid properties must be defined'
					)
					await expect(service.updatePieceInstance('abc', { sourceLayerId: 'new' })).rejects.toThrow(
						'PieceInstance could not be found'
					)
					await expect(
						service.updatePieceInstance(unprotectString(pieceInstance._id), { sourceLayerId: 'new' })
					).rejects.toThrow('Can only update piece instances in current or next part instance')
					await expect(
						service.updatePieceInstance(unprotectString(pieceInstanceOther._id), { sourceLayerId: 'new' })
					).rejects.toThrow('PieceInstance could not be found')
				})

				// Set a current part instance
				await setPartInstances(jobContext, playlistId, pieceInstance, undefined, pieceInstanceOther)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)
					await expect(service.updatePieceInstance('abc', { sourceLayerId: 'new' })).rejects.toThrow(
						'PieceInstance could not be found'
					)
					await expect(
						service.updatePieceInstance(unprotectString(pieceInstance._id), { sourceLayerId: 'new' })
					).resolves.toBeTruthy()
					await expect(
						service.updatePieceInstance(unprotectString(pieceInstanceOther._id), { sourceLayerId: 'new' })
					).rejects.toThrow('Can only update piece instances in current or next part instance')
				})

				// Set as next part instance
				await setPartInstances(jobContext, playlistId, null, pieceInstance, pieceInstanceOther)
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)
					await expect(service.updatePieceInstance('abc', { sourceLayerId: 'new' })).rejects.toThrow(
						'PieceInstance could not be found'
					)
					await expect(
						service.updatePieceInstance(unprotectString(pieceInstance._id), { sourceLayerId: 'new' })
					).resolves.toBeTruthy()
					await expect(
						service.updatePieceInstance(unprotectString(pieceInstanceOther._id), { sourceLayerId: 'new' })
					).rejects.toThrow('Can only update piece instances in current or next part instance')
				})
			})

			test('good', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				// Find a piece to modify
				const pieceInstance0 = (await jobContext.mockCollections.PieceInstances.findOne({
					rundownId,
				})) as PieceInstance
				expect(pieceInstance0).toBeTruthy()
				await setPartInstances(jobContext, playlistId, pieceInstance0, undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// Ensure there are no pending updates already
					for (const partInstance of playoutModel.loadedPartInstances) {
						expect((partInstance as PlayoutPartInstanceModelImpl).hasAnyChanges()).toBeFalsy()
					}

					// Update it and expect it to match
					const pieceInstance0Before = clone(pieceInstance0)
					const pieceInstance0Delta: any = {
						_id: 'sdf', // This will be dropped
						sourceLayerId: 'new',
						enable: { start: 99, end: 123 },
						badProperty: 9, // This will be dropped
						content: {
							timelineObjects: [
								literal<TimelineObjRundown>({
									id: 'a',
									enable: { start: 0 },
									content: {} as any,
									layer: 1,
									objectType: TimelineObjType.RUNDOWN,
									priority: 0,
								}),
							],
						},
					}
					const resultPiece = await service.updatePieceInstance(
						unprotectString(pieceInstance0._id),
						pieceInstance0Delta
					)
					const { pieceInstance: pieceInstance1, partInstance: partInstance1 } =
						playoutModel.findPieceInstance(pieceInstance0._id)!
					expect(pieceInstance1).toBeTruthy()

					expect(resultPiece).toEqual(convertPieceInstanceToBlueprints(pieceInstance1.pieceInstance))
					const pieceInstance0After = {
						...pieceInstance0Before,
						neededExpectedPackageIds: [],
						piece: {
							...pieceInstance0Before.piece,
							...omit(pieceInstance0Delta, 'badProperty', '_id'),
							content: {
								...omit(pieceInstance0Delta.content, 'timelineObjects'),
							},
							timelineObjectsString: serializePieceTimelineObjectsBlob(
								pieceInstance0Delta.content.timelineObjects
							),
						},
					}
					expect(pieceInstance1.pieceInstance).toEqual(pieceInstance0After)
					expect((partInstance1 as PlayoutPartInstanceModelImpl).partInstanceHasChanges).toBeFalsy()
					expect((partInstance1 as PlayoutPartInstanceModelImpl).changedPieceInstanceIds()).toEqual([
						pieceInstance1.pieceInstance._id,
					])

					expect(service.nextPartState).toEqual(ActionPartChange.NONE)
					expect(service.currentPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})

			test('can update infinite piece from previous part if in current part instance', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				const currentPartInstance = allPartInstances[1]

				// Create an infinite piece instance continued from previous part
				const pieceInstance: PieceInstance = {
					_id: protectString('piece_infinite'),
					rundownId: currentPartInstance.partInstance.rundownId,
					partInstanceId: currentPartInstance.partInstance._id,
					playlistActivationId: currentPartInstance.partInstance.playlistActivationId,
					piece: {
						_id: protectString('piece_infinite_p'),
						externalId: '-',
						enable: { start: 0 },
						name: 'infinite',
						sourceLayerId: '',
						outputLayerId: '',
						startPartId: allPartInstances[0].partInstance.part._id,
						content: {},
						timelineObjectsString: EmptyPieceTimelineObjectsBlob,
						lifespan: PieceLifespan.OutOnRundownEnd,
						pieceType: IBlueprintPieceType.Normal,
						invalid: false,
					},
					infinite: {
						infiniteInstanceId: getRandomId(),
						infiniteInstanceIndex: 1,
						infinitePieceId: protectString('piece_infinite_p'),
						fromPreviousPart: true,
					},
				}

				await jobContext.mockCollections.PieceInstances.insertOne(pieceInstance)

				await setPartInstances(jobContext, playlistId, currentPartInstance, undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// Updating it in CURRENT part should succeed
					await expect(
						service.updatePieceInstance(unprotectString(pieceInstance._id), { name: 'updated' })
					).resolves.toBeTruthy()
				})
			})

			test('updating lifespan to infinite sets dynamicallyConvertedToInfinite', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				const currentPartInstance = allPartInstances[0]
				const pieceInstance = (await jobContext.mockCollections.PieceInstances.findOne({
					partInstanceId: currentPartInstance.partInstance._id,
				})) as PieceInstance
				expect(pieceInstance).toBeTruthy()
				expect(pieceInstance.piece.lifespan).toEqual(PieceLifespan.WithinPart)
				expect(pieceInstance.infinite).toBeUndefined()

				await setPartInstances(jobContext, playlistId, currentPartInstance, undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					await service.updatePieceInstance(unprotectString(pieceInstance._id), {
						lifespan: PieceLifespan.OutOnRundownEnd,
					})

					const updatedPieceInstance = playoutModel.findPieceInstance(pieceInstance._id)?.pieceInstance
					expect(updatedPieceInstance).toBeTruthy()
					expect(updatedPieceInstance?.pieceInstance.piece.lifespan).toEqual(PieceLifespan.OutOnRundownEnd)
					expect(updatedPieceInstance?.pieceInstance.infinite).toBeTruthy()
					expect(updatedPieceInstance?.pieceInstance.dynamicallyConvertedToInfinite).toBeTruthy()
				})
			})
		})

		describe('stopPiecesOnLayers', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await setPartInstances(jobContext, playlistId, null, undefined)
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					innerStopPiecesMock.mockClear()
					await expect(service.stopPiecesOnLayers(['lay1'], 34)).resolves.toEqual([])
					expect(innerStopPiecesMock).toHaveBeenCalledTimes(0)

					expect(service.nextPartState).toEqual(ActionPartChange.NONE)
					expect(service.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})
			test('valid parameters', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const currentPartInstance = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				await setPartInstances(jobContext, playlistId, currentPartInstance, undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					innerStopPiecesMock.mockClear()
					let filter: (piece: PieceInstance) => boolean = null as any
					innerStopPiecesMock.mockImplementationOnce(
						(service2, playoutModel2, showStyleBase, partInstance, filter2, offset) => {
							expect(service2).toBe(jobContext)
							expect(playoutModel2).toBe(playoutModel)
							expect(showStyleBase).toBeTruthy()
							expect(partInstance.partInstance).toStrictEqual(currentPartInstance)
							expect(offset).toEqual(34)
							filter = filter2

							return [protectString('result1')]
						}
					)

					// Ensure it behaves as expected
					await expect(service.stopPiecesOnLayers(['lay1'], 34)).resolves.toEqual(['result1'])
					expect(innerStopPiecesMock).toHaveBeenCalledTimes(1)
					expect(filter).toBeTruthy()

					// Now verify the filter works as intended
					expect(filter({ piece: { sourceLayerId: 'lay1' } } as any)).toBeTruthy()
					expect(filter({ piece: {} } as any)).toBeFalsy()
					expect(filter({ piece: { sourceLayerId: 'lay2' } } as any)).toBeFalsy()

					expect(service.nextPartState).toEqual(ActionPartChange.NONE)
					expect(service.currentPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})
		})

		describe('stopPieceInstances', () => {
			test('invalid parameters', async () => {
				const { jobContext, playlistId } = await setupMyDefaultRundown()

				await setPartInstances(jobContext, playlistId, null, undefined)
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					innerStopPiecesMock.mockClear()
					await expect(service.stopPieceInstances(['lay1'], 34)).resolves.toEqual([])
					expect(innerStopPiecesMock).toHaveBeenCalledTimes(0)

					expect(service.nextPartState).toEqual(ActionPartChange.NONE)
					expect(service.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})
			test('valid parameters', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const currentPartInstance = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(currentPartInstance).toBeTruthy()
				await setPartInstances(jobContext, playlistId, currentPartInstance, undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					innerStopPiecesMock.mockClear()
					let filter: (piece: PieceInstance) => boolean = null as any
					innerStopPiecesMock.mockImplementationOnce(
						(service2, playoutModel2, showStyleBase, partInstance, filter2, offset) => {
							expect(service2).toBe(jobContext)
							expect(playoutModel2).toBe(playoutModel)
							expect(showStyleBase).toBeTruthy()
							expect(partInstance.partInstance).toStrictEqual(currentPartInstance)
							expect(offset).toEqual(34)
							filter = filter2

							return [protectString('result1')]
						}
					)

					// Ensure it behaves as expected
					await expect(service.stopPieceInstances(['lay1'], 34)).resolves.toEqual(['result1'])
					expect(innerStopPiecesMock).toHaveBeenCalledTimes(1)
					expect(filter).toBeTruthy()

					// Now verify the filter works as intended
					expect(filter({ _id: 'lay1' } as any)).toBeTruthy()
					expect(filter({} as any)).toBeFalsy()
					expect(filter({ id: 'lay2' } as any)).toBeFalsy()

					expect(service.nextPartState).toEqual(ActionPartChange.NONE)
					expect(service.currentPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})
		})
		describe('removePieceInstances', () => {
			interface PieceInstanceCounts {
				other: number
				previous: number
				current: number
				next: number
			}
			function getPieceInstanceCounts(playoutModel: PlayoutModel): PieceInstanceCounts {
				let other = 0
				for (const partInstance of playoutModel.olderPartInstances) {
					other += partInstance.pieceInstances.length
				}

				return {
					other,
					previous: playoutModel.previousPartInstance?.pieceInstances?.length ?? 0,
					current: playoutModel.currentPartInstance?.pieceInstances?.length ?? 0,
					next: playoutModel.nextPartInstance?.pieceInstances?.length ?? 0,
				}
			}

			function expectCountsToEqual(counts: PieceInstanceCounts, old: PieceInstanceCounts): void {
				expect(counts.previous).toEqual(old.previous)
				expect(counts.current).toEqual(old.current)
				expect(counts.next).toEqual(old.next)
				expect(counts.other).toEqual(old.other)
			}

			test('invalid parameters', async () => {
				const { jobContext, playlistId, rundownId, allPartInstances } = await setupMyDefaultRundown()

				// No instance id
				await setPartInstances(jobContext, playlistId, undefined, null)
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// No instance id
					await expect(service.removePieceInstances('next', ['lay1'])).rejects.toThrow(
						'Cannot remove pieceInstances when no selected partInstance'
					)
				})

				// Ensure missing/bad ids dont delete anything
				const partInstance = allPartInstances[0]
				await setPartInstances(jobContext, playlistId, undefined, partInstance)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)
					const beforePieceInstancesCounts = getPieceInstanceCounts(playoutModel)
					expect(beforePieceInstancesCounts.previous).toEqual(0)
					expect(beforePieceInstancesCounts.current).toEqual(0)
					expect(beforePieceInstancesCounts.next).not.toEqual(0)
					expect(beforePieceInstancesCounts.other).toEqual(0)

					const pieceInstanceFromOther = (await jobContext.mockCollections.PieceInstances.findOne({
						rundownId,
						partInstanceId: { $ne: partInstance.partInstance._id },
					})) as PieceInstance
					expect(pieceInstanceFromOther).toBeTruthy()

					await expect(service.removePieceInstances('next', [])).resolves.toEqual([])
					await expect(
						service.removePieceInstances('next', [unprotectString(pieceInstanceFromOther._id)])
					).resolves.toEqual([]) // Try and remove something belonging to a different part
					expectCountsToEqual(getPieceInstanceCounts(playoutModel), beforePieceInstancesCounts)
				})
			})

			test('good - from next', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				const partInstance = allPartInstances[0]
				await setPartInstances(jobContext, playlistId, undefined, partInstance)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					const beforePieceInstancesCounts = getPieceInstanceCounts(playoutModel)
					expect(beforePieceInstancesCounts.previous).toEqual(0)
					expect(beforePieceInstancesCounts.current).toEqual(0)
					expect(beforePieceInstancesCounts.next).not.toEqual(0)
					expect(beforePieceInstancesCounts.other).toEqual(0)

					// Find the instance, and create its backing piece
					const targetPieceInstance = playoutModel.nextPartInstance!.pieceInstances[0]
					expect(targetPieceInstance).toBeTruthy()

					await expect(
						service.removePieceInstances('next', [unprotectString(targetPieceInstance.pieceInstance._id)])
					).resolves.toEqual([unprotectString(targetPieceInstance.pieceInstance._id)])

					// Ensure it was all removed
					expect(playoutModel.findPieceInstance(targetPieceInstance.pieceInstance._id)).toBeFalsy()
					expect(service.nextPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})

			test('good - from current', async () => {
				const { jobContext, playlistId, allPartInstances } = await setupMyDefaultRundown()

				const partInstance = allPartInstances[0]
				await setPartInstances(jobContext, playlistId, partInstance, undefined)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					const beforePieceInstancesCounts = getPieceInstanceCounts(playoutModel)
					expect(beforePieceInstancesCounts.previous).toEqual(0)
					expect(beforePieceInstancesCounts.current).not.toEqual(0)
					expect(beforePieceInstancesCounts.next).toEqual(0)
					expect(beforePieceInstancesCounts.other).toEqual(0)

					// Find the instance, and create its backing piece
					const targetPieceInstance = playoutModel.currentPartInstance!.pieceInstances[0]
					expect(targetPieceInstance).toBeTruthy()

					await expect(
						service.removePieceInstances('current', [
							unprotectString(targetPieceInstance.pieceInstance._id),
						])
					).resolves.toEqual([unprotectString(targetPieceInstance.pieceInstance._id)])

					// Ensure it was all removed
					expect(playoutModel.findPieceInstance(targetPieceInstance.pieceInstance._id)).toBeFalsy()
					expect(service.currentPartState).toEqual(ActionPartChange.SAFE_CHANGE)
				})
			})
		})

		describe('updatePartInstance', () => {
			test('bad parameters', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance).toBeTruthy()
				const partInstanceOther = (await jobContext.mockCollections.PartInstances.findOne({
					_id: { $ne: partInstance._id },
					rundownId,
				})) as DBPartInstance
				expect(partInstanceOther).toBeTruthy()

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					await expect(service.updatePartInstance('current', { title: 'new' })).rejects.toThrow(
						'PartInstance could not be found'
					)
				})

				// Set a current part instance
				await setPartInstances(jobContext, playlistId, partInstance, undefined)
				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)
					await expect(service.updatePartInstance('current', {})).rejects.toThrow(
						'Some valid properties must be defined'
					)
					await expect(
						service.updatePartInstance('current', { _id: 'bad', nope: 'ok' } as any)
					).rejects.toThrow('Some valid properties must be defined')

					await expect(service.updatePartInstance('next', { title: 'new' })).rejects.toThrow(
						'PartInstance could not be found'
					)
					await service.updatePartInstance('current', { title: 'new' })
				})
			})
			test('good', async () => {
				const { jobContext, playlistId, rundownId } = await setupMyDefaultRundown()

				// Setup the rundown and find an instance to modify
				const partInstance0 = (await jobContext.mockCollections.PartInstances.findOne({
					rundownId,
				})) as DBPartInstance
				expect(partInstance0).toBeTruthy()
				await setPartInstances(jobContext, playlistId, undefined, partInstance0)

				await wrapWithPlayoutModel(jobContext, playlistId, async (playoutModel) => {
					const { service } = await getTestee(jobContext, playoutModel)

					// Ensure there are no pending updates already
					expect((playoutModel.nextPartInstance! as PlayoutPartInstanceModelImpl).hasAnyChanges()).toBeFalsy()

					// Update it and expect it to match
					const partInstance0Before = clone(partInstance0)
					const partInstance0Delta = {
						_id: 'sdf', // This will be dropped
						title: 'abc',
						expectedDuration: 1234,
						classes: ['123'],
						badProperty: 9, // This will be dropped
					}
					const resultPart = await service.updatePartInstance('next', partInstance0Delta)
					const partInstance1 = playoutModel.nextPartInstance! as PlayoutPartInstanceModelImpl
					expect(partInstance1).toBeTruthy()

					expect(resultPart).toEqual(convertPartInstanceToBlueprints(partInstance1.partInstance))

					const pieceInstance0After = {
						...partInstance0Before,
						part: {
							...partInstance0Before.part,
							..._.omit(partInstance0Delta, 'badProperty', '_id'),
						},
					}
					expect(partInstance1.partInstance).toEqual(pieceInstance0After)
					expect(partInstance1.partInstanceHasChanges).toBeTruthy()
					expect(partInstance1.changedPieceInstanceIds()).toHaveLength(0)

					expect(service.nextPartState).toEqual(ActionPartChange.SAFE_CHANGE)
					expect(service.currentPartState).toEqual(ActionPartChange.NONE)
				})
			})
		})
	})
})
