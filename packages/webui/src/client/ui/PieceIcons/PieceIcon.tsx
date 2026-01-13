import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import {
	SourceLayerType,
	ISourceLayer,
	CameraContent,
	RemoteContent,
	EvsContent,
} from '@sofie-automation/blueprints-integration'
import { CamInputIcon } from './Renderers/CamInputIcon.js'
import { VTInputIcon } from './Renderers/VTInputIcon.js'
import SplitInputIcon from './Renderers/SplitInputIcon.js'
import { RemoteInputIcon } from './Renderers/RemoteInputIcon.js'
import { LiveSpeakInputIcon } from './Renderers/LiveSpeakInputIcon.js'
import { RemoteSpeakInputIcon } from './Renderers/RemoteSpeakInputIcon.js'
import { GraphicsInputIcon } from './Renderers/GraphicsInputIcon.js'
import { UnknownInputIcon } from './Renderers/UnknownInputIcon.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { findPieceInstanceToShow, findPieceInstanceToShowFromInstances } from './utils.js'
import LocalInputIcon from './Renderers/LocalInputIcon.js'
import {
	PartInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

export interface IPropsHeader {
	partInstanceId: PartInstanceId
	rundownIds: RundownId[]
	showStyleBaseId: ShowStyleBaseId
	playlistActivationId: RundownPlaylistActivationId | undefined
}

export const PieceIcon = (props: {
	pieceInstance: ReadonlyDeep<PieceInstance> | undefined
	sourceLayer: ISourceLayer | undefined
	renderUnknown?: boolean
}): JSX.Element | null => {
	const piece = props.pieceInstance ? props.pieceInstance.piece : undefined
	if (props.sourceLayer && piece) {
		switch (props.sourceLayer.type) {
			case SourceLayerType.GRAPHICS:
				return <GraphicsInputIcon abbreviation={props.sourceLayer.abbreviation} />
			case SourceLayerType.LIVE_SPEAK:
				return <LiveSpeakInputIcon abbreviation={props.sourceLayer.abbreviation} />
			case SourceLayerType.REMOTE: {
				const rmContent = piece ? (piece.content as RemoteContent | undefined) : undefined
				return (
					<RemoteInputIcon
						inputNumber={rmContent ? rmContent.studioLabelShort || rmContent.studioLabel : undefined}
						abbreviation={props.sourceLayer.abbreviation}
					/>
				)
			}
			case SourceLayerType.REMOTE_SPEAK: {
				return <RemoteSpeakInputIcon abbreviation={props.sourceLayer.abbreviation} />
			}
			case SourceLayerType.LOCAL: {
				const localContent = piece ? (piece.content as EvsContent | undefined) : undefined
				return (
					<LocalInputIcon
						inputNumber={localContent ? localContent.studioLabelShort || localContent.studioLabel : undefined}
						abbreviation={props.sourceLayer.abbreviation}
					/>
				)
			}
			case SourceLayerType.SPLITS:
				return <SplitInputIcon abbreviation={props.sourceLayer.abbreviation} piece={piece} />
			case SourceLayerType.VT:
				return <VTInputIcon abbreviation={props.sourceLayer.abbreviation} />
			case SourceLayerType.CAMERA: {
				const camContent = piece ? (piece.content as CameraContent | undefined) : undefined
				return (
					<CamInputIcon
						inputNumber={camContent ? camContent.studioLabelShort || camContent.studioLabel : undefined}
						abbreviation={props.sourceLayer.abbreviation}
					/>
				)
			}
		}
	}

	if (props.renderUnknown) {
		return <UnknownInputIcon />
	}

	return null
}

export const pieceIconSupportedLayers = new Set([
	SourceLayerType.GRAPHICS,
	SourceLayerType.LIVE_SPEAK,
	SourceLayerType.REMOTE,
	SourceLayerType.REMOTE_SPEAK,
	SourceLayerType.SPLITS,
	SourceLayerType.VT,
	SourceLayerType.CAMERA,
	SourceLayerType.LOCAL,
])

export function PieceIconContainerNoSub({
	pieceInstances,
	sourceLayers,
	renderUnknown,
}: Readonly<{
	pieceInstances: ReadonlyDeep<PieceInstance[]>
	sourceLayers: {
		[key: string]: ISourceLayer
	}
	renderUnknown?: boolean
}>): JSX.Element | null {
	const { pieceInstance, sourceLayer } = useTracker(
		() => findPieceInstanceToShowFromInstances(pieceInstances, sourceLayers, pieceIconSupportedLayers),
		[pieceInstances, sourceLayers],
		{
			sourceLayer: undefined,
			pieceInstance: undefined,
		}
	)

	return <PieceIcon pieceInstance={pieceInstance} sourceLayer={sourceLayer} renderUnknown={renderUnknown} />
}

export function PieceIconContainer(props: Readonly<IPropsHeader>): JSX.Element | null {
	const { pieceInstance, sourceLayer } = useTracker(
		() => findPieceInstanceToShow(props, pieceIconSupportedLayers),
		[props.partInstanceId, props.showStyleBaseId],
		{
			pieceInstance: undefined,
			sourceLayer: undefined,
		}
	)

	useSubscription(CorelibPubSub.pieceInstancesSimple, props.rundownIds, props.playlistActivationId ?? null)

	useSubscription(MeteorPubSub.uiShowStyleBase, props.showStyleBaseId)

	return <PieceIcon pieceInstance={pieceInstance} sourceLayer={sourceLayer} />
}
