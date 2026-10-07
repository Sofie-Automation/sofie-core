import { setupEmptyEnvironment } from '../../../../../__mocks__/helpers/database'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartInstances } from '../../../../collections'
import { PartPlayoutTimingsTransitionMigrationStep } from '../PartPlayoutTimingsTransitionMigrationStep'

describe('PartPlayoutTimingsTransitionMigrationStep', () => {
	beforeEach(async () => {
		await setupEmptyEnvironment()
	})

	const inTransition = { blockTakeDuration: 500, previousPartKeepaliveDuration: 200, partContentDelayDuration: 100 }

	/** Timings as they were stored before transitionSource and blockTakeDuration were added */
	const oldTimings = {
		inTransitionStart: null,
		toPartDelay: 0,
		toPartPostroll: 0,
		fromPartRemaining: 0,
		fromPartPostroll: 0,
		fromPartKeepalive: 0,
	}

	function createPartInstance(
		partProps: Partial<DBPart>,
		partPlayoutTimings: Record<string, unknown> | undefined
	): PartInstance {
		return {
			_id: protectString('partInstance0'),
			rundownId: protectString('rundown0'),
			segmentId: protectString('segment0'),
			takeCount: 1,
			rehearsal: false,
			isTemporary: false,
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString('segmentPlayout0'),
			part: {
				_id: protectString('part0'),
				_rank: 0,
				rundownId: protectString('rundown0'),
				segmentId: protectString('segment0'),
				externalId: 'part0',
				title: 'part0',
				expectedDurationWithTransition: undefined,
				...partProps,
			},
			partPlayoutTimings: partPlayoutTimings as PartInstance['partPlayoutTimings'],
		}
	}

	/** Each case is the part, the stored timings, and the expected values added by the migration */
	const cases: Array<
		[name: string, partProps: Partial<DBPart>, timings: Record<string, unknown>, added: Record<string, unknown>]
	> = [
		[
			'inTransition',
			{ inTransition },
			{ ...oldTimings, inTransitionStart: 0, toPartDelay: 100, fromPartRemaining: 200, fromPartKeepalive: 200 },
			{ transitionSource: 'inTransition', blockTakeDuration: 500 },
		],
		[
			'autoNextOverlap',
			{ autoNext: true },
			{ ...oldTimings, fromPartRemaining: 300, fromPartKeepalive: 300 },
			{ transitionSource: 'autoNextOutTransition', blockTakeDuration: 0 },
		],
		[
			'no transition',
			{ inTransition },
			{ ...oldTimings, toPartDelay: 400, fromPartRemaining: 400 },
			{ transitionSource: 'none', blockTakeDuration: 0 },
		],
	]

	test.each(cases)('%s', async (_name, partProps, timings, added) => {
		await PartInstances.mutableCollection.insertAsync(createPartInstance(partProps, timings))

		const step = new PartPlayoutTimingsTransitionMigrationStep()
		expect(await step.validate()).toBe(
			'There are 1 PartInstances with partPlayoutTimings missing the transitionSource or blockTakeDuration'
		)

		await step.migrate()

		expect(await PartInstances.findOneAsync(protectString('partInstance0'))).toEqual(
			createPartInstance(partProps, { ...timings, ...added })
		)
		expect(await step.validate()).toBe(false)
	})

	test('no migration needed', async () => {
		await PartInstances.mutableCollection.insertAsync(createPartInstance({}, undefined))
		await PartInstances.mutableCollection.insertAsync({
			...createPartInstance({}, { ...oldTimings, transitionSource: 'none', blockTakeDuration: 0 }),
			_id: protectString('partInstance1'),
		})

		const step = new PartPlayoutTimingsTransitionMigrationStep()
		expect(await step.validate()).toBe(false)
	})
})
