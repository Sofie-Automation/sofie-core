import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { setupDefaultRundown, setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import { defaultRundownPlaylist } from '../../__mocks__/defaultCollectionObjects.js'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { resolveQueuedAdlibInsertTarget } from '../adlibUtils.js'
import { runJobWithPlayoutModel } from '../lock.js'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'

describe('adlibUtils', () => {
	async function setupActivatedPlaylist(rundownId: RundownId, playlistId: RundownPlaylistId) {
		const context = setupDefaultJobEnvironment()

		await context.mockCollections.RundownPlaylists.insertOne({
			...defaultRundownPlaylist(playlistId, context.studioId),
			activationId: getRandomId(),
		})

		const showStyleCompound = await setupMockShowStyleCompound(context)
		await setupDefaultRundown(context, showStyleCompound, playlistId, rundownId)

		return context
	}

	test('resolveQueuedAdlibInsertTarget inserts after current part by default', async () => {
		const playlistId: RundownPlaylistId = protectString('playlist0')
		const rundownId: RundownId = getRandomId()
		const context = await setupActivatedPlaylist(rundownId, playlistId)

		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
			const currentPart = playoutModel.getAllOrderedParts()[0]
			expect(currentPart).toBeTruthy()

			const currentPartInstance = playoutModel.createInstanceForPart(currentPart, [])
			currentPartInstance.setTaken(Date.now(), 0)
			playoutModel.cycleSelectedPartInstances()

			const insertTarget = resolveQueuedAdlibInsertTarget(playoutModel, currentPartInstance)

			expect(insertTarget.targetSegment.segment._id).toEqual(currentPart.segmentId)
			expect(insertTarget.newRank).toEqual(0.5)
		})
	})

	test('resolveQueuedAdlibInsertTarget inserts before explicit part id', async () => {
		const playlistId: RundownPlaylistId = protectString('playlist0')
		const rundownId: RundownId = getRandomId()
		const context = await setupActivatedPlaylist(rundownId, playlistId)

		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
			const currentPart = playoutModel.getAllOrderedParts()[0]
			expect(currentPart).toBeTruthy()

			const targetPart = await context.mockCollections.Parts.findOne({
				externalId: 'MOCK_PART_1_1',
				rundownId,
			})
			expect(targetPart).toBeTruthy()
			if (!targetPart) throw new Error('targetPart not found')

			const partBeforeTarget = playoutModel.getAllOrderedParts().find((p) => p.externalId === 'MOCK_PART_1_0')
			expect(partBeforeTarget).toBeTruthy()
			if (!partBeforeTarget) throw new Error('partBeforeTarget not found')

			const currentPartInstance = playoutModel.createInstanceForPart(currentPart, [])
			currentPartInstance.setTaken(Date.now(), 0)
			playoutModel.cycleSelectedPartInstances()

			const insertTarget = resolveQueuedAdlibInsertTarget(playoutModel, currentPartInstance, targetPart._id)

			expect(insertTarget.targetSegment.segment._id).toEqual(targetPart.segmentId)
			expect(insertTarget.newRank).toBeLessThan(targetPart._rank)
			expect(insertTarget.newRank).toBeGreaterThan(partBeforeTarget._rank)
		})
	})

	test('resolveQueuedAdlibInsertTarget inserts before explicit part instance id', async () => {
		const playlistId: RundownPlaylistId = protectString('playlist0')
		const rundownId: RundownId = getRandomId()
		const context = await setupActivatedPlaylist(rundownId, playlistId)

		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
			const currentPart = playoutModel.getAllOrderedParts()[0]
			expect(currentPart).toBeTruthy()

			const currentPartInstance = playoutModel.createInstanceForPart(currentPart, [])
			currentPartInstance.setTaken(Date.now(), 0)
			playoutModel.cycleSelectedPartInstances()

			const existingAdlibPart: DBPart = {
				_id: getRandomId(),
				segmentId: currentPart.segmentId,
				rundownId: currentPart.rundownId,
				_rank: 0.5,
				externalId: 'existing_adlib',
				title: 'Existing adlib',
				expectedDurationWithTransition: undefined,
			}
			const existingAdlibPartInstance = playoutModel.createInstanceForPart(existingAdlibPart, [])
			existingAdlibPartInstance.setOrphaned('adlib-part')

			const targetPart = await context.mockCollections.Parts.findOne({
				externalId: 'MOCK_PART_1_1',
				rundownId,
			})
			expect(targetPart).toBeTruthy()
			if (!targetPart) throw new Error('targetPart not found')

			const insertTarget = resolveQueuedAdlibInsertTarget(
				playoutModel,
				currentPartInstance,
				existingAdlibPartInstance.partInstance._id
			)

			expect(insertTarget.newRank).toBeLessThan(existingAdlibPartInstance.partInstance.part._rank)
			expect(insertTarget.newRank).toBeLessThan(targetPart._rank)
		})
	})

	test('resolveQueuedAdlibInsertTarget inserts before first part in segment', async () => {
		const playlistId: RundownPlaylistId = protectString('playlist0')
		const rundownId: RundownId = getRandomId()
		const context = await setupActivatedPlaylist(rundownId, playlistId)

		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
			const currentPart = playoutModel.getAllOrderedParts()[0]
			expect(currentPart).toBeTruthy()

			const firstPartInSegment1 = playoutModel.getAllOrderedParts().find((p) => p.externalId === 'MOCK_PART_1_0')
			expect(firstPartInSegment1).toBeTruthy()
			if (!firstPartInSegment1) throw new Error('firstPartInSegment1 not found')

			const currentPartInstance = playoutModel.createInstanceForPart(currentPart, [])
			currentPartInstance.setTaken(Date.now(), 0)
			playoutModel.cycleSelectedPartInstances()

			const insertTarget = resolveQueuedAdlibInsertTarget(
				playoutModel,
				currentPartInstance,
				firstPartInSegment1._id
			)

			expect(insertTarget.targetSegment.segment._id).toEqual(firstPartInSegment1.segmentId)
			expect(insertTarget.newRank).toBeLessThan(firstPartInSegment1._rank)
		})
	})

	test('resolveQueuedAdlibInsertTarget throws when insert before target is in orphaned segment', async () => {
		const playlistId: RundownPlaylistId = protectString('playlist0')
		const rundownId: RundownId = getRandomId()
		const context = await setupActivatedPlaylist(rundownId, playlistId)

		const targetPart = await context.mockCollections.Parts.findOne({
			externalId: 'MOCK_PART_1_1',
			rundownId,
		})
		expect(targetPart).toBeTruthy()
		if (!targetPart) throw new Error('targetPart not found')

		await context.mockCollections.Segments.update(targetPart.segmentId, {
			$set: { orphaned: SegmentOrphanedReason.DELETED },
		})

		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
			const currentPart = playoutModel.getAllOrderedParts()[0]
			expect(currentPart).toBeTruthy()

			const currentPartInstance = playoutModel.createInstanceForPart(currentPart, [])
			currentPartInstance.setTaken(Date.now(), 0)
			playoutModel.cycleSelectedPartInstances()

			expect(() => resolveQueuedAdlibInsertTarget(playoutModel, currentPartInstance, targetPart._id)).toThrow(
				'Cannot queue part: insert before target is in orphaned segment'
			)
		})
	})
})
