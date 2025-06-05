import { getHash } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { getShowStyleConfigRef, getStudioConfigRef } from '../configRefs.js'
import { CommonContext } from '../context/CommonContext.js'
import { StudioContext } from '../context/StudioContext.js'
import { ShowStyleContext } from '../context/ShowStyleContext.js'

describe('Test blueprint api context', () => {
	let jobContext: MockJobContext
	beforeAll(async () => {
		jobContext = setupDefaultJobEnvironment()
	})

	describe('CommonContext', () => {
		test('no param', () => {
			const context = new CommonContext({ name: 'name', identifier: 'pre' })

			const res = context.getHashId(undefined as any)
			expect(res).toEqual(getHash('pre_hash0'))
			expect(context.unhashId(res)).toEqual('hash0')
		})
		test('no param + notUnique', () => {
			const context = new CommonContext({ name: 'name', identifier: 'pre' })

			const res = context.getHashId(undefined as any, true)
			expect(res).toEqual(getHash('pre_hash0_1'))
			expect(context.unhashId(res)).toEqual('hash0_1')
		})
		test('empty param', () => {
			const context = new CommonContext({ name: 'name', identifier: 'pre' })

			const res = context.getHashId('')
			expect(res).toEqual(getHash('pre_hash0'))
			expect(context.unhashId(res)).toEqual('hash0')

			const res2 = context.getHashId('')
			expect(res2).toEqual(getHash('pre_hash1'))
			expect(context.unhashId(res2)).toEqual('hash1')

			expect(res2).not.toEqual(res)
		})
		test('string', () => {
			const context = new CommonContext({ name: 'name', identifier: 'pre' })

			const res = context.getHashId('something')
			expect(res).toEqual(getHash('pre_something'))
			expect(context.unhashId(res)).toEqual('something')

			const res2 = context.getHashId('something')
			expect(res2).toEqual(getHash('pre_something'))
			expect(context.unhashId(res2)).toEqual('something')

			expect(res2).toEqual(res)
		})
		test('string + notUnique', () => {
			const context = new CommonContext({ name: 'name', identifier: 'pre' })

			const res = context.getHashId('something', true)
			expect(res).toEqual(getHash('pre_something_0'))
			expect(context.unhashId(res)).toEqual('something_0')

			const res2 = context.getHashId('something', true)
			expect(res2).toEqual(getHash('pre_something_1'))
			expect(context.unhashId(res2)).toEqual('something_1')

			expect(res2).not.toEqual(res)
		})
	})

	describe('StudioContext', () => {
		test('getStudio', () => {
			const studio = jobContext.studio
			const studioConfig = jobContext.getStudioBlueprintConfig()
			const context = new StudioContext(
				{ name: 'studio', identifier: unprotectString(jobContext.studioId) },
				studio,
				studioConfig
			)

			expect(context.studio).toBe(studio)
			expect(context.getStudioConfig()).toBe(studioConfig)
			expect(context.getStudioMappings()).toEqual(studio.mappings)
		})
		test('getStudioConfigRef', () => {
			const context = new StudioContext(
				{ name: 'studio', identifier: unprotectString(jobContext.studioId) },
				jobContext.studio,
				jobContext.getStudioBlueprintConfig()
			)

			expect(context.getStudioConfigRef('conf1')).toEqual(getStudioConfigRef(jobContext.studioId, 'conf1'))
		})
	})

	describe('ShowStyleContext', () => {
		test('getShowStyleConfig', async () => {
			const showStyleCompound = 'fakeShowstyle' as any
			const showStyleConfig = 'fakeConfig' as any

			const context = new ShowStyleContext(
				{
					name: 'N/A',
					identifier: `fake context`,
				},
				jobContext.studio,
				jobContext.getStudioBlueprintConfig(),
				showStyleCompound,
				showStyleConfig
			)

			expect(context.getShowStyleConfig()).toBe(showStyleConfig)
			expect(context.showStyleCompound).toBe(showStyleCompound)
		})

		test('getShowStyleConfigRef', () => {
			const context = new ShowStyleContext(
				{
					name: 'N/A',
					identifier: `fake context`,
				},
				jobContext.studio,
				jobContext.getStudioBlueprintConfig(),
				'1' as any,
				'2' as any
			)

			expect(context.getShowStyleConfigRef('conf1')).toEqual(
				getShowStyleConfigRef(context.showStyleCompound.showStyleVariantId, 'conf1')
			)
		})
	})

	describe('SegmentUserContext', () => {
		// TODO?
	})
})
