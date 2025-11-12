import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import {
	AdLibActionId,
	PartId,
	PartInstanceId,
	PieceId,
	RundownId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { Tracker } from 'meteor/tracker'
import { Pieces, Segments } from '../../collections/index.js'
import { UIParts } from '../Collections.js'

interface RundownElement {
	type: 'rundown'
	elementId: RundownId
}

interface SegmentElement {
	type: 'segment'
	elementId: SegmentId
}

interface PartElement {
	type: 'part'
	elementId: PartId
}

interface PartInstanceElement {
	type: 'partInstance'
	elementId: PartInstanceId
}

interface PieceElement {
	type: 'piece'
	elementId: PieceId
}

interface AdlibActionElement {
	type: 'adlibAction'
	elementId: AdLibActionId
}

// Union types for all possible elements
export type SelectedElement =
	| RundownElement
	| SegmentElement
	| PartElement
	| PartInstanceElement
	| PieceElement
	| AdlibActionElement
type ElementId = SelectedElement['elementId']

export interface SelectionContextType {
	isSelected: (elementId: ElementId) => boolean
	listSelectedElements: () => SelectedElement[]
	clearAndSetSelection: (element: SelectedElement) => void
	toggleSelection: (element: SelectedElement) => void
	addSelection: (element: SelectedElement) => void
	removeSelection: (elementId: ElementId) => void
	clearSelections: () => void
	getSelectedCount: () => number
}

type SelectionAction =
	| { type: 'CLEAR_AND_SET_SELECTION'; payload: SelectedElement }
	| { type: 'TOGGLE_SELECTION'; payload: SelectedElement }
	| { type: 'ADD_SELECTION'; payload: SelectedElement }
	| { type: 'REMOVE_SELECTION'; payload: ElementId }
	| { type: 'CLEAR_SELECTIONS' }

// Reducer function
const selectionReducer = (
	state: Map<ElementId, SelectedElement>,
	action: SelectionAction,
	maxSelections: number
): Map<ElementId, SelectedElement> => {
	switch (action.type) {
		case 'CLEAR_AND_SET_SELECTION': {
			const newMap = new Map([[action.payload.elementId, action.payload]])
			return newMap
		}
		case 'TOGGLE_SELECTION': {
			const next = new Map(state)
			if (next.has(action.payload.elementId)) {
				next.delete(action.payload.elementId)
			} else if (next.size < maxSelections) {
				next.set(action.payload.elementId, action.payload)
			}
			return next
		}
		case 'ADD_SELECTION': {
			if (state.size >= maxSelections) return state
			const next = new Map(state)
			next.set(action.payload.elementId, action.payload)
			return next
		}
		case 'REMOVE_SELECTION': {
			const next = new Map(state)
			next.delete(action.payload)
			return next
		}
		case 'CLEAR_SELECTIONS': {
			return new Map()
		}
		default:
			assertNever(action)
			return state
	}
}

const defaultSelectionContext: SelectionContextType = {
	isSelected: () => false,
	listSelectedElements: () => [],
	clearAndSetSelection: () => {
		throw new Error('Method "clearAndSetSelection" not implemented on default SelectedElementsContext')
	},
	toggleSelection: () => {
		throw new Error('Method "toggleSelection" not implemented on default SelectedElementsContext')
	},
	addSelection: () => {
		throw new Error('Method "addSelection" not implemented on default SelectedElementsContext')
	},
	removeSelection: () => {
		throw new Error('Method "removeSelection" not implemented on default SelectedElementsContext')
	},
	clearSelections: () => {
		throw new Error('Method "clearSelections" not implemented on default SelectedElementsContext')
	},
	getSelectedCount: () => 0,
}

export const SelectedElementsContext = createContext<SelectionContextType>(defaultSelectionContext)

export const SelectedElementProvider: React.FC<{
	children: React.ReactNode
	maxSelections?: number // Optional prop to limit maximum selections
}> = ({ children, maxSelections = 10 }) => {
	const [selectedElements, dispatch] = useReducer(
		(state: Map<ElementId, SelectedElement>, action: SelectionAction) => selectionReducer(state, action, maxSelections),
		new Map()
	)

	const value = useMemo(
		() => ({
			isSelected: (elementId: ElementId) => {
				return selectedElements.has(elementId)
			},

			listSelectedElements: () => {
				return Array.from(selectedElements.values())
			},

			clearAndSetSelection: (element: SelectedElement) => {
				dispatch({ type: 'CLEAR_AND_SET_SELECTION', payload: element })
			},

			toggleSelection: (element: SelectedElement) => {
				dispatch({ type: 'TOGGLE_SELECTION', payload: element })
			},

			addSelection: (element: SelectedElement) => {
				dispatch({ type: 'ADD_SELECTION', payload: element })
			},

			removeSelection: (elementId: ElementId) => {
				dispatch({ type: 'REMOVE_SELECTION', payload: elementId })
			},

			clearSelections: () => {
				dispatch({ type: 'CLEAR_SELECTIONS' })
			},
			getSelectedCount: () => {
				return selectedElements.size
			},
		}),
		[selectedElements, maxSelections]
	)

	return <SelectedElementsContext.Provider value={value}>{children}</SelectedElementsContext.Provider>
}

// Custom hook for using the selection context
export const useSelectedElementsContext = (): SelectionContextType => {
	const context = useContext(SelectedElementsContext)

	return context
}

// Helper hook for common selection patterns
export const useElementSelection = (element: SelectedElement): { isSelected: boolean; toggleSelection: () => void } => {
	const { isSelected, toggleSelection } = useSelectedElementsContext()

	return {
		isSelected: useMemo(() => isSelected(element.elementId), [isSelected, element.elementId]),
		toggleSelection: useCallback(() => toggleSelection(element), [toggleSelection, element]),
	}
}

export function useSelectedElements(
	selectedElement: SelectedElement,
	clearPendingChange: () => void
): {
	piece: Piece | undefined
	part: DBPart | undefined
	segment: DBSegment | undefined
	rundownId: RundownId | undefined
} {
	const [piece, setPiece] = useState<Piece | undefined>(undefined)
	const [part, setPart] = useState<DBPart | undefined>(undefined)
	const [segment, setSegment] = useState<DBSegment | undefined>(undefined)
	const rundownId = piece ? piece.startRundownId : part ? part.rundownId : segment?.rundownId

	useEffect(() => {
		clearPendingChange() // element id changed so any pending change is for an old element

		const computation = Tracker.nonreactive(() =>
			Tracker.autorun(() => {
				const piece = Pieces.findOne(selectedElement?.elementId)
				const part = UIParts.findOne({ _id: piece?.startPartId ?? selectedElement?.elementId })
				const segment = Segments.findOne({ _id: part ? part.segmentId : selectedElement?.elementId })

				setPiece(piece)
				setPart(part)
				setSegment(segment)
			})
		)

		return () => computation.stop()
	}, [selectedElement?.elementId])

	return {
		piece,
		part,
		segment,
		rundownId,
	}
}
