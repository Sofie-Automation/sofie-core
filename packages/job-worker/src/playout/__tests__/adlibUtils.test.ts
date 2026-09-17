import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { setupDefaultRundown, setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import { defaultRundownPlaylist } from '../../__mocks__/defaultCollectionObjects.js'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { insertQueuedPartWithPieces, resolveQueuedAdlibInsertTarget } from '../adlibUtils.js'
import { runJobWithPlayoutModel } from '../lock.js'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { handleActivateRundownPlaylist } from '../activePlaylistJobs.js'
import { handleTakeNextPart } from '../take.js'
import { QueuePartTarget } from '@sofie-automation/blueprints-integration'

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

			const insertTarget = resolveQueuedAdlibInsertTarget(playoutModel, currentPartInstance, {
				targetPartId: unprotectString(targetPart._id),
			})

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

			const insertTarget = resolveQueuedAdlibInsertTarget(playoutModel, currentPartInstance, {
				targetPartInstanceId: unprotectString(existingAdlibPartInstance.partInstance._id),
			})

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

			const insertTarget = resolveQueuedAdlibInsertTarget(playoutModel, currentPartInstance, {
				targetPartId: unprotectString(firstPartInSegment1._id),
			})

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

			expect(() =>
				resolveQueuedAdlibInsertTarget(playoutModel, currentPartInstance, {
					targetPartId: unprotectString(targetPart._id),
				})
			).toThrow('Cannot queue part: target is in orphaned segment')
		})
	})

	test('resolveQueuedAdlibInsertTarget inserts after explicit part id', async () => {
		const playlistId: RundownPlaylistId = protectString('playlist0')
		const rundownId: RundownId = getRandomId()
		const context = await setupActivatedPlaylist(rundownId, playlistId)

		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
			const currentPart = playoutModel.getAllOrderedParts()[0]
			expect(currentPart).toBeTruthy()

			const targetPart = await context.mockCollections.Parts.findOne({
				externalId: 'MOCK_PART_1_0',
				rundownId,
			})
			expect(targetPart).toBeTruthy()
			if (!targetPart) throw new Error('targetPart not found')

			const partAfterTarget = await context.mockCollections.Parts.findOne({
				externalId: 'MOCK_PART_1_1',
				rundownId,
			})
			expect(partAfterTarget).toBeTruthy()
			if (!partAfterTarget) throw new Error('partAfterTarget not found')

			const currentPartInstance = playoutModel.createInstanceForPart(currentPart, [])
			currentPartInstance.setTaken(Date.now(), 0)
			playoutModel.cycleSelectedPartInstances()

			const insertTarget = resolveQueuedAdlibInsertTarget(playoutModel, currentPartInstance, {
				targetPartId: unprotectString(targetPart._id),
				after: true,
			})

			expect(insertTarget.newRank).toBeGreaterThan(targetPart._rank)
			expect(insertTarget.newRank).toBeLessThan(partAfterTarget._rank)
		})
	})

	test('resolveQueuedAdlibInsertTarget inserts after explicit part instance id', async () => {
		const playlistId: RundownPlaylistId = protectString('playlist0')
		const rundownId: RundownId = getRandomId()
		const context = await setupActivatedPlaylist(rundownId, playlistId)

		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
			const currentPart = playoutModel.getAllOrderedParts()[0]
			expect(currentPart).toBeTruthy()

			const targetPart = await context.mockCollections.Parts.findOne({
				externalId: 'MOCK_PART_1_0',
				rundownId,
			})
			expect(targetPart).toBeTruthy()
			if (!targetPart) throw new Error('targetPart not found')

			const currentPartInstance = playoutModel.createInstanceForPart(currentPart, [])
			currentPartInstance.setTaken(Date.now(), 0)
			playoutModel.cycleSelectedPartInstances()

			const existingAdlibPart: DBPart = {
				_id: getRandomId(),
				segmentId: targetPart.segmentId,
				rundownId: targetPart.rundownId,
				_rank: 0.5,
				externalId: 'existing_adlib',
				title: 'Existing adlib',
				expectedDurationWithTransition: undefined,
			}
			const existingAdlibPartInstance = playoutModel.createInstanceForPart(existingAdlibPart, [])
			existingAdlibPartInstance.setOrphaned('adlib-part')

			const partAfterTarget = await context.mockCollections.Parts.findOne({
				externalId: 'MOCK_PART_1_1',
				rundownId,
			})
			expect(partAfterTarget).toBeTruthy()
			if (!partAfterTarget) throw new Error('partAfterTarget not found')

			const insertTarget = resolveQueuedAdlibInsertTarget(playoutModel, currentPartInstance, {
				targetPartInstanceId: unprotectString(existingAdlibPartInstance.partInstance._id),
				after: true,
			})

			expect(insertTarget.newRank).toBeGreaterThan(existingAdlibPartInstance.partInstance.part._rank)
			expect(insertTarget.newRank).toBeLessThan(partAfterTarget._rank)
		})
	})

	test('resolveQueuedAdlibInsertTarget inserts after last part in segment', async () => {
		const playlistId: RundownPlaylistId = protectString('playlist0')
		const rundownId: RundownId = getRandomId()
		const context = await setupActivatedPlaylist(rundownId, playlistId)

		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
			const currentPart = playoutModel.getAllOrderedParts()[0]
			expect(currentPart).toBeTruthy()

			const lastPartInSegment1 = playoutModel.getAllOrderedParts().find((p) => p.externalId === 'MOCK_PART_1_2')
			expect(lastPartInSegment1).toBeTruthy()
			if (!lastPartInSegment1) throw new Error('lastPartInSegment1 not found')

			const currentPartInstance = playoutModel.createInstanceForPart(currentPart, [])
			currentPartInstance.setTaken(Date.now(), 0)
			playoutModel.cycleSelectedPartInstances()

			const insertTarget = resolveQueuedAdlibInsertTarget(playoutModel, currentPartInstance, {
				targetPartId: unprotectString(lastPartInSegment1._id),
				after: true,
			})

			expect(insertTarget.newRank).toBeGreaterThan(lastPartInSegment1._rank)
		})
	})

	test('resolveQueuedAdlibInsertTarget throws when insert after target is in orphaned segment', async () => {
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

			expect(() =>
				resolveQueuedAdlibInsertTarget(playoutModel, currentPartInstance, {
					targetPartId: unprotectString(targetPart._id),
					after: true,
				})
			).toThrow('Cannot queue part: target is in orphaned segment')
		})
	})

	describe('insertQueuedPartWithPieces quick loop', () => {
		async function setupPlayingPlaylist() {
			const context = setupDefaultJobEnvironment()
			const playlistId: RundownPlaylistId = protectString('playlist0')
			const rundownId: RundownId = getRandomId()

			await context.mockCollections.RundownPlaylists.insertOne({
				...defaultRundownPlaylist(playlistId, context.studioId),
			})

			const showStyleCompound = await setupMockShowStyleCompound(context)
			await setupDefaultRundown(context, showStyleCompound, playlistId, rundownId)

			await handleActivateRundownPlaylist(context, { playlistId, rehearsal: true })
			await handleTakeNextPart(context, { playlistId, fromPartInstanceId: null })

			return { context, playlistId, rundownId }
		}

		function queuedPart(target?: QueuePartTarget) {
			return {
				part: {
					_id: getRandomId(),
					externalId: 'queued_adlib',
					title: 'Queued adlib',
					expectedDurationWithTransition: undefined,
				},
				pieces: [],
				target,
			}
		}

		test('extends quick loop when inserted immediately after current', async () => {
			const { context, playlistId } = await setupPlayingPlaylist()

			await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
				const currentPartInstance = playoutModel.currentPartInstance
				expect(currentPartInstance).toBeTruthy()
				if (!currentPartInstance) throw new Error('currentPartInstance not found')

				playoutModel.setQuickLoopMarker('start', {
					type: QuickLoopMarkerType.PART,
					id: currentPartInstance.partInstance.part._id,
				})
				playoutModel.setQuickLoopMarker('end', {
					type: QuickLoopMarkerType.PART,
					id: currentPartInstance.partInstance.part._id,
				})

				const setQuickLoopMarker = jest.spyOn(playoutModel, 'setQuickLoopMarker')

				const newPartInstance = await insertQueuedPartWithPieces(
					context,
					playoutModel,
					currentPartInstance,
					queuedPart(),
					undefined
				)

				expect(newPartInstance.partInstance.segmentId).toEqual(currentPartInstance.partInstance.segmentId)
				expect(newPartInstance.partInstance.part._rank).toBeGreaterThan(
					currentPartInstance.partInstance.part._rank
				)
				expect(playoutModel.playlist.nextPartInfo?.partInstanceId).toEqual(newPartInstance.partInstance._id)
				expect(setQuickLoopMarker).toHaveBeenCalledWith(
					'end',
					expect.objectContaining({
						type: QuickLoopMarkerType.PART,
						id: newPartInstance.partInstance.part._id,
						overridenId: currentPartInstance.partInstance.part._id,
					})
				)
			})
		})

		test('extends quick loop when explicit target is the next part in the same segment', async () => {
			const { context, playlistId } = await setupPlayingPlaylist()

			await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
				const currentPartInstance = playoutModel.currentPartInstance
				expect(currentPartInstance).toBeTruthy()
				if (!currentPartInstance) throw new Error('currentPartInstance not found')

				const nextPartInSegment = playoutModel
					.getAllOrderedParts()
					.find(
						(part) =>
							part.segmentId === currentPartInstance.partInstance.segmentId &&
							part._rank > currentPartInstance.partInstance.part._rank
					)
				expect(nextPartInSegment).toBeTruthy()
				if (!nextPartInSegment) throw new Error('nextPartInSegment not found')

				playoutModel.setQuickLoopMarker('start', {
					type: QuickLoopMarkerType.PART,
					id: currentPartInstance.partInstance.part._id,
				})
				playoutModel.setQuickLoopMarker('end', {
					type: QuickLoopMarkerType.PART,
					id: currentPartInstance.partInstance.part._id,
				})

				const setQuickLoopMarker = jest.spyOn(playoutModel, 'setQuickLoopMarker')

				const newPartInstance = await insertQueuedPartWithPieces(
					context,
					playoutModel,
					currentPartInstance,
					queuedPart({ targetPartId: unprotectString(nextPartInSegment._id) }),
					undefined
				)

				expect(newPartInstance.partInstance.segmentId).toEqual(currentPartInstance.partInstance.segmentId)
				expect(playoutModel.playlist.nextPartInfo?.partInstanceId).toEqual(newPartInstance.partInstance._id)
				expect(setQuickLoopMarker).toHaveBeenCalledWith(
					'end',
					expect.objectContaining({
						type: QuickLoopMarkerType.PART,
						id: newPartInstance.partInstance.part._id,
					})
				)
			})
		})

		test('skips extending quick loop for explicit target in another segment', async () => {
			const { context, playlistId, rundownId } = await setupPlayingPlaylist()

			const targetPart = await context.mockCollections.Parts.findOne({
				externalId: 'MOCK_PART_1_1',
				rundownId,
			})
			expect(targetPart).toBeTruthy()
			if (!targetPart) throw new Error('targetPart not found')

			await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
				const currentPartInstance = playoutModel.currentPartInstance
				expect(currentPartInstance).toBeTruthy()
				if (!currentPartInstance) throw new Error('currentPartInstance not found')

				playoutModel.setQuickLoopMarker('start', {
					type: QuickLoopMarkerType.PART,
					id: currentPartInstance.partInstance.part._id,
				})
				playoutModel.setQuickLoopMarker('end', {
					type: QuickLoopMarkerType.PART,
					id: currentPartInstance.partInstance.part._id,
				})

				const setQuickLoopMarker = jest.spyOn(playoutModel, 'setQuickLoopMarker')

				const newPartInstance = await insertQueuedPartWithPieces(
					context,
					playoutModel,
					currentPartInstance,
					queuedPart({ targetPartId: unprotectString(targetPart._id) }),
					undefined
				)

				expect(newPartInstance.partInstance.segmentId).toEqual(targetPart.segmentId)
				expect(newPartInstance.partInstance.part._rank).toBeLessThan(targetPart._rank)
				expect(playoutModel.playlist.nextPartInfo?.partInstanceId).toEqual(newPartInstance.partInstance._id)
				expect(setQuickLoopMarker).not.toHaveBeenCalled()
			})
		})

		test('skips extending quick loop for explicit target before current', async () => {
			const { context, playlistId } = await setupPlayingPlaylist()

			await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) => {
				const currentPartInstance = playoutModel.currentPartInstance
				expect(currentPartInstance).toBeTruthy()
				if (!currentPartInstance) throw new Error('currentPartInstance not found')

				playoutModel.setQuickLoopMarker('start', {
					type: QuickLoopMarkerType.PART,
					id: currentPartInstance.partInstance.part._id,
				})
				playoutModel.setQuickLoopMarker('end', {
					type: QuickLoopMarkerType.PART,
					id: currentPartInstance.partInstance.part._id,
				})

				const setQuickLoopMarker = jest.spyOn(playoutModel, 'setQuickLoopMarker')

				const newPartInstance = await insertQueuedPartWithPieces(
					context,
					playoutModel,
					currentPartInstance,
					queuedPart({ targetPartId: unprotectString(currentPartInstance.partInstance.part._id) }),
					undefined
				)

				expect(newPartInstance.partInstance.segmentId).toEqual(currentPartInstance.partInstance.segmentId)
				expect(newPartInstance.partInstance.part._rank).toBeLessThan(
					currentPartInstance.partInstance.part._rank
				)
				expect(playoutModel.playlist.nextPartInfo?.partInstanceId).toEqual(newPartInstance.partInstance._id)
				expect(setQuickLoopMarker).not.toHaveBeenCalled()
			})
		})
	})
})
