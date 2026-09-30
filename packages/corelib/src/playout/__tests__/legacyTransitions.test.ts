import {
	convertLegacyAutoNextOverlap,
	convertLegacyDisableNextInTransition,
	convertLegacyPartTransitionPropsInPlace,
	PartWithLegacyTransitionProps,
} from '../legacyTransitions.js'

describe('Legacy Part transitions', () => {
	const exclusive = {
		type: 'exclusive',
		blockTakeDuration: 100,
		partKeepaliveDuration: 200,
		nextPartContentDelayDuration: 300,
	} as const

	describe('convertLegacyAutoNextOverlap', () => {
		test('no overlap', () => {
			expect(convertLegacyAutoNextOverlap({})).toEqual({
				autoNextOutTransition: undefined,
				behaviourChanged: false,
			})
			expect(convertLegacyAutoNextOverlap({ autoNextOverlap: 0 })).toEqual({
				autoNextOutTransition: undefined,
				behaviourChanged: false,
			})
		})

		test('overlap', () => {
			expect(convertLegacyAutoNextOverlap({ autoNextOverlap: 500 })).toEqual({
				autoNextOutTransition: {
					type: 'exclusive',
					blockTakeDuration: 0,
					partKeepaliveDuration: 500,
					nextPartContentDelayDuration: 0,
				},
				behaviourChanged: false,
			})
		})

		test('overlap with an exclusive outTransition', () => {
			expect(convertLegacyAutoNextOverlap({ autoNextOverlap: 500, outTransition: exclusive })).toEqual({
				autoNextOutTransition: {
					type: 'exclusive',
					blockTakeDuration: 0,
					partKeepaliveDuration: 500,
					nextPartContentDelayDuration: 0,
				},
				behaviourChanged: false,
			})
		})

		test('overlap with an additive outTransition', () => {
			expect(convertLegacyAutoNextOverlap({ autoNextOverlap: 500, outTransition: { duration: 1000 } })).toEqual({
				autoNextOutTransition: {
					type: 'exclusive',
					blockTakeDuration: 0,
					partKeepaliveDuration: 500,
					nextPartContentDelayDuration: 0,
				},
				behaviourChanged: true,
			})
		})

		test('existing autoNextOutTransition is kept', () => {
			expect(convertLegacyAutoNextOverlap({ autoNextOverlap: 500, autoNextOutTransition: exclusive })).toEqual({
				autoNextOutTransition: undefined,
				behaviourChanged: false,
			})
		})
	})

	describe('convertLegacyDisableNextInTransition', () => {
		test('not disabled', () => {
			expect(convertLegacyDisableNextInTransition({})).toBeUndefined()
			expect(convertLegacyDisableNextInTransition({ disableNextInTransition: false })).toBeUndefined()
		})

		test('no outTransition', () => {
			expect(convertLegacyDisableNextInTransition({ disableNextInTransition: true })).toEqual({
				type: 'exclusive',
				blockTakeDuration: 0,
				partKeepaliveDuration: 0,
				nextPartContentDelayDuration: 0,
			})
		})

		test('additive outTransition', () => {
			expect(
				convertLegacyDisableNextInTransition({
					disableNextInTransition: true,
					outTransition: { duration: 1000 },
				})
			).toEqual({ duration: 1000, disableNextInTransition: true })
		})

		test('exclusive outTransition', () => {
			expect(
				convertLegacyDisableNextInTransition({ disableNextInTransition: true, outTransition: exclusive })
			).toBeUndefined()
		})
	})

	test('convertLegacyPartTransitionPropsInPlace', () => {
		const part: PartWithLegacyTransitionProps = {
			autoNextOverlap: 500,
			disableNextInTransition: true,
			outTransition: { duration: 1000 },
		}

		expect(convertLegacyPartTransitionPropsInPlace(part)).toBe(true)
		expect(part).toEqual({
			autoNextOutTransition: {
				type: 'exclusive',
				blockTakeDuration: 0,
				partKeepaliveDuration: 500,
				nextPartContentDelayDuration: 0,
			},
			outTransition: { duration: 1000, disableNextInTransition: true },
		})
	})
})
