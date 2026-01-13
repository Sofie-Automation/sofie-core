import { IBlueprintSegmentDB } from '@sofie-automation/blueprints-integration'
import { PartEventContext, RundownDataChangedEventContext, RundownTimingEventContext } from '../context/index.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { wrapPartToTemporaryInstance } from '../../__mocks__/partinstance.js'
import { ReadonlyDeep } from 'type-fest'
import { convertPartInstanceToBlueprints } from '../context/lib.js'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { ProcessedShowStyleCompound } from '../../jobs/index.js'

describe('Test blueprint api context', () => {
	async function generateSparsePieceInstances(rundown: DBRundown) {
		const playlistActivationId = protectString('active')

		const parts = await jobContext.mockCollections.Parts.findFetch({ rundownId: rundown._id })
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]

			// make into a partInstance
			await jobContext.mockCollections.PartInstances.insertOne({
				_id: protectString(`${part._id}_instance`),
				playlistActivationId: playlistActivationId,
				segmentPlayoutId: protectString(part.segmentId + '_1'),
				rundownId: part.rundownId,
				segmentId: part.segmentId,
				takeCount: i,
				rehearsal: false,
				part,
			})

			const count = ((i + 2) % 4) + 1 // Some consistent randomness
			for (let o = 0; o < count; o++) {
				await jobContext.mockCollections.PieceInstances.insertOne({
					_id: protectString(`${part._id}_piece${o}`),
					rundownId: rundown._id,
					playlistActivationId: playlistActivationId,
					partInstanceId: protectString(`${part._id}_instance`),
					piece: {
						_id: protectString(`${part._id}_piece_inner${o}`),
						rundownId: rundown._id,
						partId: part._id,
						content: {
							index: o,
						},
						timelineObjectsString: EmptyPieceTimelineObjectsBlob,
					},
				} as any)
			}
		}
	}

	let jobContext: MockJobContext
	let showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
	beforeEach(async () => {
		jobContext = setupDefaultJobEnvironment()

		showStyle = await setupMockShowStyleCompound(jobContext)
	})

	describe('PartEventContext', () => {
		test('get part', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext, showStyle)

			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			const playlist = (await jobContext.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()

			const showStyleConfig = jobContext.getShowStyleBlueprintConfig(showStyle)

			const mockPart = {
				_id: protectString('not-a-real-part'),
			}

			const tmpPart = wrapPartToTemporaryInstance(protectString('active'), mockPart as DBPart)
			const context = new PartEventContext(
				'fake',
				jobContext.studio,
				jobContext.getStudioBlueprintConfig(),
				showStyle,
				showStyleConfig,
				rundown,
				tmpPart
			)
			expect(context.studio).toBeTruthy()

			expect(context.part).toEqual(convertPartInstanceToBlueprints(tmpPart))
		})
	})

	describe('RundownDataChangedEventContext', () => {
		async function getContext(rundown: DBRundown) {
			const playlist = (await jobContext.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()

			return new RundownDataChangedEventContext(
				jobContext,
				{
					name: 'as-run',
					identifier: unprotectString(rundown._id),
				},
				showStyle,
				rundown
			)
		}

		test('formatDateAsTimecode', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			const context = await getContext(rundown)

			const d = new Date('2019-01-01 18:33:34:896')
			expect(context.formatDateAsTimecode(d.getTime())).toEqual('18:33:34:22')
		})

		test('formatDurationAsTimecode', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			const context = await getContext(rundown)

			expect(context.formatDurationAsTimecode(0)).toEqual('00:00:00:00')
			expect(context.formatDurationAsTimecode(10000)).toEqual('00:00:10:00')
			expect(context.formatDurationAsTimecode(12345678)).toEqual('03:25:45:16')
		})
	})

	describe('RundownTimingEventContext', () => {
		async function getContext(
			rundown: DBRundown,
			previousPartInstance: DBPartInstance | undefined,
			partInstance: DBPartInstance,
			nextPartInstance: DBPartInstance | undefined
		) {
			const playlist = (await jobContext.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()

			return new RundownTimingEventContext(
				jobContext,
				{
					name: 'as-run',
					identifier: unprotectString(rundown._id),
				},
				showStyle,
				rundown,
				previousPartInstance,
				partInstance,
				nextPartInstance
			)
		}

		test('getFirstPartInstanceInRundown', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			const context = await getContext(rundown, undefined, partInstance, undefined)
			await expect(context.getFirstPartInstanceInRundown()).resolves.toMatchObject({
				_id: partInstance._id,
			})

			// look for a different playlistActivationId
			partInstance.playlistActivationId = protectString('something-else')

			const context2 = await getContext(rundown, undefined, partInstance, undefined)
			await expect(context2.getFirstPartInstanceInRundown()).rejects.toThrow('No PartInstances found for Rundown')
		})

		test('getFirstPartInstanceInRundown - allowUntimed', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			await jobContext.mockCollections.PartInstances.update(partInstance._id, {
				$set: {
					'part.untimed': true,
				},
			})

			const secondPartInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
				_id: { $ne: partInstance._id },
			})) as DBPartInstance
			expect(secondPartInstance).toBeTruthy()
			expect(secondPartInstance.playlistActivationId).toBe(partInstance.playlistActivationId)

			const context = await getContext(rundown, undefined, partInstance, undefined)
			// Get the 'timed' partInstance
			await expect(context.getFirstPartInstanceInRundown()).resolves.toMatchObject({
				_id: secondPartInstance._id,
			})

			// Get the 'untimed' partInstance
			await expect(context.getFirstPartInstanceInRundown(true)).resolves.toMatchObject({
				_id: partInstance._id,
			})
		})

		test('getPartInstancesInSegmentPlayoutId', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			// Check what was generated
			const context = await getContext(rundown, undefined, partInstance, undefined)
			await expect(
				context.getPartInstancesInSegmentPlayoutId(convertPartInstanceToBlueprints(partInstance))
			).resolves.toHaveLength(2)

			// Insert a new instance, and try again
			await jobContext.mockCollections.PartInstances.insertOne({
				...partInstance,
				_id: getRandomId(),
				segmentPlayoutId: protectString('new segment'),
			})

			await expect(
				context.getPartInstancesInSegmentPlayoutId(convertPartInstanceToBlueprints(partInstance))
			).resolves.toHaveLength(2)
		})

		test('getPieceInstances', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			const pieceInstance = (await jobContext.mockCollections.PieceInstances.findOne({
				rundownId,
			})) as PieceInstance
			expect(pieceInstance).toBeTruthy()
			expect(pieceInstance.partInstanceId).toBe(partInstance._id)

			// Check what was generated
			const context = await getContext(rundown, undefined, partInstance, undefined)
			await expect(
				context.getPieceInstances(unprotectString(pieceInstance.partInstanceId))
			).resolves.toHaveLength(3)

			// mark one of the piece as different activation
			await jobContext.mockCollections.PieceInstances.update(pieceInstance._id, {
				$set: { playlistActivationId: protectString('another activation') },
			})

			// should now be less
			await expect(
				context.getPieceInstances(unprotectString(pieceInstance.partInstanceId))
			).resolves.toHaveLength(2)
		})

		test('getSegment - no id', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			const context = await getContext(rundown, undefined, partInstance, undefined)

			await expect(
				// @ts-expect-error
				context.getSegment()
			).resolves.toBeUndefined()
		})
		test('getSegment - unknown id', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			const context = await getContext(rundown, undefined, partInstance, undefined)

			await expect(context.getSegment('not-a-real-segment')).resolves.toBeUndefined()
		})
		test('getSegment - good', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			const context = await getContext(rundown, undefined, partInstance, undefined)

			const segment = (await context.getSegment(`${rundown._id}_segment1`)) as IBlueprintSegmentDB
			expect(segment).toBeTruthy()
			expect(segment._id).toEqual(`${rundown._id}_segment1`)
		})
		test('getSegment - good with event segmentId', async () => {
			const { rundownId } = await setupDefaultRundownPlaylist(jobContext)
			const rundown = (await jobContext.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
			expect(rundown).toBeTruthy()

			await generateSparsePieceInstances(rundown)

			const partInstance = (await jobContext.mockCollections.PartInstances.findOne({
				rundownId,
			})) as DBPartInstance
			expect(partInstance).toBeTruthy()

			const context = await getContext(rundown, undefined, partInstance, undefined)

			const segment = (await context.getSegment(`${rundown._id}_segment2`)) as IBlueprintSegmentDB
			expect(segment).toBeTruthy()
			expect(segment._id).toEqual(`${rundown._id}_segment2`)
		})
	})
})
