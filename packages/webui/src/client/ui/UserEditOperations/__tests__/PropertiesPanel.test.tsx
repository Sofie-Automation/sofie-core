import { describe, test, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { renderHook, act, render, screen, waitFor, type RenderOptions } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MeteorCall } from '../../../lib/meteorApi.js'
import type { TFunction } from 'i18next'

import userEvent from '@testing-library/user-event'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { UIParts } from '../../Collections.js'
import { AdLibActions, Segments } from '../../../../client/collections/index.js'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { UserEditingType } from '@sofie-automation/blueprints-integration'
import {
	SelectedElementProvider,
	SelectedElementsContext,
	type SelectionContextType,
	useSelectedElementsContext,
} from '../../RundownView/SelectedElementsContext.js'
import { MongoMock } from '../../../../__mocks__/mongo.js'
import { PropertiesPanel } from '../PropertiesPanel.js'
import type { UserAction } from '../../../lib/clientUserAction.js'
import type { AdLibAction } from '@sofie-automation/corelib/src/dataModel/AdlibAction.js'

vi.mock('meteor/tracker', async () => (await import('../../../../__mocks__/tracker.js')).setup())

vi.mock('react-i18next', () => ({
	// this mock makes sure any components using the translate hook can use it without a warning being shown
	useTranslation: () => {
		return {
			t: (str: string) => str,
			i18n: {
				changeLanguage: () =>
					new Promise(() => {
						// satisfy linter - by making it uglier? ¯\_(ツ)_/¯
					}),
			},
		}
	},
	initReactI18next: {
		type: '3rdParty',
		init: () => {
			// satisfy linter - by making it uglier? ¯\_(ツ)_/¯
		},
	},
}))

// Mock the ReactiveDataHelper:
vi.mock('../../../lib/reactiveData/reactiveDataHelper', () => {
	interface MockSubscription {
		stop: () => void
		ready: () => boolean
	}

	class MockReactiveDataHelper {
		protected _subs: MockSubscription[] = []
		protected _computations: any[] = []

		protected subscribe(_name: string, ..._args: any[]): MockSubscription {
			const sub: MockSubscription = {
				stop: vi.fn(),
				ready: vi.fn().mockReturnValue(true),
			}
			this._subs.push(sub)
			return sub
		}

		protected autorun(f: () => void) {
			// Execute the function immediately
			f()
			const computation = {
				stop: vi.fn(),
				_recompute: () => f(),
				invalidate: function () {
					this._recompute()
				},
				onInvalidate: vi.fn(),
			}
			this._computations.push(computation)
			return computation
		}

		destroy() {
			this._subs.forEach((sub) => sub.stop())
			this._computations.forEach((comp) => comp.stop())
			this._subs = []
			this._computations = []
		}
	}

	class MockWithManagedTracker extends MockReactiveDataHelper {
		constructor() {
			super()
		}

		triggerUpdate() {
			this._computations.forEach((comp) => comp.invalidate())
		}
	}

	return {
		__esModule: true,
		WithManagedTracker: MockWithManagedTracker,
		meteorSubscribe: vi.fn().mockReturnValue({
			stop: vi.fn(),
			ready: vi.fn().mockReturnValue(true),
		}),
	}
})

vi.mock('i18next', () => ({
	use: vi.fn().mockReturnThis(),
	init: vi.fn().mockImplementation(() => Promise.resolve()),
	t: (key: string) => key,
	changeLanguage: vi.fn().mockImplementation(() => Promise.resolve()),
	language: 'en',
	exists: vi.fn(),
	on: vi.fn(),
	off: vi.fn(),
	options: {},
}))

// React-i18next with Promise support
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: {
			changeLanguage: vi.fn().mockImplementation(() => Promise.resolve()),
			language: 'en',
			exists: vi.fn(),
			use: vi.fn().mockReturnThis(),
			init: vi.fn().mockImplementation(() => Promise.resolve()),
			on: vi.fn(),
			off: vi.fn(),
			options: {},
		},
	}),
	initReactI18next: {
		type: '3rdParty',
		init: vi.fn(),
	},
}))

global.fetch = vi.fn(() =>
	Promise.resolve({
		ok: true,
		status: 200,
		headers: new Map([['content-type', 'image/svg']]),
		text: () => Promise.resolve('<svg></svg>'),
	})
) as Mock

const mockSegmentsCollection = MongoMock.getInnerMockCollection(Segments)
const mockPartsCollection = MongoMock.getInnerMockCollection(UIParts)
const mockAdlibActionsCollection = MongoMock.getInnerMockCollection(AdLibActions)

// Mock Client User Action:
vi.mock('../../../lib/clientUserAction', () => ({
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	doUserAction: vi.fn((_t: TFunction, e: unknown, _action: UserAction, callback: Function) => callback(e, Date.now())),
	UserAction: {
		EXECUTE_USER_OPERATION: 51,
	},
}))

