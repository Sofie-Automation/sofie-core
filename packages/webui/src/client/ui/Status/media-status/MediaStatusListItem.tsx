import { JSX } from 'react'
import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { NavLink } from 'react-router-dom'
import { RundownUtils } from '../../../lib/rundown.js'
import classNames from 'classnames'
import { formatTime } from '@sofie-automation/meteor-lib/dist/time'
import { MediaStatusIndicator } from '../../MediaStatus/MediaStatusIndicator.js'

export function MediaStatusListItem({
	rundownName,
	rundownTo,
	status,
	isWorkingOn,
	statusOverlay,
	sourceLayerType,
	sourceLayerName,
	segmentIdentifier,
	partIdentifier,
	invalid,
	label,
	duration,
}: Readonly<{
	rundownName: string
	rundownTo?: string
	status: PieceStatusCode
	isWorkingOn: boolean
	statusOverlay?: string | undefined
	sourceLayerType?: SourceLayerType | undefined
	sourceLayerName?: string | undefined
	segmentIdentifier?: string | undefined
	partIdentifier?: string | undefined
	invalid?: boolean | undefined
	label: string
	duration?: number | undefined
}>): JSX.Element | null {
	const sourceLayerClassName =
		sourceLayerType !== undefined ? RundownUtils.getSourceLayerClassName(sourceLayerType) : undefined

	return (
		<tr className="media-status-item">
			<td className="media-status-item__rundown">
				{rundownTo ? <NavLink to={rundownTo}>{rundownName}</NavLink> : rundownName}
			</td>
			<td className="media-status-item__identifiers">
				{segmentIdentifier ? <div className="media-status-item__segment-identifier">{segmentIdentifier}</div> : null}
				{partIdentifier ? <div className="media-status-item__part-identifier">{partIdentifier}</div> : null}
			</td>
			<td className="media-status-item__status">
				<MediaStatusIndicator status={status} overlay={statusOverlay} isWorking={isWorkingOn} />
			</td>
			<td className="media-status-item__source-layer">
				<div
					data-status={status}
					className={classNames('media-status-item__source-layer-indicator', sourceLayerClassName, {
						'source-missing': status === PieceStatusCode.SOURCE_MISSING || status === PieceStatusCode.SOURCE_NOT_SET,
						'source-unknown-state': status === PieceStatusCode.SOURCE_UNKNOWN_STATE,
						'source-broken': status === PieceStatusCode.SOURCE_BROKEN,
						'source-not-ready': status === PieceStatusCode.SOURCE_NOT_READY,
					})}
				>
					{invalid && <div className={'media-status-item__source-layer-overlay invalid'}></div>}
					<div className="media-status-item__source-layer-label">{sourceLayerName}</div>
				</div>
			</td>
			<td className="media-status-item__label">
				<div className="media-status-item__label-container">{label}</div>
			</td>
			<td className="media-status-item__duration">{duration ? formatTime(duration) : null}</td>
		</tr>
	)
}
