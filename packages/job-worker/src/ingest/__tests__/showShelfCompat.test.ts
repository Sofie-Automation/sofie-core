import '../../__mocks__/_extendJest.js'
import { setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { setupMockPeripheralDevice, setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import {
	BlueprintResultSegment,
	IBlueprintSegment,
	IngestRundown,
	IngestSegment,
} from '@sofie-automation/blueprints-integration'
import { ShelfButtonSize } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	PeripheralDevice,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { RundownSource } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { wrapGenericIngestJob } from '../jobWrappers.js'
import { handleUpdatedRundown } from '../ingestRundownJobs.js'

const handleUpdatedRundownWrapped = wrapGenericIngestJob(handleUpdatedRundown)

function createRundownSource(peripheralDevice: PeripheralDevice): RundownSource {
	return {
		type: 'nrcs',
		peripheralDeviceId: peripheralDevice._id,
		nrcsName: peripheralDevice.nrcsName,
	}
}

describe('Blueprint segment legacy showShelf compatibility', () => {
	let context = setupDefaultJobEnvironment()
	let device: PeripheralDevice

	beforeAll(async () => {
		context = setupDefaultJobEnvironment()

		const showStyleCompound = await setupMockShowStyleCompound(context)
		context.setStudio({
			...(context.rawStudio as DBStudio),
			settingsWithOverrides: wrapDefaultObject({
				...context.studio.settings,
				// keep defaults; not relevant here
			}),
			supportedShowStyleBase: [showStyleCompound._id],
		})

		device = await setupMockPeripheralDevice(
			context,
			PeripheralDeviceCategory.INGEST,
			PeripheralDeviceType.MOS,
			PERIPHERAL_SUBTYPE_PROCESS
		)

		jest.clearAllMocks()
	})

	beforeEach(async () => {
		await context.clearAllRundownsAndPlaylists()
	})

	async function createRundownWithSingleSegment(
		overrideGetSegment: (ingestSegment: IngestSegment) => BlueprintResultSegment
	) {
		context.updateShowStyleBlueprint({
			getSegment: (_ctx, ingestSegment) => overrideGetSegment(ingestSegment),
		})

		const ingest: IngestRundown = {
			externalId: 'rundown_showShelfCompat',
			name: 'Rundown',
			type: 'mock',
			payload: undefined,
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					payload: undefined,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
							payload: undefined,
						},
					],
				},
			],
		}

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: ingest.externalId,
			ingestRundown: ingest,
			isCreateAction: true,
			rundownSource: createRundownSource(device),
		})

		const rundown = (await context.mockCollections.Rundowns.findOne({ externalId: ingest.externalId })) as DBRundown
		expect(rundown).toBeTruthy()

		const segments = await context.mockCollections.Segments.findFetch({ rundownId: rundown._id })
		expect(segments).toHaveLength(1)

		return { rundown, segment: segments[0] as any }
	}

	test('showShelf:true maps to displayMinishelf:inherit and does not persist showShelf', async () => {
		const { segment } = await createRundownWithSingleSegment((ingestSegment) => {
			const seg: IBlueprintSegment = {
				name: ingestSegment.name,
				showShelf: true,
			}
			return {
				segment: seg,
				parts: [],
			}
		})

		expect(segment.displayMinishelf).toBe(ShelfButtonSize.INHERIT)
		expect(segment.showShelf).toBeUndefined()

		// A warning note should be emitted via the blueprint context
		expect(segment.notes?.[0]?.message.key).toContain('Deprecated blueprint segment field "showShelf" used')
	})

	test('showShelf:false results in minishelf hidden (no displayMinishelf) and does not persist showShelf', async () => {
		const { segment } = await createRundownWithSingleSegment((ingestSegment) => {
			const seg: IBlueprintSegment = {
				name: ingestSegment.name,
				showShelf: false,
			}
			return {
				segment: seg,
				parts: [],
			}
		})

		expect(segment.displayMinishelf).toBeUndefined()
		expect(segment.showShelf).toBeUndefined()
		expect(segment.notes?.[0]?.message.key).toContain('Deprecated blueprint segment field "showShelf" used')
	})

	test('displayMinishelf wins over legacy showShelf', async () => {
		const { segment } = await createRundownWithSingleSegment((ingestSegment) => {
			const seg: IBlueprintSegment = {
				name: ingestSegment.name,
				showShelf: true,
				displayMinishelf: ShelfButtonSize.COMPACT,
			}
			return {
				segment: seg,
				parts: [],
			}
		})

		expect(segment.displayMinishelf).toBe(ShelfButtonSize.COMPACT)
		expect(segment.showShelf).toBeUndefined()
	})
})
