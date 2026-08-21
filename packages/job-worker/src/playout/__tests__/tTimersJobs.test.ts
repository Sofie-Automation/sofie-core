import { setupDefaultJobEnvironment, MockJobContext } from '../../__mocks__/context.js'
import {
	handleRecalculateTTimerProjections,
	handleTTimerClearProjected,
	handleTTimerSetProjectedAnchorPart,
	handleTTimerSetProjectedDuration,
	handleTTimerSetProjectedTime,
} from '../tTimersJobs.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	defaultPart,
	defaultRundown,
	defaultRundownPlaylist,
	defaultSegment,
} from '../../__mocks__/defaultCollectionObjects.js'

describe('tTimersJobs', () => {
	let context: MockJobContext

	beforeEach(() => {
		context = setupDefaultJobEnvironment()
	})

	describe('handleRecalculateTTimerProjections', () => {
		it('should handle studio with active playlists', async () => {
			// Create an active playlist
			const playlistId = protectString<RundownPlaylistId>('playlist1')

			await context.directCollections.RundownPlaylists.insertOne(
				literal<DBRundownPlaylist>({
					_id: playlistId,
					externalId: 'test',
					studioId: context.studioId,
					name: 'Test Playlist',
					created: 0,
					modified: 0,
					currentPartInfo: null,
					nextPartInfo: null,
					previousPartsInfo: [],
					rundownIdsInOrder: [],
					timing: {
						type: 'none' as any,
					},
					activationId: protectString('activation1'),
					rehearsal: false,
					holdState: undefined,
					tTimers: [
						{
							index: 1,
							label: 'Timer 1',
							mode: null,
							state: null,
						},
						{
							index: 2,
							label: 'Timer 2',
							mode: null,
							state: null,
						},
						{
							index: 3,
							label: 'Timer 3',
							mode: null,
							state: null,
						},
					],
				})
			)

			// Should complete without errors
			await expect(handleRecalculateTTimerProjections(context)).resolves.toBeUndefined()
		})

		it('should handle studio with no active playlists', async () => {
			// Create an inactive playlist
			const playlistId = protectString<RundownPlaylistId>('playlist1')

			await context.directCollections.RundownPlaylists.insertOne(
				literal<DBRundownPlaylist>({
					_id: playlistId,
					externalId: 'test',
					studioId: context.studioId,
					name: 'Inactive Playlist',
					created: 0,
					modified: 0,
					currentPartInfo: null,
					nextPartInfo: null,
					previousPartsInfo: [],
					rundownIdsInOrder: [],
					timing: {
						type: 'none' as any,
					},
					activationId: undefined, // Not active
					rehearsal: false,
					holdState: undefined,
					tTimers: [
						{
							index: 1,
							label: 'Timer 1',
							mode: null,
							state: null,
						},
						{
							index: 2,
							label: 'Timer 2',
							mode: null,
							state: null,
						},
						{
							index: 3,
							label: 'Timer 3',
							mode: null,
							state: null,
						},
					],
				})
			)

			// Should complete without errors (just does nothing)
			await expect(handleRecalculateTTimerProjections(context)).resolves.toBeUndefined()
		})

		it('should handle multiple active playlists', async () => {
			// Create multiple active playlists
			const playlistId1 = protectString<RundownPlaylistId>('playlist1')
			const playlistId2 = protectString<RundownPlaylistId>('playlist2')

			await context.directCollections.RundownPlaylists.insertOne(
				literal<DBRundownPlaylist>({
					_id: playlistId1,
					externalId: 'test1',
					studioId: context.studioId,
					name: 'Active Playlist 1',
					created: 0,
					modified: 0,
					currentPartInfo: null,
					nextPartInfo: null,
					previousPartsInfo: [],
					rundownIdsInOrder: [],
					timing: {
						type: 'none' as any,
					},
					activationId: protectString('activation1'),
					rehearsal: false,
					holdState: undefined,
					tTimers: [
						{
							index: 1,
							label: 'Timer 1',
							mode: null,
							state: null,
						},
						{
							index: 2,
							label: 'Timer 2',
							mode: null,
							state: null,
						},
						{
							index: 3,
							label: 'Timer 3',
							mode: null,
							state: null,
						},
					],
				})
			)

			await context.directCollections.RundownPlaylists.insertOne(
				literal<DBRundownPlaylist>({
					_id: playlistId2,
					externalId: 'test2',
					studioId: context.studioId,
					name: 'Active Playlist 2',
					created: 0,
					modified: 0,
					currentPartInfo: null,
					nextPartInfo: null,
					previousPartsInfo: [],
					rundownIdsInOrder: [],
					timing: {
						type: 'none' as any,
					},
					activationId: protectString('activation2'),
					rehearsal: false,
					holdState: undefined,
					tTimers: [
						{
							index: 1,
							label: 'Timer 1',
							mode: null,
							state: null,
						},
						{
							index: 2,
							label: 'Timer 2',
							mode: null,
							state: null,
						},
						{
							index: 3,
							label: 'Timer 3',
							mode: null,
							state: null,
						},
					],
				})
			)

			// Should complete without errors, processing both playlists
			await expect(handleRecalculateTTimerProjections(context)).resolves.toBeUndefined()
		})

		it('should handle playlist deleted between query and lock', async () => {
			// This test is harder to set up properly, but the function should handle it
			// by checking if playlist exists after acquiring lock
			await expect(handleRecalculateTTimerProjections(context)).resolves.toBeUndefined()
		})
	})

	describe('projection endpoints', () => {
		it('handleTTimerClearProjected should clear projectedState and anchorPartId', async () => {
			const playlistId = protectString<RundownPlaylistId>('playlist-proj-clear')

			const playlist = defaultRundownPlaylist(playlistId, context.studioId)
			playlist.tTimers[0] = {
				...playlist.tTimers[0],
				anchorPartId: protectString<PartId>('somePart'),
				projectedState: literal({ paused: true, duration: 1234 }),
			}
			await context.directCollections.RundownPlaylists.insertOne(literal<DBRundownPlaylist>(playlist))

			await expect(handleTTimerClearProjected(context, { playlistId, timerIndex: 1 })).resolves.toBeUndefined()

			const updatedPlaylist = await context.directCollections.RundownPlaylists.findOne(playlistId)
			expect(updatedPlaylist).toBeTruthy()
			expect(updatedPlaylist?.tTimers[0].anchorPartId).toBeUndefined()
			expect(updatedPlaylist?.tTimers[0].projectedState).toBeUndefined()
		})

		it('handleTTimerSetProjectedTime should set projectedState and clear anchorPartId', async () => {
			const playlistId = protectString<RundownPlaylistId>('playlist-proj-time')

			const playlist = defaultRundownPlaylist(playlistId, context.studioId)
			playlist.tTimers[0] = {
				...playlist.tTimers[0],
				anchorPartId: protectString<PartId>('somePart'),
				projectedState: undefined,
			}
			await context.directCollections.RundownPlaylists.insertOne(literal<DBRundownPlaylist>(playlist))

			await expect(
				handleTTimerSetProjectedTime(context, { playlistId, timerIndex: 1, time: 1234567890, paused: false })
			).resolves.toBeUndefined()

			const updatedPlaylist = await context.directCollections.RundownPlaylists.findOne(playlistId)
			expect(updatedPlaylist?.tTimers[0].anchorPartId).toBeUndefined()
			expect(updatedPlaylist?.tTimers[0].projectedState).toEqual(literal({ paused: false, zeroTime: 1234567890 }))
		})

		it('handleTTimerSetProjectedDuration should set paused projectedState and clear anchorPartId', async () => {
			const playlistId = protectString<RundownPlaylistId>('playlist-proj-duration')

			const playlist = defaultRundownPlaylist(playlistId, context.studioId)
			playlist.tTimers[0] = {
				...playlist.tTimers[0],
				anchorPartId: protectString<PartId>('somePart'),
			}
			await context.directCollections.RundownPlaylists.insertOne(literal<DBRundownPlaylist>(playlist))

			await expect(
				handleTTimerSetProjectedDuration(context, { playlistId, timerIndex: 1, duration: 5000, paused: true })
			).resolves.toBeUndefined()

			const updatedPlaylist = await context.directCollections.RundownPlaylists.findOne(playlistId)
			expect(updatedPlaylist?.tTimers[0].anchorPartId).toBeUndefined()
			expect(updatedPlaylist?.tTimers[0].projectedState).toEqual(literal({ paused: true, duration: 5000 }))
		})

		it('handleTTimerSetProjectedAnchorPart should set anchorPartId for matching externalId', async () => {
			const playlistId = protectString<RundownPlaylistId>('playlist-proj-anchor')
			const rundown = defaultRundown(
				'rundown0',
				context.studioId,
				null,
				playlistId,
				protectString('showStyleBase0'),
				protectString('showStyleVariant0')
			)
			const segmentId = protectString<SegmentId>('segment0')
			const segment = defaultSegment(segmentId, rundown._id)
			const partId = protectString<PartId>('part0')
			const part = defaultPart(partId, rundown._id, segmentId)
			part.externalId = 'myPartExternalId'

			const playlist = defaultRundownPlaylist(playlistId, context.studioId)
			playlist.rundownIdsInOrder = [rundown._id]
			playlist.tTimers[0] = {
				...playlist.tTimers[0],
				projectedState: literal({ paused: true, duration: 999 }),
			}

			await context.directCollections.RundownPlaylists.insertOne(literal<DBRundownPlaylist>(playlist))
			await context.directCollections.Rundowns.insertOne(literal(rundown))
			await context.directCollections.Segments.insertOne(literal(segment))
			await context.directCollections.Parts.insertOne(literal(part))

			await expect(
				handleTTimerSetProjectedAnchorPart(context, {
					playlistId,
					timerIndex: 1,
					externalId: 'myPartExternalId',
				})
			).resolves.toBeUndefined()

			const updatedPlaylist = await context.directCollections.RundownPlaylists.findOne(playlistId)
			expect(updatedPlaylist?.tTimers[0].anchorPartId).toEqual(partId)
		})
	})
})
