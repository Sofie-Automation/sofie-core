import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	sanitiseActionBrandingFromBlueprint,
	sanitisePartBrandingFromBlueprint,
	sanitisePieceBrandingFromBlueprint,
} from '../postProcessBranding.js'
import { logger } from '../../logging.js'

describe('postProcessBranding', () => {
	const blueprintId = protectString<BlueprintId>('blueprint0')

	let warnSpy: jest.SpyInstance
	beforeEach(() => {
		warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger)
	})
	afterEach(() => {
		warnSpy.mockRestore()
	})

	describe('sanitisePartBrandingFromBlueprint', () => {
		it('keeps valid overrides unchanged', () => {
			const part = {
				title: 'Part 0',
				branding: {
					branding0: { title: 'Branded', prompterTitle: 'Prompter', identifier: 'id' },
				},
			}

			sanitisePartBrandingFromBlueprint(part, blueprintId, 'Part')

			expect(part.branding).toEqual({
				branding0: { title: 'Branded', prompterTitle: 'Prompter', identifier: 'id' },
			})
			expect(warnSpy).not.toHaveBeenCalled()
		})

		it('drops properties which are not brandable, or have the wrong type', () => {
			const part = {
				branding: {
					branding0: { title: 123, prompterTitle: 'Prompter', autoNext: true },
				} as any,
			}

			sanitisePartBrandingFromBlueprint(part, blueprintId, 'Part')

			expect(part.branding).toEqual({ branding0: { prompterTitle: 'Prompter' } })
			expect(warnSpy).toHaveBeenCalledTimes(2)
		})

		it('drops a Branding left with no overrides, and the branding when none are left', () => {
			const part: { branding?: any } = {
				branding: { branding0: { autoNext: true }, branding1: 'not an object' },
			}

			sanitisePartBrandingFromBlueprint(part, blueprintId, 'Part')

			expect(part).toEqual({})
			expect('branding' in part).toBe(false)
		})

		it('leaves an absent or explicitly undefined branding untouched', () => {
			const absent: { branding?: any } = {}
			sanitisePartBrandingFromBlueprint(absent, blueprintId, 'Part')
			expect('branding' in absent).toBe(false)

			// An update may explicitly clear the branding
			const cleared: { branding?: any } = { branding: undefined }
			sanitisePartBrandingFromBlueprint(cleared, blueprintId, 'Part')
			expect('branding' in cleared).toBe(true)
			expect(cleared.branding).toBeUndefined()

			expect(warnSpy).not.toHaveBeenCalled()
		})

		it('does not allow a Branding id to replace the prototype', () => {
			const part = { branding: JSON.parse('{"__proto__": {"title": "Branded"}}') }

			sanitisePartBrandingFromBlueprint(part, blueprintId, 'Part')

			expect(Object.getPrototypeOf(part.branding)).toBe(Object.prototype)
			expect(Object.hasOwn(part.branding, '__proto__')).toBe(true)
		})
	})

	describe('sanitisePieceBrandingFromBlueprint', () => {
		it('does not allow the tags to be overridden', () => {
			const piece = {
				branding: { branding0: { name: 'Branded', tags: ['a'] } as any },
			}

			sanitisePieceBrandingFromBlueprint(piece, blueprintId, 'Piece')

			expect(piece.branding).toEqual({ branding0: { name: 'Branded' } })
			expect(warnSpy).toHaveBeenCalledTimes(1)
		})

		it('keeps only the strings of onlyValidForBranding', () => {
			const piece = { onlyValidForBranding: ['branding0', 5, 'branding1'] as any }

			sanitisePieceBrandingFromBlueprint(piece, blueprintId, 'Piece')

			expect(piece.onlyValidForBranding).toEqual(['branding0', 'branding1'])
			expect(warnSpy).toHaveBeenCalledTimes(1)
		})

		it('drops onlyValidForBranding when it is not an array', () => {
			// A string would otherwise be matched as a substring
			const piece: { onlyValidForBranding?: any } = { onlyValidForBranding: 'branding0' }

			sanitisePieceBrandingFromBlueprint(piece, blueprintId, 'Piece')

			expect('onlyValidForBranding' in piece).toBe(false)
			expect(warnSpy).toHaveBeenCalledTimes(1)
		})

		it('keeps an empty onlyValidForBranding, as that is a valid limit', () => {
			const piece = { onlyValidForBranding: [] }

			sanitisePieceBrandingFromBlueprint(piece, blueprintId, 'Piece')

			expect(piece.onlyValidForBranding).toEqual([])
		})
	})

	describe('sanitiseActionBrandingFromBlueprint', () => {
		it('wraps the translatable messages with the namespace of the Blueprint', () => {
			const action = {
				branding: {
					branding0: {
						display: {
							label: { key: 'Label' },
							description: { key: 'Description', args: { a: 1 } },
							triggerLabel: { key: 'Trigger' },
							_rank: 5,
							tags: ['a'],
						},
					},
				},
			}

			sanitiseActionBrandingFromBlueprint(action, blueprintId, 'AdLib Action')

			expect(action.branding).toEqual({
				branding0: {
					display: {
						label: { key: 'Label', namespaces: ['blueprint_blueprint0'] },
						description: { key: 'Description', args: { a: 1 }, namespaces: ['blueprint_blueprint0'] },
						triggerLabel: { key: 'Trigger', namespaces: ['blueprint_blueprint0'] },
						_rank: 5,
						tags: ['a'],
					},
				},
			})
			expect(warnSpy).not.toHaveBeenCalled()
		})

		it('drops invalid display overrides, and anything outside of the display', () => {
			const action = {
				branding: {
					branding0: {
						display: { label: 'not a message', _rank: 'first', tags: [1], hidden: true },
						actionId: 'other',
					},
					branding1: {
						display: { label: { key: 'Label' } },
					},
				} as any,
			}

			sanitiseActionBrandingFromBlueprint(action, blueprintId, 'AdLib Action')

			expect(action.branding).toEqual({
				branding1: { display: { label: { key: 'Label', namespaces: ['blueprint_blueprint0'] } } },
			})
			expect(warnSpy).toHaveBeenCalledTimes(5)
		})
	})
})
