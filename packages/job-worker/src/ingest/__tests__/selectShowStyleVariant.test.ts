/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ExtendedIngestRundown, IBlueprintShowStyleBase } from '@sofie-automation/blueprints-integration'
import '../../__mocks__/_extendJest.js'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { selectShowStyleVariant } from '../selectShowStyleVariant.js'
import { StudioUserContext } from '../../blueprints/context/index.js'
import { setupMockShowStyleCompound, setupMockShowStyleVariant } from '../../__mocks__/presetCollections.js'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'

describe('selectShowStyleVariant', () => {
	function generateIngestRundown(): ExtendedIngestRundown {
		return {
			externalId: 'rd0',
			name: 'Rundown',
			type: 'mock',
			segments: [],
			coreData: undefined,
			userEditStates: {},
			payload: undefined,
		}
	}
	function createBlueprintContext(context: MockJobContext): StudioUserContext {
		return new StudioUserContext(
			{
				name: 'test',
				identifier: 'test',
			},
			context.studio,
			context.getStudioBlueprintConfig()
		)
	}

	describe('rundown source: testing', () => {
		test('success', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)
			context.setStudio({
				...context.rawStudio,
				supportedShowStyleBase: [showStyleCompound._id],
			})

			const ingestRundown = generateIngestRundown()
			const blueprintContext = createBlueprintContext(context)

			const selectedShowStyle = await selectShowStyleVariant(context, blueprintContext, ingestRundown, {
				type: 'testing',
				showStyleVariantId: showStyleCompound.showStyleVariantId,
			})

			expect(selectedShowStyle).toBeTruthy()
			expect(selectedShowStyle!.variant._id).toEqual(showStyleCompound.showStyleVariantId)
			expect(selectedShowStyle!.base._id).toEqual(showStyleCompound._id)
			expect(selectedShowStyle!.compound).toEqual(showStyleCompound)
		})

		test('none defined for studio', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)
			context.setStudio({
				...context.rawStudio,
				supportedShowStyleBase: [],
			})

			const ingestRundown = generateIngestRundown()
			const blueprintContext = createBlueprintContext(context)

			const selectedShowStyle = await selectShowStyleVariant(context, blueprintContext, ingestRundown, {
				type: 'testing',
				showStyleVariantId: showStyleCompound.showStyleVariantId,
			})

			expect(selectedShowStyle).toBeNull()
		})

		test('unknown id', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)
			context.setStudio({
				...context.rawStudio,
				supportedShowStyleBase: [showStyleCompound._id],
			})

			const ingestRundown = generateIngestRundown()
			const blueprintContext = createBlueprintContext(context)

			const selectedShowStyle = await selectShowStyleVariant(context, blueprintContext, ingestRundown, {
				type: 'testing',
				showStyleVariantId: protectString('fakeId'),
			})

			expect(selectedShowStyle).toBeNull()
		})
	})

	describe('through blueprints', () => {
		function mockBlueprintMethods(context: MockJobContext) {
			const mockGetShowStyleId = jest.fn(context.rawStudioBlueprint.getShowStyleId)
			context.setStudioBlueprint({
				...context.studioBlueprint.blueprint,
				getShowStyleId: mockGetShowStyleId,
			})

			const mockGetShowStyleVariantId = jest.fn(context.rawShowStyleBlueprint.getShowStyleVariantId)
			context.setShowStyleBlueprint({
				...context.rawShowStyleBlueprint,
				getShowStyleVariantId: mockGetShowStyleVariantId,
			})

			return {
				mockGetShowStyleId,
				mockGetShowStyleVariantId,
			}
		}

		test('success', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)
			const showStyleCompoundVariant2 = await setupMockShowStyleVariant(context, showStyleCompound._id)
			const showStyleCompound2 = await setupMockShowStyleCompound(context)
			context.setStudio({
				...context.rawStudio,
				supportedShowStyleBase: [showStyleCompound._id, showStyleCompound2._id],
			})

			const { mockGetShowStyleId, mockGetShowStyleVariantId } = mockBlueprintMethods(context)

			const ingestRundown = generateIngestRundown()
			const blueprintContext = createBlueprintContext(context)

			const selectedShowStyle = await selectShowStyleVariant(context, blueprintContext, ingestRundown, {
				type: 'http',
			})

			expect(selectedShowStyle).toBeTruthy()
			expect(selectedShowStyle!.variant._id).toEqual(showStyleCompound.showStyleVariantId)
			expect(selectedShowStyle!.base._id).toEqual(showStyleCompound._id)
			expect(selectedShowStyle!.compound).toEqual(showStyleCompound)

			expect(mockGetShowStyleId).toHaveBeenCalledTimes(1)
			expect(mockGetShowStyleId.mock.calls[0][1]).toMatchObject<Partial<IBlueprintShowStyleBase>[]>([
				{ _id: unprotectString(showStyleCompound._id) },
				{ _id: unprotectString(showStyleCompound2._id) },
			])
			expect(mockGetShowStyleId.mock.calls[0][2]).toEqual(ingestRundown)
			expect(mockGetShowStyleVariantId).toHaveBeenCalledTimes(1)
			expect(mockGetShowStyleVariantId.mock.calls[0][1]).toMatchObject<Partial<IBlueprintShowStyleBase>[]>([
				{ _id: unprotectString(showStyleCompound.showStyleVariantId) },
				{ _id: unprotectString(showStyleCompoundVariant2._id) },
			])
			expect(mockGetShowStyleVariantId.mock.calls[0][2]).toEqual(ingestRundown)
		})

		test('no show style bases', async () => {
			const context = setupDefaultJobEnvironment()
			context.setStudio({
				...context.rawStudio,
				supportedShowStyleBase: [protectString('fakeId')],
			})

			const { mockGetShowStyleId, mockGetShowStyleVariantId } = mockBlueprintMethods(context)

			const ingestRundown = generateIngestRundown()
			const blueprintContext = createBlueprintContext(context)

			const selectedShowStyle = await selectShowStyleVariant(context, blueprintContext, ingestRundown, {
				type: 'http',
			})

			expect(selectedShowStyle).toBeNull()

			expect(mockGetShowStyleId).toHaveBeenCalledTimes(0)
			expect(mockGetShowStyleVariantId).toHaveBeenCalledTimes(0)
		})

		test('blueprint returns unknown base id', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)
			context.setStudio({
				...context.rawStudio,
				supportedShowStyleBase: [showStyleCompound._id],
			})

			const { mockGetShowStyleId, mockGetShowStyleVariantId } = mockBlueprintMethods(context)

			const ingestRundown = generateIngestRundown()
			const blueprintContext = createBlueprintContext(context)

			mockGetShowStyleId.mockImplementation(() => 'badId')

			const selectedShowStyle = await selectShowStyleVariant(context, blueprintContext, ingestRundown, {
				type: 'http',
			})

			expect(selectedShowStyle).toBeNull()

			expect(mockGetShowStyleId).toHaveBeenCalledTimes(1)
			expect(mockGetShowStyleVariantId).toHaveBeenCalledTimes(0)
		})

		test('blueprint returns null for base id', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)
			context.setStudio({
				...context.rawStudio,
				supportedShowStyleBase: [showStyleCompound._id],
			})

			const { mockGetShowStyleId, mockGetShowStyleVariantId } = mockBlueprintMethods(context)

			const ingestRundown = generateIngestRundown()
			const blueprintContext = createBlueprintContext(context)

			mockGetShowStyleId.mockImplementation(() => null)

			const selectedShowStyle = await selectShowStyleVariant(context, blueprintContext, ingestRundown, {
				type: 'http',
			})

			expect(selectedShowStyle).toBeNull()

			expect(mockGetShowStyleId).toHaveBeenCalledTimes(1)
			expect(mockGetShowStyleVariantId).toHaveBeenCalledTimes(0)
		})

		test('blueprint returns unknown variant id', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)
			context.setStudio({
				...context.rawStudio,
				supportedShowStyleBase: [showStyleCompound._id],
			})

			const { mockGetShowStyleId, mockGetShowStyleVariantId } = mockBlueprintMethods(context)

			const ingestRundown = generateIngestRundown()
			const blueprintContext = createBlueprintContext(context)

			mockGetShowStyleVariantId.mockImplementation(() => 'badId')

			const selectedShowStyle = await selectShowStyleVariant(context, blueprintContext, ingestRundown, {
				type: 'http',
			})

			expect(selectedShowStyle).toBeNull()

			expect(mockGetShowStyleId).toHaveBeenCalledTimes(1)
			expect(mockGetShowStyleVariantId).toHaveBeenCalledTimes(1)
		})

		test('blueprint returns null for variant id', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)
			context.setStudio({
				...context.rawStudio,
				supportedShowStyleBase: [showStyleCompound._id],
			})

			const { mockGetShowStyleId, mockGetShowStyleVariantId } = mockBlueprintMethods(context)

			const ingestRundown = generateIngestRundown()
			const blueprintContext = createBlueprintContext(context)

			mockGetShowStyleVariantId.mockImplementation(() => null)

			const selectedShowStyle = await selectShowStyleVariant(context, blueprintContext, ingestRundown, {
				type: 'http',
			})

			expect(selectedShowStyle).toBeNull()

			expect(mockGetShowStyleId).toHaveBeenCalledTimes(1)
			expect(mockGetShowStyleVariantId).toHaveBeenCalledTimes(1)
		})
	})
})
