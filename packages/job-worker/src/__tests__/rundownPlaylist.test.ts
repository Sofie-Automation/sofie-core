import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { protectString, protectStringArray } from '@sofie-automation/corelib/dist/protectedString'
import { ProcessedShowStyleCompound } from '../jobs/index.js'
import { ReadonlyDeep } from 'type-fest'
import {
	handleMoveRundownIntoPlaylist,
	produceRundownPlaylistInfoFromRundown,
	handleRestoreRundownsInPlaylistToDefaultOrder,
} from '../rundownPlaylists.js'
import { MockJobContext, setupDefaultJobEnvironment } from '../__mocks__/context.js'
import {
	setupDefaultRundownPlaylist,
	setupDefaultRundown,
	setupMockShowStyleCompound,
} from '../__mocks__/presetCollections.js'

describe('Rundown', () => {
	let context: MockJobContext
	let showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
	beforeAll(async () => {
		context = setupDefaultJobEnvironment()

		showStyle = await setupMockShowStyleCompound(context)
	})
	test('moveRundownIntoPlaylist', async () => {
		// Set up a playlist:
		const { rundownId: rundownId00, playlistId: playlistId0 } = await setupDefaultRundownPlaylist(
			context,
			showStyle,
			protectString('rundown00')
		)
		let playlist0 = (await context.mockCollections.RundownPlaylists.findOne(playlistId0)) as DBRundownPlaylist
		expect(playlist0).toBeTruthy()

		// Add 2 more rundowns in it:
		const rundownId02 = protectString('rundown02')
		await setupDefaultRundown(context, showStyle, playlistId0, protectString('rundown02')) // intentionally not created in the right order
		const rundownId01 = protectString('rundown01')
		await setupDefaultRundown(context, showStyle, playlistId0, protectString('rundown01'))
		expect(rundownId00).toEqual('rundown00')
		expect(rundownId01).toEqual('rundown01')
		expect(rundownId02).toEqual('rundown02')
		// The setupDefaultRundown doesn't set _rank, set expectedStart so that they will get a default order from that:
		await context.mockCollections.Rundowns.update(rundownId00, {
			$set: {
				playlistId: playlistId0,
				playlistIdIsSetInSofie: true,
				timing: { type: PlaylistTimingType.ForwardTime, expectedStart: 1000 },
				externalId: `${rundownId00}_ext`,
			},
		})
		await context.mockCollections.Rundowns.update(rundownId01, {
			$set: {
				playlistId: playlistId0,
				playlistIdIsSetInSofie: true,
				timing: { type: PlaylistTimingType.ForwardTime, expectedStart: 2000 },
				externalId: `${rundownId01}_ext`,
			},
		})
		await context.mockCollections.Rundowns.update(rundownId02, {
			$set: {
				playlistId: playlistId0,
				playlistIdIsSetInSofie: true,
				timing: { type: PlaylistTimingType.ForwardTime, expectedStart: 3000 },
				externalId: `${rundownId02}_ext`,
			},
		})

		const rundown00 = (await context.mockCollections.Rundowns.findOne(rundownId00)) as Rundown
		expect(rundown00).toBeTruthy()
		expect(rundown00.playlistId).toEqual(playlistId0)

		// This should set the default sorting of the rundowns in the plylist:
		const allRundowns = await context.mockCollections.Rundowns.findFetch({
			playlistId: playlist0._id,
		})
		const rundownPlaylist = produceRundownPlaylistInfoFromRundown(
			context,
			undefined,
			playlist0,
			playlist0._id,
			playlist0.externalId,
			allRundowns
		)
		await context.mockCollections.RundownPlaylists.update(playlist0._id, rundownPlaylist)
		expect(rundownPlaylist.rundownIdsInOrder).toEqual(['rundown00', 'rundown01', 'rundown02'])

		const getRundownIDs = async (id: RundownPlaylistId) => {
			const playlist = await context.mockCollections.RundownPlaylists.findOne(id)
			return playlist?.rundownIdsInOrder
		}

		// Ensure they stay still when restoring default order:
		await handleRestoreRundownsInPlaylistToDefaultOrder(context, {
			playlistId: playlist0._id,
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown00', 'rundown01', 'rundown02'])

		// Move the rundown:
		await handleMoveRundownIntoPlaylist(context, {
			rundownId: rundownId00,
			intoPlaylistId: playlist0._id,
			rundownsIdsInPlaylistInOrder: protectStringArray(['rundown01', 'rundown02', 'rundown00']),
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown01', 'rundown02', 'rundown00'])

		playlist0 = (await context.mockCollections.RundownPlaylists.findOne(playlistId0)) as DBRundownPlaylist
		expect(playlist0).toBeTruthy()

		await handleMoveRundownIntoPlaylist(context, {
			rundownId: rundownId02,
			intoPlaylistId: playlist0._id,
			rundownsIdsInPlaylistInOrder: protectStringArray(['rundown02', 'rundown01', 'rundown00']),
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown02', 'rundown01', 'rundown00'])

		// Introduce another playlist
		const { rundownId: rundownId10, playlistId: playlistId1 } = await setupDefaultRundownPlaylist(
			context,
			showStyle,
			protectString('rundown10')
		)
		expect(rundownId10).toEqual('rundown10')
		const playlist1 = (await context.mockCollections.RundownPlaylists.findOne(playlistId1)) as DBRundownPlaylist
		expect(playlist1).toBeTruthy()

		await expect(context.mockCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(2)

		// Move over a rundown to the other playlist:
		await handleMoveRundownIntoPlaylist(context, {
			rundownId: rundownId02,
			intoPlaylistId: playlist1._id,
			rundownsIdsInPlaylistInOrder: protectStringArray(['rundown10', 'rundown02']), // Note: this gets ignored
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown01', 'rundown00'])
		await expect(getRundownIDs(playlist1._id)).resolves.toEqual(['rundown02', 'rundown10'])

		// Move a rundown out of a playlist:
		await handleMoveRundownIntoPlaylist(context, {
			rundownId: rundownId02,
			intoPlaylistId: null,
			rundownsIdsInPlaylistInOrder: [],
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown01', 'rundown00'])
		await expect(getRundownIDs(playlist1._id)).resolves.toEqual(['rundown10'])
		await expect(context.mockCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(3) // A new playlist has been created
		// The newly created playlist:
		const newPlaylist = (await context.mockCollections.RundownPlaylists.findOne({
			_id: { $nin: [playlistId0, playlistId1] },
		})) as DBRundownPlaylist
		expect(newPlaylist).toBeTruthy()
		await expect(getRundownIDs(newPlaylist._id)).resolves.toEqual(['rundown02'])

		// Move the last rundown into another playlist:
		await handleMoveRundownIntoPlaylist(context, {
			rundownId: rundownId02,
			intoPlaylistId: null,
			rundownsIdsInPlaylistInOrder: [],
		})
		await expect(context.mockCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(3) // A new playlist has been created, and an old one was removed
		const newPlaylist2 = (await context.mockCollections.RundownPlaylists.findOne({
			_id: { $nin: [playlistId0, playlistId1, newPlaylist._id] },
		})) as DBRundownPlaylist
		expect(newPlaylist2).toBeTruthy()
		await expect(getRundownIDs(newPlaylist2._id)).resolves.toEqual(['rundown02'])

		// Move the rundown back into a playlist:
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown01', 'rundown00'])
		// Note: the order here will be ignored, new rundowns are placed last:
		await handleMoveRundownIntoPlaylist(context, {
			rundownId: rundownId02,
			intoPlaylistId: playlist0._id,
			rundownsIdsInPlaylistInOrder: protectStringArray(['rundown01', 'rundown02', 'rundown00']),
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown01', 'rundown00', 'rundown02'])
		await expect(getRundownIDs(playlist1._id)).resolves.toEqual(['rundown10'])
		await expect(context.mockCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(2) // A playlist was removed

		// Restore the order:
		await handleRestoreRundownsInPlaylistToDefaultOrder(context, {
			playlistId: playlist0._id,
		})
		await expect(getRundownIDs(playlist0._id)).resolves.toEqual(['rundown00', 'rundown01', 'rundown02'])
	})
})
