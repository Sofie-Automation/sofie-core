import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { SourceLayerType, VTContent } from '@sofie-automation/blueprints-integration'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { findPieceInstanceToShow } from './utils.js'
import { Timediff } from '../Timediff.js'
import { getCurrentTime } from '../../../lib/systemTime.js'
import {
	PartInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

export interface IPropsHeader {
	partInstanceId: PartInstanceId
	rundownIds: RundownId[]
	showStyleBaseId: ShowStyleBaseId
	playlistActivationId: RundownPlaylistActivationId | undefined
	partExpectedDuration: number | undefined
	partStartedPlayback: number | undefined
	partAutoNext: boolean
}

const supportedLayers = new Set([
	SourceLayerType.GRAPHICS,
	SourceLayerType.STUDIO_SCREEN,
	SourceLayerType.LIVE_SPEAK,
	SourceLayerType.REMOTE,
	SourceLayerType.REMOTE_SPEAK,
	SourceLayerType.SPLITS,
	SourceLayerType.VT,
	SourceLayerType.CAMERA,
])

export function PieceFreezeContainer(props: Readonly<IPropsHeader>): JSX.Element | null {
	const { pieceInstance, sourceLayer } = useTracker(
		() => findPieceInstanceToShow(props, supportedLayers),
		[props.partInstanceId, props.showStyleBaseId],
		{
			sourceLayer: undefined,
			pieceInstance: undefined,
		}
	)

	useSubscription(CorelibPubSub.pieceInstancesSimple, props.rundownIds, props.playlistActivationId ?? null)

	useSubscription(MeteorPubSub.uiShowStyleBase, props.showStyleBaseId)

	const piece = pieceInstance ? pieceInstance.piece : undefined
	const sourceDuration = (piece?.content as VTContent)?.sourceDuration
	const seek = (piece?.content as VTContent)?.seek || 0
	const postrollDuration = (piece?.content as VTContent)?.postrollDuration || 0
	const pieceEnable = typeof piece?.enable.start !== 'number' ? 0 : piece?.enable.start
	if (
		props.partStartedPlayback &&
		sourceLayer &&
		piece &&
		piece.content &&
		sourceDuration &&
		((props.partAutoNext && pieceEnable + (sourceDuration - seek) < (props.partExpectedDuration || 0)) ||
			(!props.partAutoNext &&
				Math.abs(pieceEnable + (sourceDuration - seek) - (props.partExpectedDuration || 0)) > 500))
	) {
		const freezeCountdown =
			props.partStartedPlayback + pieceEnable + (sourceDuration - seek) + postrollDuration - getCurrentTime()

		if (freezeCountdown > 0) {
			return (
				<>
					<Timediff time={freezeCountdown} />
					<img className="freeze-counter-icon" src="/icons/freeze-presenter-screen.svg" />
				</>
			)
		}
	}
	return null
}
