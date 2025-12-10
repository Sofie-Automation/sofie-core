import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { setupMockShowStyleCompound } from '../../__mocks__/presetCollections.js'
import { setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { preprocessStudioConfig, retrieveBlueprintConfigRefs } from '../config.js'
import { getShowStyleConfigRef, getStudioConfigRef } from '../configRefs.js'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { DEFAULT_MINIMUM_TAKE_SPAN } from '@sofie-automation/shared-lib/dist/core/constants'

describe('Test blueprint config', () => {
	test('compileStudioConfig', () => {
		const jobContext = setupDefaultJobEnvironment()
		jobContext.setStudio({
			...jobContext.rawStudio,
			settingsWithOverrides: wrapDefaultObject({
				mediaPreviewsUrl: '',
				frameRate: 25,
				minimumTakeSpan: DEFAULT_MINIMUM_TAKE_SPAN,
				allowHold: true,
				allowPieceDirectPlay: true,
				enableBuckets: true,
				enableEvaluationForm: true,
			}),
			blueprintConfigWithOverrides: wrapDefaultObject({ sdfsdf: 'one', another: 5 }),
		})
		jobContext.updateStudioBlueprint({
			studioConfigSchema: undefined,
		})

		const res = preprocessStudioConfig(jobContext.studio, jobContext.studioBlueprint.blueprint)
		expect(res).toEqual({
			// SofieHostURL: 'host url',
			sdfsdf: 'one',
			another: 5,
		})
	})

	test('compileStudioConfig with function', () => {
		const jobContext = setupDefaultJobEnvironment()
		jobContext.setStudio({
			...jobContext.rawStudio,
			settingsWithOverrides: wrapDefaultObject({
				mediaPreviewsUrl: '',
				frameRate: 25,
				minimumTakeSpan: DEFAULT_MINIMUM_TAKE_SPAN,
				allowHold: true,
				allowPieceDirectPlay: true,
				enableBuckets: true,
				enableEvaluationForm: true,
			}),
			blueprintConfigWithOverrides: wrapDefaultObject({ sdfsdf: 'one', another: 5 }),
		})
		jobContext.updateStudioBlueprint({
			studioConfigSchema: undefined,
			preprocessConfig: (_context, config, coreConfig) => {
				return {
					studio: config,
					core: coreConfig,
				}
			},
		})

		const res = preprocessStudioConfig(jobContext.studio, jobContext.studioBlueprint.blueprint)
		expect(res).toEqual({
			core: {
				hostUrl: 'https://sofie-in-jest:3000',
				frameRate: 25,
				// Some settings are omitted here because we currently don't bother exposing them to blueprints.
			},
			studio: {
				sdfsdf: 'one',
				another: 5,
			},
		})
	})

	test('getStudioConfigRef', () => {
		expect(getStudioConfigRef(protectString('st0'), 'key0')).toEqual('${studio.st0.key0}')
	})
	test('getShowStyleConfigRef', () => {
		expect(getShowStyleConfigRef(protectString('var0'), 'key1')).toEqual('${showStyle.var0.key1}')
	})

	describe('retrieveRefs', () => {
		test('empty/invalid', async () => {
			const jobContext = setupDefaultJobEnvironment()

			expect(await retrieveBlueprintConfigRefs(jobContext, '')).toEqual('')
			expect(await retrieveBlueprintConfigRefs(jobContext, undefined as any)).toEqual(undefined)
			expect(await retrieveBlueprintConfigRefs(jobContext, null as any)).toEqual(null)
		})

		test('bad format', async () => {
			const jobContext = setupDefaultJobEnvironment()

			expect(await retrieveBlueprintConfigRefs(jobContext, '$(studio.one.two)')).toEqual('$(studio.one.two)')
			expect(await retrieveBlueprintConfigRefs(jobContext, 'abcd')).toEqual('abcd')
		})

		test('undefined - normal', async () => {
			const jobContext = setupDefaultJobEnvironment()

			const modifier = jest.fn((v) => v)

			expect(await retrieveBlueprintConfigRefs(jobContext, '${studio.one.two}_extra', modifier)).toEqual(
				'undefined_extra'
			)
			expect(await retrieveBlueprintConfigRefs(jobContext, '${showStyle.one.two}_extra', modifier)).toEqual(
				'undefined_extra'
			)

			expect(modifier).toHaveBeenCalledTimes(2)
		})
		test('undefined - bail', async () => {
			const jobContext = setupDefaultJobEnvironment()

			const modifier = jest.fn((v) => v)

			await expect(
				retrieveBlueprintConfigRefs(jobContext, '${studio.one.two}_extra', modifier, true)
			).rejects.toThrow(`Ref "\${studio.one.two}": Studio "one" not valid`)
			await expect(
				retrieveBlueprintConfigRefs(jobContext, '${showStyle.one.two}_extra', modifier, true)
			).rejects.toThrow(`Ref "\${showStyle.one.two}": Showstyle variant "one" not found`)

			expect(modifier).toHaveBeenCalledTimes(0)
		})
		test('undefined - modifier', async () => {
			const jobContext = setupDefaultJobEnvironment()

			const modifier = jest.fn(() => 'nope')

			expect(await retrieveBlueprintConfigRefs(jobContext, '${studio.one.two}_extra', modifier)).toEqual(
				'nope_extra'
			)
			expect(await retrieveBlueprintConfigRefs(jobContext, '${showStyle.one.two}_extra', modifier)).toEqual(
				'nope_extra'
			)

			expect(modifier).toHaveBeenCalledTimes(2)
		})

		test('studio with data', async () => {
			const jobContext = setupDefaultJobEnvironment()

			const studioId = jobContext.studioId
			jobContext.setStudio({
				...jobContext.rawStudio,
				blueprintConfigWithOverrides: wrapDefaultObject({
					two: 'abc',
					number: 99,
					bool: true,
					obj: [{ _id: '0', a: 1 }],
				}),
			})
			jobContext.updateStudioBlueprint({
				// Bypass running through configSchema
				studioConfigSchema: undefined,
			})

			expect(
				await retrieveBlueprintConfigRefs(
					jobContext,
					`\${studio.${studioId}.two} = \${studio.${studioId}.number}. Correct = \${studio.${studioId}.bool}`
				)
			).toEqual('abc = 99. Correct = true')
			expect(
				await retrieveBlueprintConfigRefs(
					jobContext,
					`\${studio.${studioId}.name} = \${studio.${studioId}.obj}`
				)
			).toEqual('undefined = [object Object]') // Not pretty, but expected
		})

		test('showstyle with data', async () => {
			const jobContext = setupDefaultJobEnvironment()

			const showStyle = await setupMockShowStyleCompound(jobContext)

			await jobContext.mockCollections.ShowStyleBases.update(showStyle._id, {
				$set: {
					blueprintConfigWithOverrides: wrapDefaultObject({ number: 56, bool: true }),
				},
			})
			await jobContext.mockCollections.ShowStyleVariants.update(showStyle.showStyleVariantId, {
				$set: {
					blueprintConfigWithOverrides: wrapDefaultObject({
						two: 'abc',
						number: 88,
						obj: [{ _id: '0', a: 1 }],
					}),
				},
			})
			jobContext.setStudio({
				...jobContext.rawStudio,
				supportedShowStyleBase: [showStyle._id],
			})
			jobContext.updateShowStyleBlueprint({
				// Bypass running through configSchema
				showStyleConfigSchema: undefined,
			})

			expect(
				await retrieveBlueprintConfigRefs(
					jobContext,
					`\${showStyle.${showStyle.showStyleVariantId}.two} = \${showStyle.${showStyle.showStyleVariantId}.number}. Correct = \${showStyle.${showStyle.showStyleVariantId}.bool}`
				)
			).toEqual('abc = 88. Correct = true')
			expect(
				await retrieveBlueprintConfigRefs(
					jobContext,
					`\${showStyle.${showStyle.showStyleVariantId}.name} = \${showStyle.${showStyle.showStyleVariantId}.obj}`
				)
			).toEqual('undefined = [object Object]') // Not pretty, but expected
		})
	})
})
