import React from 'react'
import { ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { assertNever } from '../../../../lib/tempLib.js'
import { OffsetPosition } from '../../../../utils/positions.js'
import { PieceUi } from '../../../SegmentContainer/withResolvedSegment.js'
import { CameraThumbnailRenderer } from './CameraThumbnailRenderer.js'
import { DefaultThumbnailRenderer } from './DefaultThumbnailRenderer.js'
import { GraphicsThumbnailRenderer } from './GraphicsThumbnailRenderer.js'
import { LocalThumbnailRenderer } from './LocalThumbnailRenderer.js'
import { SplitsThumbnailRenderer } from './SplitsThumbnailRenderer.js'
import { VTThumbnailRenderer } from './VTThumbnailRenderer.js'

export interface IProps {
	partId: PartId
	partInstanceId: PartInstanceId
	partAutoNext: boolean
	partPlannedStoppedPlayback: number | undefined
	studio: UIStudio
	pieceInstance: PieceUi
	hoverScrubTimePosition: number
	height: number
	hovering: boolean
	originPosition: OffsetPosition
	layer: ISourceLayer | undefined
	isLive: boolean
	isNext: boolean
}

export const ThumbnailRenderer = React.memo(function ThumbnailRenderer(props: Readonly<IProps>): JSX.Element {
	const type = props.layer?.type

	switch (type) {
		case SourceLayerType.VT:
		case SourceLayerType.LIVE_SPEAK:
			return <VTThumbnailRenderer {...props} />
		case SourceLayerType.CAMERA:
		case SourceLayerType.REMOTE:
		case SourceLayerType.REMOTE_SPEAK:
			return <CameraThumbnailRenderer {...props} />
		case SourceLayerType.SPLITS:
			return <SplitsThumbnailRenderer {...props} />
		case SourceLayerType.GRAPHICS:
		case SourceLayerType.LOWER_THIRD:
		case SourceLayerType.STUDIO_SCREEN:
			return <GraphicsThumbnailRenderer {...props} />
		case SourceLayerType.LOCAL:
			return <LocalThumbnailRenderer {...props} />
		case SourceLayerType.AUDIO:
		case SourceLayerType.SCRIPT:
		case SourceLayerType.TRANSITION:
		case SourceLayerType.LIGHTS:
		case SourceLayerType.UNKNOWN:
		case undefined:
			return <DefaultThumbnailRenderer {...props} />
		default:
			assertNever(type)
			return <DefaultThumbnailRenderer {...props} />
	}
})
