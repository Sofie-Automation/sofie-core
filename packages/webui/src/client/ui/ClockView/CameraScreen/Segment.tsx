import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import classNames from 'classnames'
import { useContext, useMemo } from 'react'
import { ActivePartInstancesContext, PieceFilter } from './index.js'
import {
	withResolvedSegment,
	IResolvedSegmentProps as IWithResolvedSegmentProps,
	ITrackedResolvedSegmentProps as IWithResolvedSegmentInjectedProps,
} from '../../SegmentContainer/withResolvedSegment.js'
import { OrderedPartsContext } from './OrderedPartsProvider.js'
import { Part } from './Part.js'

interface IProps extends IWithResolvedSegmentProps {
	index: number
}

export const Segment = withResolvedSegment(
	({ parts, segmentui, playlist }: IProps & IWithResolvedSegmentInjectedProps) => {
		const activePartInstances = useContext(ActivePartInstancesContext)

		const orderedPartIds = useContext(OrderedPartsContext)

		const livePartIndex = useMemo(
			() =>
				activePartInstances.currentPartInstance?.part._id
					? orderedPartIds.indexOf(activePartInstances.currentPartInstance?.part._id)
					: -1,
			[activePartInstances.currentPartInstance?.part._id, orderedPartIds]
		)

		const nextPartIndex = useMemo(
			() =>
				activePartInstances.nextPartInstance?.part._id
					? orderedPartIds.indexOf(activePartInstances.nextPartInstance?.part._id)
					: -1,
			[activePartInstances.nextPartInstance?.part._id, orderedPartIds]
		)

		const unplayedValidParts = useMemo(
			() =>
				parts.filter((part) => {
					if (part.instance.part.invalid) return false
					const partIndex = orderedPartIds.indexOf(part.instance.part._id)
					if (partIndex < nextPartIndex && partIndex !== livePartIndex) return false
					return true
				}),
			[parts, orderedPartIds, nextPartIndex, livePartIndex]
		)

		const selectPiece = useContext(PieceFilter)

		const partsAndPieces = useMemo(
			() =>
				unplayedValidParts
					.map((part) => ({
						part,
						piece: part.pieces.sort((a, b) => (b.renderedInPoint ?? 0) - (a.renderedInPoint ?? 0)).find(selectPiece),
					}))
					.filter((pair) => pair.piece !== undefined),
			[selectPiece, unplayedValidParts]
		)

		const ownCurrentPartInstance = useMemo(
			() =>
				activePartInstances.currentPartInstance?.segmentId === segmentui?._id
					? activePartInstances.currentPartInstance
					: undefined,
			[activePartInstances.currentPartInstance, segmentui?._id]
		)

		const ownNextPartInstance = useMemo(
			() =>
				activePartInstances.nextPartInstance?.segmentId === segmentui?._id
					? activePartInstances.nextPartInstance
					: undefined,
			[activePartInstances.nextPartInstance, segmentui?._id]
		)

		if (partsAndPieces.length === 0 || segmentui === undefined) return null

		return (
			<div
				className={classNames('camera-screen__segment', {
					live: !!ownCurrentPartInstance,
					next: !!ownNextPartInstance,
				})}
				data-segment-id={segmentui._id}
				data-own-current-part-instance-id={ownCurrentPartInstance?._id}
			>
				<div className="camera-screen__segment-name">{segmentui.name}</div>
				{partsAndPieces.map(({ part, piece }) => {
					const isLive = ownCurrentPartInstance?._id === part.instance._id
					const isNext = ownNextPartInstance?._id === part.instance._id

					return (
						<Part
							key={unprotectString(part.instance._id)}
							part={part}
							piece={piece!}
							playlist={playlist}
							isLive={isLive}
							isNext={isNext}
						></Part>
					)
				})}
			</div>
		)
	}
)
