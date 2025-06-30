import { SourceLayerType, ISourceLayer } from '@sofie-automation/blueprints-integration'
import { SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { IPropsHeader } from './ClockViewPieceIcon.js'
import { PieceExtended } from '../../../lib/RundownResolver.js'
import { UIShowStyleBases } from '../../Collections.js'
import { PieceInstances } from '../../../collections/index.js'
import { ReadonlyDeep } from 'type-fest'

export interface IFoundPieceInstance {
	sourceLayer: ISourceLayer | undefined
	pieceInstance: ReadonlyDeep<PieceInstance> | undefined
}

export function findPieceInstanceToShow(
	props: IPropsHeader,
	selectedLayerTypes: Set<SourceLayerType>
): IFoundPieceInstance {
	const pieceInstances = PieceInstances.find({ partInstanceId: props.partInstanceId }).fetch()
	const showStyleBase = UIShowStyleBases.findOne(props.showStyleBaseId)

	if (!showStyleBase) {
		return {
			sourceLayer: undefined,
			pieceInstance: undefined,
		}
	}

	const sourceLayers = showStyleBase ? showStyleBase.sourceLayers : {}

	return findPieceInstanceToShowFromInstances(pieceInstances, sourceLayers, selectedLayerTypes)
}

export function findPieceInstanceToShowFromInstances(
	pieceInstances: ReadonlyDeep<PieceInstance[]>,
	sourceLayers: SourceLayers,
	selectedLayerTypes: Set<SourceLayerType>
): IFoundPieceInstance {
	let foundSourceLayer: ISourceLayer | undefined
	let foundPiece: ReadonlyDeep<PieceInstance> | undefined

	for (const pieceInstance of pieceInstances) {
		const layer = sourceLayers[pieceInstance.piece.sourceLayerId]
		if (layer && layer.onPresenterScreen && selectedLayerTypes.has(layer.type)) {
			if (foundSourceLayer && foundPiece) {
				if (
					pieceInstance.piece.enable &&
					foundPiece.piece.enable &&
					((pieceInstance.piece.enable.start || 0) > (foundPiece.piece.enable.start || 0) ||
						layer._rank >= foundSourceLayer._rank) // TODO: look into this, what should the do, really?
				) {
					foundSourceLayer = layer
					foundPiece = pieceInstance
				}
			} else {
				foundSourceLayer = layer
				foundPiece = pieceInstance
			}
		}
	}

	return {
		sourceLayer: foundSourceLayer,
		pieceInstance: foundPiece,
	}
}

export function findPieceExtendedToShowFromOrderedResolvedInstances(
	pieces: PieceExtended[],
	selectedLayerTypes: Set<SourceLayerType>
): PieceExtended | undefined {
	return pieces
		.slice()
		.reverse()
		.find((piece) => {
			if (piece.sourceLayer?.onPresenterScreen && selectedLayerTypes.has(piece.sourceLayer?.type)) {
				return true
			}
		})
}
