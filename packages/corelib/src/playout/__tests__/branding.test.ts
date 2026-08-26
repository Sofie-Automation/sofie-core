import type { IBlueprintPartBranding, IBlueprintPieceBranding } from '@sofie-automation/blueprints-integration'
import { resolveAdLibActionForBranding, resolvePartForBranding, resolvePieceForBranding } from '../branding.js'

/** A document which declares the branding properties, but does not use them */
type Unbranded<TDoc, TBranding> = TDoc & {
	onlyValidForBranding?: string[]
	branding?: Record<string, TBranding>
}

describe('branding', () => {
	describe('resolvePartForBranding', () => {
		const part = {
			title: 'Part 0',
			identifier: 'A1',
			branding: {
				branding0: { title: 'Branded Part 0' },
				branding1: {},
			},
		}

		it('applies the overrides for the selected Branding', () => {
			expect(resolvePartForBranding(part, 'branding0')).toEqual({ ...part, title: 'Branded Part 0' })
		})

		it('leaves properties the Branding does not name', () => {
			expect(resolvePartForBranding(part, 'branding0').identifier).toBe('A1')
		})

		it('returns the same object when no Branding is selected', () => {
			expect(resolvePartForBranding(part, null)).toBe(part)
		})

		it('returns the same object for a Branding with no overrides', () => {
			expect(resolvePartForBranding(part, 'branding1')).toBe(part)
		})

		it('returns the same object for an unknown Branding', () => {
			expect(resolvePartForBranding(part, 'not-a-branding')).toBe(part)
		})

		it('returns the same object for a Part with no overrides at all', () => {
			const plainPart: Unbranded<{ title: string }, IBlueprintPartBranding> = { title: 'Part 0' }
			expect(resolvePartForBranding(plainPart, 'branding0')).toBe(plainPart)
		})
	})

	describe('resolvePieceForBranding', () => {
		it('applies the overrides for the selected Branding', () => {
			const piece = {
				name: 'Piece 0',
				tags: ['a'],
				branding: { branding0: { name: 'Branded Piece 0' } },
			}

			expect(resolvePieceForBranding(piece, 'branding0')).toEqual({ ...piece, name: 'Branded Piece 0' })
		})

		it('applies overrides to the layers and the content', () => {
			const piece = {
				name: 'Piece 0',
				sourceLayerId: 'layer0',
				outputLayerId: 'pgm',
				content: { fileName: 'a.mxf', path: '/media/a.mxf' },
				branding: {
					branding0: {
						sourceLayerId: 'layer1',
						content: { fileName: 'a_branded.mxf', path: '/media/a_branded.mxf' },
					},
				},
			}

			const resolved = resolvePieceForBranding(piece, 'branding0')
			expect(resolved?.sourceLayerId).toBe('layer1')
			expect(resolved?.outputLayerId).toBe('pgm')
			expect(resolved?.content).toEqual({ fileName: 'a_branded.mxf', path: '/media/a_branded.mxf' })
		})

		it('replaces an overridden property in full', () => {
			const piece = {
				name: 'Piece 0',
				tags: ['a', 'b'],
				branding: { branding0: { tags: ['c'] } },
			}

			expect(resolvePieceForBranding(piece, 'branding0')?.tags).toEqual(['c'])
		})

		describe('onlyValidForBranding', () => {
			const piece = {
				name: 'Piece 0',
				onlyValidForBranding: ['branding0'],
				branding: { branding0: { name: 'Branded Piece 0' } },
			}

			it('resolves when the selected Branding is listed', () => {
				expect(resolvePieceForBranding(piece, 'branding0')).toEqual({ ...piece, name: 'Branded Piece 0' })
			})

			it('is not used when another Branding is selected', () => {
				expect(resolvePieceForBranding(piece, 'branding1')).toBeNull()
			})

			it('is not used when no Branding is selected', () => {
				expect(resolvePieceForBranding(piece, null)).toBeNull()
			})

			it('is never used when the list is empty', () => {
				expect(resolvePieceForBranding({ ...piece, onlyValidForBranding: [] }, 'branding0')).toBeNull()
			})

			it('is always used when the list is absent', () => {
				const unlimited: Unbranded<{ name: string }, IBlueprintPieceBranding> = { name: 'Piece 0' }
				expect(resolvePieceForBranding(unlimited, 'branding0')).toBe(unlimited)
				expect(resolvePieceForBranding(unlimited, null)).toBe(unlimited)
			})
		})
	})

	describe('resolveAdLibActionForBranding', () => {
		const action = {
			actionId: 'action0',
			display: { label: { key: 'Action 0' }, tags: ['a'] },
			branding: {
				branding0: { display: { label: { key: 'Branded Action 0' } } },
				branding1: { display: {} },
			},
		}

		it('applies the overrides into the display', () => {
			expect(resolveAdLibActionForBranding(action, 'branding0')?.display).toEqual({
				label: { key: 'Branded Action 0' },
				tags: ['a'],
			})
		})

		it('returns the same object when no Branding is selected', () => {
			expect(resolveAdLibActionForBranding(action, null)).toBe(action)
		})

		it('returns the same object for a Branding with no display overrides', () => {
			expect(resolveAdLibActionForBranding(action, 'branding1')).toBe(action)
		})

		it('is not used when the selected Branding is not listed', () => {
			expect(
				resolveAdLibActionForBranding({ ...action, onlyValidForBranding: ['branding9'] }, 'branding0')
			).toBeNull()
		})
	})
})
