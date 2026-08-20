import { CoreRundownPlaylistSnapshot } from '@sofie-automation/corelib/dist/snapshots'
import { getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { defaultRundown, defaultRundownPlaylist } from '../../__mocks__/defaultCollectionObjects.js'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import { listPlayoutDevicesForStudio } from '../../peripheralDevice.js'
import { handleGeneratePlaylistSnapshot } from '../snapshot.js'
import { handleOnSystemSnapshotCreated, pickRundownForPlaylistSnapshot } from '../snapshotHooks.js'

describe('Snapshot blueprint hooks', () => {
	let context: MockJobContext

	beforeEach(async () => {
		context = setupDefaultJobEnvironment()
		await setupMockShowStyleCompound(context)
	})

	describe('onPlaylistSnapshotCreated', () => {
		test('invokes the show style blueprint callback', async () => {
			const onPlaylistSnapshotCreated = jest.fn()
			context.updateShowStyleBlueprint({ onPlaylistSnapshotCreated })

			const { playlistId } = await setupDefaultRundownPlaylist(context)
			const snapshotId = getRandomId()

			await handleGeneratePlaylistSnapshot(context, {
				playlistId,
				full: false,
				withTimeline: false,
				snapshotId,
				reason: 'test reason',
			})

			expect(onPlaylistSnapshotCreated).toHaveBeenCalledTimes(1)
			expect(onPlaylistSnapshotCreated.mock.calls[0][1]).toMatchObject({
				snapshotId: expect.any(String),
				playlistId: expect.any(String),
				reason: 'test reason',
				options: {
					full: false,
					withTimeline: false,
				},
				playlist: {
					name: expect.any(String),
					active: expect.any(Boolean),
					rehearsal: expect.any(Boolean),
				},
			})
		})

		test('does nothing when the callback is not defined', async () => {
			context.updateShowStyleBlueprint({ onPlaylistSnapshotCreated: undefined })

			const { playlistId } = await setupDefaultRundownPlaylist(context)

			await expect(
				handleGeneratePlaylistSnapshot(context, {
					playlistId,
					full: false,
					withTimeline: false,
				})
			).resolves.toBeDefined()
		})
	})

	describe('pickRundownForPlaylistSnapshot', () => {
		test('prefers current part rundown over next when both are set', () => {
			const studioId = protectString('studio0')
			const playlistId = getRandomId()
			const showStyleBaseId = getRandomId()
			const showStyleVariantId = getRandomId()

			const rundownCurrent = defaultRundown(
				'rundown_current',
				studioId,
				null,
				playlistId,
				showStyleBaseId,
				showStyleVariantId
			)
			rundownCurrent.name = 'ZZZ Current'
			const rundownNext = defaultRundown(
				'rundown_next',
				studioId,
				null,
				playlistId,
				showStyleBaseId,
				showStyleVariantId
			)
			rundownNext.name = 'AAA Next'

			const playlist = defaultRundownPlaylist(playlistId, studioId)
			playlist.currentPartInfo = {
				partInstanceId: getRandomId(),
				rundownId: rundownCurrent._id,
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			playlist.nextPartInfo = {
				partInstanceId: getRandomId(),
				rundownId: rundownNext._id,
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}

			const snapshot = literal<CoreRundownPlaylistSnapshot>({
				version: '1',
				playlistId,
				playlist,
				rundowns: [rundownCurrent, rundownNext],
				ingestData: [],
				sofieIngestData: [],
				baselineObjs: [],
				baselineAdlibs: [],
				segments: [],
				parts: [],
				partInstances: [],
				pieces: [],
				pieceInstances: [],
				adLibPieces: [],
				adLibActions: [],
				baselineAdLibActions: [],
				expectedPlayoutItems: [],
				expectedPackages: [],
			})

			expect(pickRundownForPlaylistSnapshot(playlist, snapshot)?._id).toEqual(rundownCurrent._id)
		})
	})

	describe('onSystemSnapshotCreated', () => {
		test('invokes the studio blueprint callback', async () => {
			const onSystemSnapshotCreated = jest.fn()
			context.updateStudioBlueprint({ onSystemSnapshotCreated })

			const snapshotId = getRandomId()
			await handleOnSystemSnapshotCreated(context, {
				snapshotId,
				reason: 'system test',
				type: 'system',
				options: {
					studioId: context.studioId,
					withDeviceSnapshots: true,
				},
			})

			expect(onSystemSnapshotCreated).toHaveBeenCalledTimes(1)
			expect(onSystemSnapshotCreated.mock.calls[0][1]).toMatchObject({
				snapshotId: expect.any(String),
				reason: 'system test',
				type: 'system',
				options: {
					studioId: expect.any(String),
					withDeviceSnapshots: true,
				},
			})
		})

		test('passes fullSystem flag from job props', async () => {
			const onSystemSnapshotCreated = jest.fn()
			context.updateStudioBlueprint({ onSystemSnapshotCreated })

			await handleOnSystemSnapshotCreated(context, {
				snapshotId: getRandomId(),
				reason: 'full system test',
				type: 'system',
				options: {
					studioId: context.studioId,
					fullSystem: true,
				},
			})

			expect(onSystemSnapshotCreated.mock.calls[0][1].options).toMatchObject({
				fullSystem: true,
			})

			onSystemSnapshotCreated.mockClear()

			await handleOnSystemSnapshotCreated(context, {
				snapshotId: getRandomId(),
				reason: 'studio scoped test',
				type: 'system',
				options: {
					studioId: context.studioId,
					fullSystem: false,
				},
			})

			expect(onSystemSnapshotCreated.mock.calls[0][1].options.fullSystem).toBe(false)
		})

		test('does nothing when the callback is not defined', async () => {
			context.updateStudioBlueprint({ onSystemSnapshotCreated: undefined })

			await expect(
				handleOnSystemSnapshotCreated(context, {
					snapshotId: getRandomId(),
					reason: 'system test',
					type: 'debug',
					options: {
						studioId: context.studioId,
					},
				})
			).resolves.toBeUndefined()
		})

		test('listPlayoutDevices returns an empty array when no playout gateway is configured', async () => {
			await expect(listPlayoutDevicesForStudio(context)).resolves.toEqual([])
		})
	})
})
