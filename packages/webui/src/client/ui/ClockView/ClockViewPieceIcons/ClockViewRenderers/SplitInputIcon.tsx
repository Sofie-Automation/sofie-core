import * as React from 'react'
import { PieceGeneric } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { SplitsContent, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { RundownUtils } from '../../../../lib/rundown.js'
import { ReadonlyDeep } from 'type-fest'

type SplitIconPieceType = ReadonlyDeep<Omit<PieceGeneric, 'timelineObjectsString'>>

interface SplitInputIconProps {
	abbreviation: string | undefined
	piece: SplitIconPieceType | undefined
	hideLabel?: boolean
}

export default function SplitInputIcon({ abbreviation, piece, hideLabel }: Readonly<SplitInputIconProps>): JSX.Element {
	function getCameraLabel() {
		if (piece && piece.content) {
			const c = piece.content as SplitsContent
			const camera = c.boxSourceConfiguration.find((i) => i.type === SourceLayerType.CAMERA)
			if (camera && camera.studioLabel) {
				const label = camera.studioLabelShort || camera.studioLabel.match(/([a-zA-Z]+)?(\d+)/)
				return (
					<React.Fragment>
						{label && label[1] ? label[1].substr(0, 1).toUpperCase() + ' ' : ''}
						<span>{label ? label[2] : ''}</span>
					</React.Fragment>
				)
			}
		}
		return abbreviation !== undefined ? abbreviation : 'Spl'
	}

	function getLeftSourceType(): string {
		if (piece && piece.content) {
			const c = piece.content as SplitsContent
			const left = (c.boxSourceConfiguration && c.boxSourceConfiguration[0])?.type || SourceLayerType.CAMERA
			return RundownUtils.getSourceLayerClassName(left)
		}
		return 'camera'
	}

	function getRightSourceType(): string {
		if (piece && piece.content) {
			const c = piece.content as SplitsContent
			const right = (c.boxSourceConfiguration && c.boxSourceConfiguration[1])?.type || SourceLayerType.REMOTE
			const sourceType = RundownUtils.getSourceLayerClassName(right)
			return sourceType + (getLeftSourceType() === sourceType ? ' second' : '')
		}
		return 'remote'
	}

	return (
		<div className="clock-view-piece-icon">
			<div className="split-view">
				<div className={getLeftSourceType()}></div>
				<div className={getRightSourceType()}></div>
			</div>
			{!hideLabel && <span className="piece-icon-text">{getCameraLabel()}</span>}
		</div>
	)
}
