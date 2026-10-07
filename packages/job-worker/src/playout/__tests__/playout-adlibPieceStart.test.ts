import {
	BucketAdLibId,
	PartInstanceId,
	PieceId,
	RundownId,
	RundownPlaylistId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { setupDefaultRundownPlaylist, setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import { handleTakeNextPart } from '../take.js'
import { handleAdLibPieceStart } from '../adlibJobs.js'
import { handleActivateRundownPlaylist } from '../activePlaylistJobs.js'
import { ProcessedShowStyleCompound } from '../../jobs/index.js'
import { ReadonlyDeep } from 'type-fest'

jest.mock('../timeline/generate')

describe('Playout API', () => {
	describe('adLibPieceStart', () => {
		let context: MockJobContext
		let showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
		let playlistId: RundownPlaylistId
		let rundownId: RundownId

		beforeEach(async () => {
			context = setupDefaultJobEnvironment()

			showStyle = await setupMockShowStyleCompound(context)

			const setup = await setupDefaultRundownPlaylist(context)
			playlistId = setup.playlistId
			rundownId = setup.rundownId

			await handleActivateRundownPlaylist(context, {
				playlistId: playlistId,
				rehearsal: true,
			})
			await handleTakeNextPart(context, {
				playlistId: playlistId,
				fromPartInstanceId: null,
			})
		})

		async function getCurrentPartInstanceId(): Promise<PartInstanceId> {
			const playlist = (await context.mockCollections.RundownPlaylists.findOne(playlistId)) as DBRundownPlaylist
			if (!playlist.currentPartInfo) throw new Error('Playlist has no current PartInstance')
			return playlist.currentPartInfo.partInstanceId
		}

		async function setCurrentBranding(brandingId: string | null) {
			await context.mockCollections.PartInstances.update(await getCurrentPartInstanceId(), {
				$set: { brandingId },
			})
		}

		async function insertAdLibPiece(onlyValidForBranding: string[] | undefined): Promise<PieceId> {
			const currentPartInstance = (await context.mockCollections.PartInstances.findOne(
				await getCurrentPartInstanceId()
			)) as DBPartInstance

			return context.mockCollections.AdLibPieces.insertOne({
				_id: protectString('brandedAdLib'),
				_rank: 0,
				externalId: 'BRANDED_ADLIB',
				partId: currentPartInstance.part._id,
				rundownId,
				name: 'Branded AdLib',
				lifespan: PieceLifespan.WithinPart,
				sourceLayerId: Object.keys(showStyle.sourceLayers)[0],
				outputLayerId: Object.keys(showStyle.outputLayers)[0],
				content: {},
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
				onlyValidForBranding,
			})
		}

		async function countAdlibbedPieceInstances(): Promise<number> {
			const pieceInstances = await context.mockCollections.PieceInstances.findFetch()
			return pieceInstances.filter((p) => p.adLibSourceId !== undefined).length
		}

		test('rejects a piece hidden by the Branding', async () => {
			const adLibPieceId = await insertAdLibPiece(['branding0'])
			const partInstanceId = await getCurrentPartInstanceId()

			await expect(
				handleAdLibPieceStart(context, {
					playlistId,
					partInstanceId,
					adLibPieceId,
					pieceType: 'normal',
				})
			).rejects.toMatchUserError(UserErrorMessage.AdlibNotValidForBranding)

			await expect(countAdlibbedPieceInstances()).resolves.toBe(0)
		})

		test('rejects queueing a piece hidden by the inherited Branding', async () => {
			const adLibPieceId = await insertAdLibPiece(['branding0'])
			await setCurrentBranding('branding1')
			const partInstanceId = await getCurrentPartInstanceId()

			await expect(
				handleAdLibPieceStart(context, {
					playlistId,
					partInstanceId,
					adLibPieceId,
					pieceType: 'normal',
					queue: true,
				})
			).rejects.toMatchUserError(UserErrorMessage.AdlibNotValidForBranding)
		})

		test('plays a piece valid for the Branding', async () => {
			const adLibPieceId = await insertAdLibPiece(['branding0'])
			await setCurrentBranding('branding0')
			const partInstanceId = await getCurrentPartInstanceId()

			await handleAdLibPieceStart(context, {
				playlistId,
				partInstanceId,
				adLibPieceId,
				pieceType: 'normal',
			})

			await expect(countAdlibbedPieceInstances()).resolves.toBe(1)
		})

		test('a bucket adlib is unaffected', async () => {
			await setCurrentBranding('branding0')
			const partInstanceId = await getCurrentPartInstanceId()

			const adLibPieceId = await context.mockCollections.BucketAdLibPieces.insertOne({
				_id: protectString<BucketAdLibId>('bucketAdLib'),
				_rank: 0,
				bucketId: protectString('bucket0'),
				externalId: 'BUCKET_ADLIB',
				studioId: context.studioId,
				showStyleBaseId: showStyle._id,
				showStyleVariantId: showStyle.showStyleVariantId,
				importVersions: {
					studio: '',
					showStyleBase: '',
					showStyleVariant: '',
					blueprint: '',
					core: '',
				},
				ingestInfo: undefined,
				name: 'Bucket AdLib',
				lifespan: PieceLifespan.WithinPart,
				sourceLayerId: Object.keys(showStyle.sourceLayers)[0],
				outputLayerId: Object.keys(showStyle.outputLayers)[0],
				content: {},
				timelineObjectsString: EmptyPieceTimelineObjectsBlob,
			})

			await handleAdLibPieceStart(context, {
				playlistId,
				partInstanceId,
				adLibPieceId,
				pieceType: 'bucket',
			})

			await expect(countAdlibbedPieceInstances()).resolves.toBe(1)
		})
	})
})
