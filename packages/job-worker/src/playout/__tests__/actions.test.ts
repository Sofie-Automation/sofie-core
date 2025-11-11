import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import { runWithRundownLock } from '../../ingest/lock.js'
import { executePeripheralDeviceFunction } from '../../peripheralDevice.js'
import { removeRundownFromDb } from '../../rundownPlaylists.js'
import { activateRundownPlaylist } from '../activePlaylistActions.js'
import { runJobWithPlayoutModel } from '../lock.js'
import { handleActivateAdlibTesting } from '../adlibTesting.js'

jest.mock('../../peripheralDevice')
type TexecutePeripheralDeviceFunction = jest.MockedFunction<typeof executePeripheralDeviceFunction>
const executePeripheralDeviceFunctionMock = executePeripheralDeviceFunction as TexecutePeripheralDeviceFunction

describe('Playout Actions', () => {
	let context: MockJobContext

	beforeEach(async () => {
		context = setupDefaultJobEnvironment()

		await setupMockShowStyleCompound(context)

		const rundowns = await context.directCollections.Rundowns.findFetch()
		for (const rundown of rundowns) {
			await runWithRundownLock(context, rundown._id, async (_rd, lock) => {
				await removeRundownFromDb(context, lock)
			})
		}

		executePeripheralDeviceFunctionMock.mockClear()
		executePeripheralDeviceFunctionMock.mockImplementation(async () => Promise.resolve())
	})
	test('activateRundown', async () => {
		const { playlistId: playlistId0 } = await setupDefaultRundownPlaylist(context, undefined, protectString('ro0'))
		expect(playlistId0).toBeTruthy()

		const getPlaylist0 = async () =>
			(await context.directCollections.RundownPlaylists.findOne(playlistId0)) as DBRundownPlaylist

		const { playlistId: playlistId1 } = await setupDefaultRundownPlaylist(context, undefined, protectString('ro1'))
		expect(playlistId1).toBeTruthy()

		// const getPlaylist1 = () => RundownPlaylists.findOne(playlistId1) as RundownPlaylist

		const { playlistId: playlistId2 } = await setupDefaultRundownPlaylist(context, undefined, protectString('ro2'))
		expect(playlistId2).toBeTruthy()

		expect(executePeripheralDeviceFunctionMock).toHaveBeenCalledTimes(0)

		// Activating a rundown, to rehearsal
		await runJobWithPlayoutModel(context, { playlistId: playlistId0 }, null, async (playoutModel) =>
			activateRundownPlaylist(context, playoutModel, true)
		)
		await expect(getPlaylist0()).resolves.toMatchObject({
			activationId: expect.stringMatching(/^randomId/),
			rehearsal: true,
		})

		// Activating a rundown
		await runJobWithPlayoutModel(context, { playlistId: playlistId0 }, null, async (playoutModel) =>
			activateRundownPlaylist(context, playoutModel, false)
		)
		await expect(getPlaylist0()).resolves.toMatchObject({
			activationId: expect.stringMatching(/^randomId/),
			rehearsal: false,
		})

		// Activating a rundown, back to rehearsal
		await runJobWithPlayoutModel(context, { playlistId: playlistId0 }, null, async (playoutModel) =>
			activateRundownPlaylist(context, playoutModel, true)
		)
		await expect(getPlaylist0()).resolves.toMatchObject({
			activationId: expect.stringMatching(/^randomId/),
			rehearsal: true,
		})

		expect(executePeripheralDeviceFunctionMock).toHaveBeenCalledTimes(0)

		// Activating another rundown
		await expect(
			runJobWithPlayoutModel(context, { playlistId: playlistId1 }, null, async (playoutModel) =>
				activateRundownPlaylist(context, playoutModel, false)
			)
		).rejects.toMatchToString(/only one rundown can be active/i)

		expect(executePeripheralDeviceFunctionMock).toHaveBeenCalledTimes(0)
	})
	test('AdlibTesting', async () => {
		const { playlistId: playlistId0, rundownId: rundownId0 } = await setupDefaultRundownPlaylist(
			context,
			undefined,
			protectString('ro0')
		)
		expect(playlistId0).toBeTruthy()

		const getFirstSegment = async () =>
			await context.directCollections.Segments.findOne(
				{
					rundownId: rundownId0,
				},
				{
					sort: {
						_rank: 1,
					},
				}
			)

		const getCurrentPartInstance = async (playlistId: RundownPlaylistId) => {
			const playlist = await context.directCollections.RundownPlaylists.findOne(playlistId)
			if (!playlist) throw new Error(`Playlist "${playlistId} not found`)
			if (!playlist.currentPartInfo) throw new Error(`Playlist "${playlistId}" doesn't have any currentPartInfo`)
			return context.directCollections.PartInstances.findOne(playlist.currentPartInfo?.partInstanceId)
		}

		// Activating a rundown, to rehearsal
		await runJobWithPlayoutModel(context, { playlistId: playlistId0 }, null, async (playoutModel) =>
			activateRundownPlaylist(context, playoutModel, true)
		)

		await expect(getFirstSegment()).resolves.toMatchObject({
			name: 'Segment 0',
		})

		await handleActivateAdlibTesting(context, {
			playlistId: playlistId0,
			rundownId: rundownId0,
		})

		// AdlibTesting segment should be at the top
		const topSegment = await getFirstSegment()
		expect(topSegment).toMatchObject({
			orphaned: SegmentOrphanedReason.ADLIB_TESTING,
		})

		await expect(getCurrentPartInstance(playlistId0)).resolves.toMatchObject({
			segmentId: topSegment?._id,
		})

		// Activating a rundown
		await runJobWithPlayoutModel(context, { playlistId: playlistId0 }, null, async (playoutModel) =>
			activateRundownPlaylist(context, playoutModel, false)
		)

		// AdlibTesting segment should be gone
		await expect(getFirstSegment()).resolves.toMatchObject({
			name: 'Segment 0',
		})
	})
})
