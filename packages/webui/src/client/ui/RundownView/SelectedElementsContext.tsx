import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type {
	AdLibActionId,
	PartId,
	PartInstanceId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import type { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import type { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import type { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { Tracker } from 'meteor/tracker'
import {
	AdLibActions,
	AdLibPieces,
	Pieces,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	Segments,
} from '../../collections/index.js'
import { UIParts } from '../Collections.js'
import type {
	CoreUserEditingDefinition,
	CoreUserEditingProperties,
} from '@sofie-automation/corelib/dist/dataModel/UserEditingDefinitions.js'
import type { ITranslatableMessage } from '@sofie-automation/shared-lib/dist/lib/translations.js'

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

interface AdlibPieceElement {
	type: 'adLibPiece'
	elementId: PieceId
}

interface RundownBaselineAdLibPieceElement {
	type: 'rundownBaselineAdLibPiece'
	elementId: PieceId
}

interface AdlibActionElement {
	type: 'adLibAction'
	elementId: AdLibActionId
}

interface RundownBaselineAdLibActionElement {
	type: 'rundownBaselineAdLibAction'
	elementId: RundownBaselineAdLibActionId
}

// Union types for all possible elements
export type SelectedElement =
	| RundownElement
	| SegmentElement
	| PartElement
	| PartInstanceElement
	| PieceElement
	| AdlibPieceElement
	| RundownBaselineAdLibPieceElement
	| AdlibActionElement
	| RundownBaselineAdLibActionElement
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

type LastValidSmallestElementRef =
	| {
			type: 'piece'
			elementId: PieceId
			element: Piece
	  }
	| {
			type: 'adLibPiece'
			elementId: PieceId
			element: AdLibPiece
	  }
	| {
			type: 'rundownBaselineAdLibPiece'
			elementId: PieceId
			element: AdLibPiece
	  }
	| {
			type: 'adLibAction'
			elementId: AdLibActionId
			element: AdLibAction
	  }
	| {
			type: 'rundownBaselineAdLibAction'
			elementId: RundownBaselineAdLibActionId
			element: RundownBaselineAdLibAction
	  }

export type SelectedObjects = {
	piece: Piece | undefined
	adLibPiece: AdLibPiece | undefined
	rundownBaselineAdLibPiece: AdLibPiece | undefined
	adLibAction: AdLibAction | undefined
	rundownBaselineAdLibAction: RundownBaselineAdLibAction | undefined
	part: DBPart | undefined
	segment: DBSegment | undefined
}

export function useSelectedElements(
	selectedElement: SelectedElement,
	clearPendingChange: () => void
): {
	type: SelectedElement['type'] | undefined
	rundownId: RundownId | undefined
	selectedObjects: SelectedObjects
} {
	const [piece, setPiece] = useState<Piece | undefined>(undefined)
	const [adLibPiece, setAdLibPiece] = useState<AdLibPiece | undefined>(undefined)
	const [rundownBaselineAdLibPiece, setRundownBaselineAdLibPiece] = useState<AdLibPiece | undefined>(undefined)
	const [adLibAction, setAdLibAction] = useState<AdLibAction | undefined>(undefined)
	const [rundownBaselineAdLibAction, setRundownBaselineAdLibAction] = useState<RundownBaselineAdLibAction | undefined>(
		undefined
	)
	const [part, setPart] = useState<DBPart | undefined>(undefined)
	const [segment, setSegment] = useState<DBSegment | undefined>(undefined)
	const rundownId = rundownBaselineAdLibAction
		? rundownBaselineAdLibAction.rundownId
		: adLibAction
			? adLibAction.rundownId
			: rundownBaselineAdLibPiece
				? rundownBaselineAdLibPiece.rundownId
				: adLibPiece
					? adLibPiece.rundownId
					: piece
						? piece.startRundownId
						: part
							? part.rundownId
							: segment?.rundownId

	const lastValidSmallestElement = useRef<LastValidSmallestElementRef | undefined>(undefined)

	useEffect(() => {
		clearPendingChange() // element id changed so any pending change is for an old element

		const computation = Tracker.nonreactive(() =>
			Tracker.autorun(() => {
				const type = selectedElement?.type
				let piece = type === 'piece' ? Pieces.findOne(selectedElement?.elementId) : undefined
				let adLibPiece = type === 'adLibPiece' ? AdLibPieces.findOne(selectedElement?.elementId) : undefined
				let rundownBaselineAdLibPiece =
					type === 'rundownBaselineAdLibPiece'
						? RundownBaselineAdLibPieces.findOne(selectedElement?.elementId)
						: undefined
				let adLibAction = type === 'adLibAction' ? AdLibActions.findOne(selectedElement?.elementId) : undefined
				let rundownBaselineAdLibAction =
					type === 'rundownBaselineAdLibAction'
						? RundownBaselineAdLibActions.findOne(selectedElement?.elementId)
						: undefined

				if (
					!piece &&
					!adLibPiece &&
					!rundownBaselineAdLibPiece &&
					!adLibAction &&
					!rundownBaselineAdLibAction &&
					lastValidSmallestElement.current
				) {
					switch (lastValidSmallestElement.current.type) {
						case 'piece':
							piece = lastValidSmallestElement.current.element
							break
						case 'adLibPiece':
							adLibPiece = lastValidSmallestElement.current.element
							break
						case 'rundownBaselineAdLibPiece':
							rundownBaselineAdLibPiece = lastValidSmallestElement.current.element
							break
						case 'adLibAction':
							adLibAction = lastValidSmallestElement.current.element
							break
						case 'rundownBaselineAdLibAction':
							rundownBaselineAdLibAction = lastValidSmallestElement.current.element
							break
					}
				}

				setAdLibPiece(adLibPiece)
				setRundownBaselineAdLibPiece(rundownBaselineAdLibPiece)
				setAdLibAction(adLibAction)
				setRundownBaselineAdLibAction(rundownBaselineAdLibAction)

				const part = UIParts.findOne({
					_id: piece?.startPartId ?? adLibPiece?.partId ?? adLibAction?.partId ?? selectedElement?.elementId,
				})
				const segment = Segments.findOne({ _id: part ? part.segmentId : selectedElement?.elementId })

				setPiece(piece)
				setPart(part)
				setSegment(segment)
			})
		)

		return () => computation.stop()
	}, [selectedElement?.elementId, selectedElement?.type, clearPendingChange])

	return {
		type: selectedElement?.type,
		rundownId,
		selectedObjects: {
			piece,
			adLibPiece,
			rundownBaselineAdLibPiece,
			adLibAction,
			rundownBaselineAdLibAction,
			part,
			segment,
		},
	}
}

export function useSelectedObjectsUserEditProps(
	type: SelectedElement['type'] | undefined,
	selectedObjects: SelectedObjects
): {
	title: string | ITranslatableMessage | undefined
	userEditOperations: CoreUserEditingDefinition[] | undefined
	userEditProperties: CoreUserEditingProperties | undefined
} {
	switch (type) {
		case 'segment': {
			return {
				title: selectedObjects.segment?.name,
				userEditOperations: selectedObjects.segment?.userEditOperations,
				userEditProperties: selectedObjects.segment?.userEditProperties,
			}
		}
		case 'part': {
			return {
				title: selectedObjects.part?.title,
				userEditOperations: selectedObjects.part?.userEditOperations,
				userEditProperties: selectedObjects.part?.userEditProperties,
			}
		}
		case 'piece': {
			return {
				title: selectedObjects.piece?.name,
				userEditOperations: selectedObjects.piece?.userEditOperations,
				userEditProperties: selectedObjects.piece?.userEditProperties,
			}
		}
		case 'adLibPiece': {
			return {
				title: selectedObjects.adLibPiece?.name,
				userEditOperations: selectedObjects.adLibPiece?.userEditOperations,
				userEditProperties: selectedObjects.adLibPiece?.userEditProperties,
			}
		}
		case 'rundownBaselineAdLibPiece': {
			return {
				title: selectedObjects.rundownBaselineAdLibPiece?.name,
				userEditOperations: selectedObjects.rundownBaselineAdLibPiece?.userEditOperations,
				userEditProperties: selectedObjects.rundownBaselineAdLibPiece?.userEditProperties,
			}
		}
		case 'adLibAction': {
			return {
				title: selectedObjects.adLibAction?.display.label,
				userEditOperations: selectedObjects.adLibAction?.userEditOperations,
				userEditProperties: selectedObjects.adLibAction?.userEditProperties,
			}
		}
		case 'rundownBaselineAdLibAction': {
			return {
				title: selectedObjects.rundownBaselineAdLibAction?.display.label,
				userEditOperations: selectedObjects.rundownBaselineAdLibAction?.userEditOperations,
				userEditProperties: selectedObjects.rundownBaselineAdLibAction?.userEditProperties,
			}
		}
		case 'rundown': {
			return {
				title: undefined,
				userEditOperations: undefined,
				userEditProperties: undefined,
			}
		}
		case 'partInstance': {
			return {
				title: selectedObjects.part?.title,
				userEditOperations: selectedObjects.part?.userEditOperations,
				userEditProperties: selectedObjects.part?.userEditProperties,
			}
		}
		case undefined:
		default:
			return { title: undefined, userEditOperations: undefined, userEditProperties: undefined }
	}
}