// Mock Userchange Operation:
vi.mock('../../../lib/meteorApi', () => ({
	__esModule: true,
	MeteorCall: {
		userAction: {
			executeUserChangeOperation: vi.fn(),
		},
	},
}))

// Mock SchemaFormInPlace Component
vi.mock('../../../lib/forms/SchemaFormInPlace', () => ({
	SchemaFormInPlace: () => <div data-testid="schema-form">Schema Form</div>,
}))
vi.mock('../../../lib/forms/SchemaFormWithState', () => ({
	SchemaFormWithState: () => <div data-testid="schema-form">Schema Form</div>,
}))

describe('PropertiesPanel', () => {
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<SelectedElementProvider>{children}</SelectedElementProvider>
	)

	const renderWithContext = (
		ui: React.ReactNode,
		{ ctxValue, ...renderOptions }: RenderOptions & { ctxValue: SelectionContextType }
	) => {
		return render(
			<SelectedElementsContext.Provider value={ctxValue}>{ui}</SelectedElementsContext.Provider>,
			renderOptions
		)
	}

	beforeEach(() => {
		mockSegmentsCollection.remove({})
		mockPartsCollection.remove({})
		vi.clearAllMocks()
		// vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	const createMockSegment = (id: string): DBSegment => ({
		_id: protectString(id),
		_rank: 1,
		name: `Segment ${id}`,
		rundownId: protectString('rundown1'),
		externalId: `ext_${id}`,
		userEditOperations: [
			{
				id: 'operation1',
				label: { key: 'TEST_LABEL', namespaces: ['blueprint_main-showstyle'] },
				type: UserEditingType.ACTION,
				isActive: false,
				icon: 'test-op-operation1.svg',
			},
		],
		userEditProperties: {
			operations: [
				{
					id: 'operation1',
					label: { key: 'TEST_LABEL', namespaces: ['blueprint_main-showstyle'] },
					type: UserEditingType.ACTION,
					isActive: false,
					icon: 'test-prop-operation1.svg',
				},
			],
			translationNamespaces: ['blueprint_main-showstyle'],
		},
		isHidden: false,
	})

	const createMockPart = (id: string, segmentId: string): DBPart => ({
		_id: protectString(id),
		_rank: 1,
		expectedDurationWithTransition: 0,
		title: `Part ${id}`,
		rundownId: protectString('rundown1'),
		segmentId: protectString(segmentId),
		externalId: `ext_${id}`,
		userEditOperations: [
			{
				id: 'operation2',
				label: { key: 'TEST_PART_LABEL', namespaces: ['blueprint_main-showstyle'] },
				type: UserEditingType.ACTION,
				isActive: true,
			},
		],
	})

	const createMockAdLibAction = (id: string, partId: string): AdLibAction => ({
		_id: protectString(id),
		rundownId: protectString('rundown1'),
		actionId: 'test',
		display: {
			label: 'test' as any,
			_rank: 1,
		},
		partId: protectString(partId),
		userData: {},
		userDataManifest: {},
		externalId: `ext_${id}`,
		userEditOperations: [
			{
				id: 'operation3',
				label: { key: 'TEST_ADLIB_LABEL', namespaces: ['blueprint_main-showstyle'] },
				type: UserEditingType.ACTION,
				isActive: true,
			},
		],
		userEditProperties: {
			operations: [
				{
					id: 'operation1',
					label: { key: 'TEST_LABEL', namespaces: ['blueprint_main-showstyle'] },
					type: UserEditingType.ACTION,
					isActive: false,
					icon: 'test-prop-operation1.svg',
				},
			],
			translationNamespaces: ['blueprint_main-showstyle'],
		},
	})

	test('renders empty when no element selected', () => {
		const { container } = render(<PropertiesPanel />, { wrapper })
		expect(container.querySelector('.properties-panel')).toBeTruthy()
		expect(container.querySelector('.properties-panel-pop-up__form')).toBeFalsy()
	})

	test('renders segment properties when segment is selected', async () => {
		const mockSegment = createMockSegment('segment1')

		const mockId = mockSegmentsCollection.insert(mockSegment)
		const protectedMockId = protectString(mockId)

		const verifySegment = mockSegmentsCollection.findOne({ _id: protectedMockId })
		expect(verifySegment).toBeTruthy()
		expect(mockSegmentsCollection.findOne({ _id: protectedMockId })).toBeTruthy()

		const { result } = renderHook(() => useSelectedElementsContext(), { wrapper })

		// Update selection and wait for component to update
		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'segment',
				elementId: protectedMockId,
			})
		})

		expect(result.current.listSelectedElements()).toHaveLength(1)
		expect(result.current.listSelectedElements()).toEqual([{ type: 'segment', elementId: mockId }])

		// Open component after segment is selected (as used in rundownview)
		const { container } = renderWithContext(<PropertiesPanel />, { ctxValue: result.current })

		expect(screen.getByText(`${mockSegment.name.slice(0, 30)}`)).toBeInTheDocument()

		const button = container.querySelector('.propertiespanel-pop-up__button')
		expect(button).toBeInTheDocument()
	})

	test('renders part properties when part is selected', async () => {
		const mockSegment = createMockSegment('segment1')
		const mockPart = createMockPart('part1', String(mockSegment._id))

		mockSegmentsCollection.insert(mockSegment)
		const mockId = mockPartsCollection.insert(mockPart)

		const { result } = renderHook(() => useSelectedElementsContext(), { wrapper })

		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'part',
				elementId: protectString(mockId),
			})
		})
		// Open component after part is selected (as used in rundownview)
		const { container } = renderWithContext(<PropertiesPanel />, { ctxValue: result.current })

		await waitFor(
			() => {
				expect(screen.getByText(mockPart.title.slice(0, 30))).toBeInTheDocument()
			},
			{ timeout: 1000 }
		)

		const button = container.querySelector('.propertiespanel-pop-up__button')
		expect(button).toBeInTheDocument()
	})

	test('renders adlib action properties when adlib action is selected', async () => {
		const mockSegment = createMockSegment('segment1')
		const mockPart = createMockPart('part1', String(mockSegment._id))
		const mockAdlib = createMockAdLibAction('adlib1', String(mockPart._id))

		mockSegmentsCollection.insert(mockSegment)
		mockPartsCollection.insert(mockPart)
		const mockId = mockAdlibActionsCollection.insert(mockAdlib)

		const { result } = renderHook(() => useSelectedElementsContext(), { wrapper })

		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'adLibAction',
				elementId: protectString(mockId),
			})
		})
		// Open component after part is selected (as used in rundownview)
		const { container } = renderWithContext(<PropertiesPanel />, { ctxValue: result.current })

		await waitFor(
			() => {
				expect(screen.getByText((mockAdlib.display.label as string).slice(0, 30))).toBeInTheDocument()
			},
			{ timeout: 1000 }
		)

		const button = container.querySelector('.propertiespanel-pop-up__button')
		expect(button).toBeInTheDocument()
	})

	test('handles user edit operations for segments', async () => {
		const mockSegment = createMockSegment('segment1')
		mockSegmentsCollection.insert(mockSegment)

		const { result } = renderHook(() => useSelectedElementsContext(), { wrapper })

		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'segment',
				elementId: mockSegment._id,
			})
		})

		// Wait for the switch button to be available
		renderWithContext(<PropertiesPanel />, { ctxValue: result.current })
		const switchButton = await waitFor(() => screen.getByText('TEST_LABEL'))
		expect(switchButton).toBeTruthy()

		if (!switchButton) return // above would have thrown - this is a type guard

		// Toggle the switch
		await userEvent.click(switchButton)

		// Check if commit button is enabled
		const commitButton = screen.getByText('Save')
		expect(commitButton).toBeEnabled()

		// Commit changes
		await act(async () => {
			await userEvent.click(commitButton)
		})

		expect(MeteorCall.userAction.executeUserChangeOperation).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			protectString('rundown1'),
			{
				target: 'segment',
				segmentExternalId: mockSegment.externalId,
			},
			{
				id: 'operation1',
				values: undefined,
			}
		)
	})

	test('handles revert changes', async () => {
		const mockSegment = createMockSegment('segment1')
		mockSegmentsCollection.insert(mockSegment)

		const { result } = renderHook(() => useSelectedElementsContext(), { wrapper })

		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'segment',
				elementId: mockSegment._id,
			})
		})

		const { container } = renderWithContext(<PropertiesPanel />, { ctxValue: result.current })

		// Wait for the switch button to be available
		const switchButton = await waitFor(() => container.querySelector('.propertiespanel-pop-up__switchbutton'))

		// Make a change
		await act(async () => {
			await userEvent.click(switchButton!)
		})

		// Click revert button
		const revertButton = screen.getByText('Restore Segment from NRCS')
		await act(async () => {
			await userEvent.click(revertButton)
		})

		expect(MeteorCall.userAction.executeUserChangeOperation).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			protectString('rundown1'),
			{
				target: 'segment',
				segmentExternalId: mockSegment.externalId,
			},
			{
				id: '__sofie-revert-segment',
			}
		)
	})

	test('closes panel when close button is clicked', async () => {
		const mockSegment = createMockSegment('segment1')
		mockSegmentsCollection.insert(mockSegment)

		const { result } = renderHook(() => useSelectedElementsContext(), { wrapper })
		const { container } = render(<PropertiesPanel />, { wrapper })

		await act(async () => {
			result.current.clearAndSetSelection({
				type: 'segment',
				elementId: mockSegment._id,
			})
		})

		const closeButton = await waitFor(() => container.querySelector('.propertiespanel-pop-up_close'))
		expect(closeButton).toBeTruthy()

		await act(async () => {
			await userEvent.click(closeButton!)
		})

		// expect(container.querySelector('.propertiespanel-pop-up__contents')).toBeFalsy()
		expect(container.querySelector('.properties-panel-pop-up__form')).toBeFalsy()
	})
})
