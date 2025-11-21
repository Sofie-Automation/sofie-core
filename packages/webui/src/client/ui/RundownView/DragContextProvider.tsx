import { PartInstanceId, PieceInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react'
import { dragContext, IDragContext } from './DragContext.js'
import { PieceUi } from '../SegmentContainer/withResolvedSegment.js'
import { doUserAction, UserAction } from '../../lib/clientUserAction.js'
import { MeteorCall } from '../../lib/meteorApi.js'
import { TFunction } from 'i18next'
import { UIParts } from '../Collections.js'
import { Segments } from '../../collections/index.js'
import { literal } from '../../lib/tempLib.js'
import { DefaultUserOperationRetimePiece, DefaultUserOperationsTypes } from '@sofie-automation/blueprints-integration'
import RundownViewEventBus, {
	RundownViewEvents,
	EditModeEvent,
} from '@sofie-automation/meteor-lib/dist/triggers/RundownViewEventBus'

const DRAG_TIMEOUT = 10000

interface Props {
	t: TFunction
}

// notes: this doesn't limit dragging between rundowns right now but I'm not sure if the ingest stage will be happy with that - mint
export function DragContextProvider({ t, children }: PropsWithChildren<Props>): JSX.Element {
	const [pieceId, setPieceId] = useState<undefined | PieceInstanceId>(undefined)
	const [piece, setPiece] = useState<undefined | PieceUi>(undefined)

	const [enabled, setEnabled] = useState(false)

	const partIdRef = useRef<undefined | PartInstanceId>(undefined)
	const positionRef = useRef({ x: 0, y: 0 })
	const segmentIdRef = useRef<undefined | SegmentId>(undefined)

	const startDrag = (
		ogPiece: PieceUi,
		timeScale: number,
		pos: { x: number; y: number },
		elementOffset?: number,
		limitToSegment?: SegmentId
	) => {
		if (pieceId) return // a drag is currently in progress....

		const inPoint = ogPiece.renderedInPoint ?? 0
		segmentIdRef.current = limitToSegment
		positionRef.current = pos
		setPieceId(ogPiece.instance._id)

		let localPiece = ogPiece // keep a copy of the overriden piece because react does not let us access the state of the context easily

		const onMove = (e: MouseEvent) => {
			const newInPoint =
				(!partIdRef.current ? inPoint : (elementOffset ?? 0) / timeScale) +
				(e.clientX - positionRef.current.x) / timeScale

			localPiece = {
				...ogPiece,
				instance: { ...ogPiece.instance, partInstanceId: partIdRef.current ?? ogPiece.instance.partInstanceId },
				renderedInPoint: newInPoint,
			}
			setPiece(localPiece)
		}

		const cleanup = () => {
			// unset state - note: for ux reasons this runs after the backend operation has returned a result
			setPieceId(undefined)
			setPiece(undefined)
			partIdRef.current = undefined
			segmentIdRef.current = undefined
		}

		const onMouseUp = (e: MouseEvent) => {
			// detach from the mouse
			document.removeEventListener('mousemove', onMove)
			document.removeEventListener('mouseup', onMouseUp)

			// process the drag
			if (!localPiece || localPiece.renderedInPoint === ogPiece.renderedInPoint) return cleanup()

			// find the parts so we can get their externalId
			const startPartId = localPiece.instance.piece.startPartId // this could become a funny thing with infinites
			const part = startPartId ? UIParts.findOne(startPartId) : undefined
			const oldPart =
				startPartId === ogPiece.instance.piece.startPartId
					? part
					: ogPiece.instance.piece.startPartId
						? UIParts.findOne(ogPiece.instance.piece.startPartId)
						: undefined
			if (!part) return cleanup() // tough to continue without a parent for the piece

			// find the Segment's External ID
			const segment = Segments.findOne(part?.segmentId)
			const oldSegment = part?.segmentId === oldPart?.segmentId ? segment : Segments.findOne(oldPart?.segmentId)
			if (!segment) return

			const operationTarget = {
				segmentExternalId: oldSegment?.externalId,
				partExternalId: oldPart?.externalId,
				pieceExternalId: ogPiece.instance.piece.externalId,
			}
			doUserAction(
				t,
				e,
				UserAction.EXECUTE_USER_OPERATION,
				(e, ts) =>
					MeteorCall.userAction.executeUserChangeOperation(
						e,
						ts,
						part.rundownId,
						operationTarget,
						literal<DefaultUserOperationRetimePiece>({
							id: DefaultUserOperationsTypes.RETIME_PIECE,
							payload: {
								segmentExternalId: segment.externalId,
								partExternalId: part.externalId,

								inPoint: localPiece.renderedInPoint ?? inPoint,
							},
						})
					),
				() => {
					cleanup()
				}
			)
		}

		document.addEventListener('mousemove', onMove)
		document.addEventListener('mouseup', onMouseUp)

		setTimeout(() => {
			// after the timeout we want to bail out in case something went wrong
			document.removeEventListener('mousemove', onMove)
			document.removeEventListener('mouseup', onMouseUp)

			cleanup()
		}, DRAG_TIMEOUT)
	}
	const setHoveredPart = (updatedPartId: PartInstanceId, segmentId: SegmentId, pos: { x: number; y: number }) => {
		if (!pieceId) return
		if (updatedPartId === piece?.instance.partInstanceId) return
		if (segmentIdRef.current && segmentIdRef.current !== segmentId) return

		partIdRef.current = updatedPartId
		positionRef.current = pos
	}

	const onSetEditMode = useCallback((e: EditModeEvent) => {
		if (e.state === 'toggle') {
			setEnabled((s) => !s)
		} else {
			setEnabled(e.state)
		}
	}, [])

	useEffect(() => {
		RundownViewEventBus.on(RundownViewEvents.EDIT_MODE, onSetEditMode)
		return () => {
			RundownViewEventBus.off(RundownViewEvents.EDIT_MODE, onSetEditMode)
		}
	})

	const ctx = literal<IDragContext>({
		pieceId,
		piece,

		enabled,

		startDrag,
		setHoveredPart,
	})

	return <dragContext.Provider value={ctx}>{children}</dragContext.Provider>
}
