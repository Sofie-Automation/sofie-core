import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { EvsContent, SourceLayerType } from '@sofie-automation/blueprints-integration'

import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { IPropsHeader } from './PieceIcon.js'
import { findPieceInstanceToShow } from './utils.js'
import { PieceGeneric } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

interface INamePropsHeader extends IPropsHeader {
	partName: string
	playlistActivationId: RundownPlaylistActivationId | undefined
}

const supportedLayers = new Set([
	SourceLayerType.GRAPHICS,
	SourceLayerType.LIVE_SPEAK,
	SourceLayerType.VT,
	SourceLayerType.LOCAL,
])

function getLocalPieceLabel(piece: ReadonlyDeep<PieceGeneric>): JSX.Element | null {
	const { color } = piece.content as EvsContent
	return (
		<>
			{color && (
				<span style={{ color: color.startsWith('#') ? color : `#${color}` }} className="piece__label__colored-mark">
					·
				</span>
			)}
			{piece.name}
		</>
	)
}

function getPieceLabel(piece: ReadonlyDeep<PieceGeneric>, type: SourceLayerType): JSX.Element | null {
	switch (type) {
		case SourceLayerType.LOCAL:
			return getLocalPieceLabel(piece)
		default:
			return <>{piece.name}</>
	}
}

export function PieceNameContainer(props: Readonly<INamePropsHeader>): JSX.Element | null {
	const { sourceLayer, pieceInstance } = useTracker(
		() => findPieceInstanceToShow(props, supportedLayers),
		[props.partInstanceId, props.showStyleBaseId],
		{
			sourceLayer: undefined,
			pieceInstance: undefined,
		}
	)

	useSubscription(CorelibPubSub.pieceInstancesSimple, props.rundownIds, props.playlistActivationId ?? null)

	useSubscription(MeteorPubSub.uiShowStyleBase, props.showStyleBaseId)

	if (pieceInstance && sourceLayer && supportedLayers.has(sourceLayer.type)) {
		return getPieceLabel(pieceInstance.piece, sourceLayer.type)
	}
	return <>{props.partName || ''}</>
}
