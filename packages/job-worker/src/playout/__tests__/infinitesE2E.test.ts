import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import {
	setupDefaultRundownPlaylist,
	setupMockPeripheralDevice,
	setupMockShowStyleCompound,
} from '../../__mocks__/presetCollections.js'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { PartInstanceId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { handleTakeNextPart } from '../take.js'
import { handleActivateRundownPlaylist } from '../activePlaylistJobs.js'
import { getSelectedPartInstances } from './lib.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import * as peripheralDeviceLib from '../../peripheralDevice.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { defaultPiece } from '../../__mocks__/defaultCollectionObjects.js'
import { sleep } from '@sofie-automation/shared-lib/dist/lib/lib'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { IPieceLifespan } from '@sofie-automation/shared-lib/dist/core/model/Rundown'
import { adjustFakeTime, useFakeCurrentTime } from '../../__mocks__/time.js'

jest.spyOn(peripheralDeviceLib, 'executePeripheralDeviceFunction').mockImplementation(async () => sleep(10))

describe('Infinites through playout', () => {
	let context: MockJobContext

	beforeEach(async () => {
		context = setupDefaultJobEnvironment()
		context.setStudio({
			...context.rawStudio,
			settingsWithOverrides: wrapDefaultObject({ ...context.studio.settings, minimumTakeSpan: 0 }),
		})
		jest.spyOn(context, 'queueEventJob').mockImplementation(async () => Promise.resolve())
		await setupMockShowStyleCompound(context)
		await setupMockPeripheralDevice(
			context,
			PeripheralDeviceCategory.PLAYOUT,
			PeripheralDeviceType.PLAYOUT,
			PERIPHERAL_SUBTYPE_PROCESS
		)
		useFakeCurrentTime()
	})

	async function getPieceIdsOnAir(playlistId: RundownPlaylistId) {
		const playlist = (await context.mockCollections.RundownPlaylists.findOne(playlistId)) as DBRundownPlaylist
		const { currentPartInstance, nextPartInstance } = await getSelectedPartInstances(context, playlist)
		const idsIn = async (partInstanceId: PartInstanceId) =>
			(await context.mockCollections.PieceInstances.findFetch({ partInstanceId, reset: { $ne: true } }))
				.map((p) => String(p.piece._id).replace(/^.*_piece/, ''))
				.sort()
		return {
			current: currentPartInstance && {
				part: String(currentPartInstance.part._id).replace(/^.*_part/, ''),
				pieces: await idsIn(currentPartInstance._id),
			},
			next: nextPartInstance && {
				part: String(nextPartInstance.part._id).replace(/^.*_part/, ''),
				pieces: await idsIn(nextPartInstance._id),
			},
		}
	}

	async function addInfinite(rundownId: string, name: string, lifespan: IPieceLifespan, layer: string) {
		await context.mockCollections.Pieces.insertOne({
			...defaultPiece(
				protectString(`${rundownId}_piece${name}`),
				protectString(rundownId),
				protectString(`${rundownId}_segment0`),
				protectString(`${rundownId}_part0_0`)
			),
			lifespan,
			sourceLayerId: layer,
			outputLayerId: Object.keys(context.studio.mappings)[0] ?? '',
		})
	}

	test('rundown scoped infinites from the first part', async () => {
		const { playlistId, rundownId } = await setupDefaultRundownPlaylist(context)
		const rd = String(rundownId)

		await addInfinite(
			rd,
			'FollowStop',
			{ scope: 'rundown', presence: 'follow-playhead', inShadow: 'stop' },
			'layerA'
		)
		await addInfinite(
			rd,
			'ForwardStop',
			{ scope: 'rundown', presence: 'forward-scope', inShadow: 'stop' },
			'layerB'
		)
		await addInfinite(
			rd,
			'ForwardPersist',
			{ scope: 'rundown', presence: 'forward-scope', inShadow: 'persist' },
			'layerC'
		)

		await handleActivateRundownPlaylist(context, { playlistId, rehearsal: false })
		const steps = [await getPieceIdsOnAir(playlistId)]

		for (let i = 0; i < 3; i++) {
			adjustFakeTime(5000)
			const playlist = (await context.mockCollections.RundownPlaylists.findOne(playlistId)) as DBRundownPlaylist
			await handleTakeNextPart(context, {
				playlistId,
				fromPartInstanceId: playlist.currentPartInfo?.partInstanceId ?? null,
			})
			steps.push(await getPieceIdsOnAir(playlistId))
		}

		expect(steps).toMatchSnapshot()
	})
})
