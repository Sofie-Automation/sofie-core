import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { ReadonlyDeep, SetRequired } from 'type-fest'
import { PlayoutModel } from '../model/PlayoutModel.js'
import { candidatePartIsAfterPreviewPartInstance } from '../infinites.js'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { runJobWithPlayoutModel } from '../lock.js'
import { wrapPartToTemporaryInstance } from '../../__mocks__/partinstance.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

describe('canContinueAdlibOnEndInfinites', () => {
	let context: MockJobContext

	beforeEach(async () => {
		context = setupDefaultJobEnvironment()

		await setupMockShowStyleCompound(context)
	})

	async function wrapWithPlayoutModel<T>(
		fcn: (
			playoutModel: PlayoutModel,
			playlist: SetRequired<ReadonlyDeep<DBRundownPlaylist>, 'activationId'>
		) => Promise<T>
	): Promise<T> {
		const defaultSetup = await setupDefaultRundownPlaylist(context)

		// Mark playlist as active
		await context.mockCollections.RundownPlaylists.update(defaultSetup.playlistId, {
			$set: {
				activationId: getRandomId(),
			},
		})

		const tmpPlaylist = (await context.mockCollections.RundownPlaylists.findOne(
			defaultSetup.playlistId
		)) as DBRundownPlaylist
		expect(tmpPlaylist).toBeTruthy()

		const rundown = (await context.mockCollections.Rundowns.findOne(defaultSetup.rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		return runJobWithPlayoutModel(context, { playlistId: tmpPlaylist._id }, null, async (playoutModel) => {
			const playlist = playoutModel.playlist as SetRequired<ReadonlyDeep<DBRundownPlaylist>, 'activationId'>
			if (!playlist.activationId) throw new Error('Missing activationId')
			return fcn(playoutModel, playlist)
		})
	}

	test('Basic case', async () => {
		await wrapWithPlayoutModel(async (playoutModel, playlist) => {
			const orderedSegments = playoutModel.getAllOrderedSegments()
			const orderedParts = playoutModel.getAllOrderedParts()
			expect(orderedParts.length).toBeGreaterThan(2)

			// At beginning
			expect(
				candidatePartIsAfterPreviewPartInstance(
					context,
					orderedSegments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedParts[0]),
					orderedParts[1]
				)
			).toBeTruthy()

			// Small gap
			expect(
				candidatePartIsAfterPreviewPartInstance(
					context,
					orderedSegments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedParts[0]),
					orderedParts[2]
				)
			).toBeTruthy()

			// At end
			expect(
				candidatePartIsAfterPreviewPartInstance(
					context,
					orderedSegments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedParts[orderedParts.length - 2]),
					orderedParts[orderedParts.length - 1]
				)
			).toBeTruthy()

			// Start to end
			expect(
				candidatePartIsAfterPreviewPartInstance(
					context,
					orderedSegments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedParts[0]),
					orderedParts[orderedParts.length - 1]
				)
			).toBeTruthy()
		})
	})

	test('No previousPartInstance', async () => {
		await wrapWithPlayoutModel(async (playoutModel, _playlist) => {
			const orderedSegments = playoutModel.getAllOrderedSegments()
			const orderedParts = playoutModel.getAllOrderedParts()

			expect(
				candidatePartIsAfterPreviewPartInstance(context, orderedSegments, undefined, orderedParts[1])
			).toBeFalsy()
		})
	})

	test('Is before', async () => {
		await wrapWithPlayoutModel(async (playoutModel, playlist) => {
			const orderedSegments = playoutModel.getAllOrderedSegments()
			const orderedParts = playoutModel.getAllOrderedParts()
			expect(orderedParts.length).toBeGreaterThan(2)

			// At beginning
			expect(
				candidatePartIsAfterPreviewPartInstance(
					context,
					orderedSegments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedParts[1]),
					orderedParts[0]
				)
			).toBeFalsy()

			// At end
			expect(
				candidatePartIsAfterPreviewPartInstance(
					context,
					orderedSegments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedParts[orderedParts.length - 1]),
					orderedParts[orderedParts.length - 2]
				)
			).toBeFalsy()

			// Start to end
			expect(
				candidatePartIsAfterPreviewPartInstance(
					context,
					orderedSegments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedParts[orderedParts.length - 1]),
					orderedParts[0]
				)
			).toBeFalsy()
		})
	})

	test('Orphaned PartInstance', async () => {
		await wrapWithPlayoutModel(async (playoutModel, playlist) => {
			const orderedSegments = playoutModel.getAllOrderedSegments()
			const orderedParts = playoutModel.getAllOrderedParts()
			expect(orderedParts.length).toBeGreaterThan(2)

			const candidatePart = {
				...orderedParts[0],
			}
			// Orphaned because it has no presence in the ordered list
			candidatePart._rank = candidatePart._rank + 0.1
			candidatePart._id = protectString(candidatePart._id + '2')

			// After first
			expect(
				candidatePartIsAfterPreviewPartInstance(
					context,
					orderedSegments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedParts[0]),
					candidatePart
				)
			).toBeTruthy()

			// Before second
			expect(
				candidatePartIsAfterPreviewPartInstance(
					context,
					orderedSegments,
					wrapPartToTemporaryInstance(playlist.activationId, orderedParts[1]),
					candidatePart
				)
			).toBeFalsy()
		})
	})
})
