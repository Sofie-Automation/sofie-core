import { LegacyPieceLifespan } from '@sofie-automation/shared-lib/dist/core/model/Rundown'
import { PieceLifespan } from '../pieceLifespan.js'

describe('PieceLifespan', () => {
	test.each([
		[LegacyPieceLifespan.OutOnSegmentEnd, 'segment'],
		[LegacyPieceLifespan.OutOnRundownEnd, 'rundown'],
		[LegacyPieceLifespan.OutOnShowStyleEnd, 'showstyle'],
	] as const)('the legacy %s preset keeps its shadow behaviour', (preset, scope) => {
		const lifespan = PieceLifespan.from(preset)

		expect(lifespan.definition()).toEqual({ scope, presence: 'forward-scope', inShadow: 'legacy-persist' })
		expect(lifespan.persistsInShadow).toBe(true)
		expect(lifespan.isEndedByNewerOfSameScope).toBe(true)
		expect(lifespan.legacyLifespan).toBe(preset)
	})

	test('persist resolves to the legacy preset of its scope', () => {
		const lifespan = PieceLifespan.from({ scope: 'rundown', presence: 'forward-scope', inShadow: 'persist' })

		expect(lifespan.isEndedByNewerOfSameScope).toBe(false)
		expect(lifespan.legacyLifespan).toBe(LegacyPieceLifespan.OutOnRundownEnd)
	})
})
