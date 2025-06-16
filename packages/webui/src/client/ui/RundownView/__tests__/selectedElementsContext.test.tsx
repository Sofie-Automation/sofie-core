import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { SelectedElementProvider, useSelectedElementsContext, useElementSelection } from '../SelectedElementsContext.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { RundownId, SegmentId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

describe('SelectedElementProvider', () => {
	const createRundownElement = (id: string) => ({
		type: 'rundown' as const,
		elementId: protectString<RundownId>(id),
	})

	const createSegmentElement = (id: string) => ({
		type: 'segment' as const,
		elementId: protectString<SegmentId>(id),
	})

	const createPartInstanceElement = (id: string) => ({
		type: 'partInstance' as const,
		elementId: protectString<PartInstanceId>(id),
	})

	describe('useSelection hook', () => {
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<SelectedElementProvider>{children}</SelectedElementProvider>
		)

		test('init with no selections', () => {
			const { result } = renderHook(() => useSelectedElementsContext(), { wrapper })

			expect(result.current.listSelectedElements().length).toBe(0)
			expect(result.current.getSelectedCount()).toBe(0)
		})

		test('clearAndSetSelection', () => {
			const { result } = renderHook(() => useSelectedElementsContext(), { wrapper })
			const element1 = createRundownElement('rundown1')
			const element2 = createRundownElement('rundown2')

			act(() => {
				result.current.clearAndSetSelection(element1)
			})
			expect(result.current.listSelectedElements().length).toBe(1)
			expect(result.current.isSelected(element1.elementId)).toBe(true)

			act(() => {
				result.current.clearAndSetSelection(element2)
			})
			expect(result.current.listSelectedElements().length).toBe(1)
			expect(result.current.isSelected(element1.elementId)).toBe(false)
			expect(result.current.isSelected(element2.elementId)).toBe(true)
		})

		test('toggleSelection', () => {
			const { result } = renderHook(() => useSelectedElementsContext(), { wrapper })
			const element = createSegmentElement('segment1')

			act(() => {
				result.current.toggleSelection(element)
			})
			expect(result.current.isSelected(element.elementId)).toBe(true)

			act(() => {
				result.current.toggleSelection(element)
			})
			expect(result.current.isSelected(element.elementId)).toBe(false)
		})

		test('respect maxSelections limit', () => {
			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<SelectedElementProvider maxSelections={2}>{children}</SelectedElementProvider>
			)
			const { result } = renderHook(() => useSelectedElementsContext(), { wrapper })

			const elements = [
				createRundownElement('rundown1'),
				createRundownElement('rundown2'),
				createRundownElement('rundown3'),
			]

			act(() => {
				elements.forEach((element) => {
					result.current.addSelection(element)
				})
			})

			expect(result.current.getSelectedCount()).toBe(2)
			expect(result.current.isSelected(elements[0].elementId)).toBe(true)
			expect(result.current.isSelected(elements[1].elementId)).toBe(true)
			expect(result.current.isSelected(elements[2].elementId)).toBe(false)
		})

		test('clearSelections removes all selections', () => {
			const { result } = renderHook(() => useSelectedElementsContext(), { wrapper })

			act(() => {
				result.current.addSelection(createRundownElement('rundown1'))
				result.current.addSelection(createSegmentElement('segment1'))
			})
			expect(result.current.getSelectedCount()).toBe(2)

			act(() => {
				result.current.clearSelections()
			})
			expect(result.current.getSelectedCount()).toBe(0)
		})
	})

	describe('useElementSelection hook', () => {
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<SelectedElementProvider>{children}</SelectedElementProvider>
		)

		test('provide isSelected and toggleSelection for specific element', () => {
			const element = createPartInstanceElement('part1')
			const { result } = renderHook(() => useElementSelection(element), { wrapper })

			expect(result.current.isSelected).toBe(false)

			act(() => {
				result.current.toggleSelection()
			})
			expect(result.current.isSelected).toBe(true)

			act(() => {
				result.current.toggleSelection()
			})
			expect(result.current.isSelected).toBe(false)
		})
	})
})
