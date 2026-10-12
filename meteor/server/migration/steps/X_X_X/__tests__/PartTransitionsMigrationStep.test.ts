import { setupEmptyEnvironment } from '../../../../../__mocks__/helpers/database'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PartInstances, Parts } from '../../../../collections'
import { PartTransitionsMigrationStep } from '../PartTransitionsMigrationStep'

describe('PartTransitionsMigrationStep', () => {
	beforeEach(async () => {
		await setupEmptyEnvironment()
	})

	const exclusive = {
		type: 'exclusive',
		blockTakeDuration: 100,
		partKeepaliveDuration: 200,
		nextPartContentDelayDuration: 300,
	} as const

	function createPart(id: string, props: Record<string, unknown>): DBPart {
		return {
			_id: protectString(id),
			_rank: 0,
			rundownId: protectString('rundown0'),
			segmentId: protectString('segment0'),
			externalId: id,
			title: id,
			expectedDurationWithTransition: undefined,
			...props,
		}
	}

	/** Each case is the stored transition properties, and the expected properties after the migration */
	const cases: Array<[name: string, before: Record<string, unknown>, after: Record<string, unknown>]> = [
		[
			'outTransition without a type',
			{ outTransition: { duration: 1000 } },
			{ outTransition: { type: 'additive', duration: 1000 } },
		],
		[
			'autoNextOverlap',
			{ autoNext: true, autoNextOverlap: 500 },
			{
				autoNext: true,
				autoNextOutTransition: {
					type: 'exclusive',
					blockTakeDuration: 0,
					partKeepaliveDuration: 500,
					nextPartContentDelayDuration: 0,
				},
			},
		],
		['autoNextOverlap of 0', { autoNext: true, autoNextOverlap: 0 }, { autoNext: true }],
		[
			'autoNextOverlap with an existing autoNextOutTransition',
			{ autoNext: true, autoNextOverlap: 500, autoNextOutTransition: exclusive },
			{ autoNext: true, autoNextOutTransition: exclusive },
		],
		[
			'disableNextInTransition without an outTransition',
			{ disableNextInTransition: true },
			{
				outTransition: {
					type: 'exclusive',
					blockTakeDuration: 0,
					partKeepaliveDuration: 0,
					nextPartContentDelayDuration: 0,
				},
			},
		],
		[
			'disableNextInTransition with an outTransition without a type',
			{ disableNextInTransition: true, outTransition: { duration: 1000 } },
			{ outTransition: { type: 'additive', duration: 1000, disableNextInTransition: true } },
		],
		[
			'disableNextInTransition with an exclusive outTransition',
			{ disableNextInTransition: true, outTransition: exclusive },
			{ outTransition: exclusive },
		],
		['disableNextInTransition false', { disableNextInTransition: false }, {}],
	]

	test.each(cases)('Part: %s', async (_name, before, after) => {
		await Parts.mutableCollection.insertAsync(createPart('part0', before))

		const step = new PartTransitionsMigrationStep()
		expect(await step.validate()).toBe(
			'There are 1 Parts and 0 PartInstances with transition properties that must be converted'
		)

		await step.migrate()

		expect(await Parts.findOneAsync(protectString('part0'))).toEqual(createPart('part0', after))
		expect(await step.validate()).toBe(false)
	})

	test.each(cases)('PartInstance: %s', async (_name, before, after) => {
		const partInstance: PartInstance = {
			_id: protectString('partInstance0'),
			rundownId: protectString('rundown0'),
			segmentId: protectString('segment0'),
			takeCount: 1,
			rehearsal: false,
			isTemporary: false,
			playlistActivationId: protectString('active'),
			segmentPlayoutId: protectString('segmentPlayout0'),
			part: createPart('part0', before),
		}
		await PartInstances.mutableCollection.insertAsync(partInstance)

		const step = new PartTransitionsMigrationStep()
		expect(await step.validate()).toBe(
			'There are 0 Parts and 1 PartInstances with transition properties that must be converted'
		)

		await step.migrate()

		expect(await PartInstances.findOneAsync(protectString('partInstance0'))).toEqual({
			...partInstance,
			part: createPart('part0', after),
		})
		expect(await step.validate()).toBe(false)
	})

	test('no migration needed for converted Parts', async () => {
		await Parts.mutableCollection.insertAsync(
			createPart('part0', {
				autoNext: true,
				autoNextOutTransition: exclusive,
				outTransition: { type: 'additive', duration: 1000, disableNextInTransition: true },
			})
		)
		await Parts.mutableCollection.insertAsync(createPart('part1', { outTransition: exclusive }))

		const step = new PartTransitionsMigrationStep()
		expect(await step.validate()).toBe(false)
	})
})
