import { useMemo } from 'react'
import { PieceDisplayStyle } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { SourceLayerType, type VTContent } from '@sofie-automation/blueprints-integration'
import type { ReadonlyDeep } from 'type-fest'
import type { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import type { IDashboardButtonProps } from '../types.js'
import { DashboardButtonSubLabel } from './DashboardButtonSubLabel.js'
import { DashboardPieceButtonSplitPreview } from '../../DashboardPieceButtonSplitPreview.js'
import SplitInputIcon from '../../../PieceIcons/Renderers/SplitInputIcon.js'

type Props = Pick<
	IDashboardButtonProps,
	'piece' | 'layer' | 'studio' | 'displayStyle' | 'showThumbnailsInList' | 'disableHoverInspector'
> & {
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
}

export function MediaBox(props: Props): JSX.Element | null {
	const { piece, layer, studio, displayStyle, showThumbnailsInList, contentStatus } = props

	const isList = displayStyle === PieceDisplayStyle.LIST
	const isButtons = displayStyle === PieceDisplayStyle.BUTTONS
	const shouldRenderThumbnail = isButtons || (isList && showThumbnailsInList)

	const chosenUrl = useMemo(() => contentStatus?.thumbnailUrl || contentStatus?.previewUrl, [contentStatus])
	const isBrokenOrMissing = useMemo(() => {
		switch (contentStatus?.status) {
			case PieceStatusCode.SOURCE_BROKEN:
			case PieceStatusCode.SOURCE_MISSING:
			case PieceStatusCode.SOURCE_UNKNOWN_STATE:
			case PieceStatusCode.SOURCE_NOT_READY:
			case PieceStatusCode.UNKNOWN:
			case undefined:
				return true
			default:
				return false
		}
	}, [contentStatus?.status])

	if (!layer) return null

	if (layer.type === SourceLayerType.VT || layer.type === SourceLayerType.LIVE_SPEAK) {
		const vtContent = piece.content as VTContent | undefined
		const sourceDuration = vtContent?.sourceDuration

		const showMediaBox = shouldRenderThumbnail && (Boolean(chosenUrl) || isBrokenOrMissing)

		return (
			<>
				{showMediaBox ? (
					<div className="dashboard-panel__panel__button__thumbnail">
						<div className="dashboard-panel__panel__button__thumbnail__aspect">
							{chosenUrl ? <img src={chosenUrl} alt="" /> : null}
							{sourceDuration ? (
								<div className="dashboard-panel__panel__button__thumbnail__overlay">
									<DashboardButtonSubLabel sourceDuration={sourceDuration} studioSettings={studio?.settings} />
								</div>
							) : null}
						</div>
					</div>
				) : sourceDuration ? (
					<DashboardButtonSubLabel sourceDuration={sourceDuration} studioSettings={studio?.settings} />
				) : null}
			</>
		)
	}

	if (layer.type === SourceLayerType.SPLITS) {
		if (isList && showThumbnailsInList) {
			return <DashboardPieceButtonSplitPreview piece={piece} />
		}

		return <SplitInputIcon abbreviation={layer?.abbreviation} piece={piece} hideLabel={true} />
	}

	return null
}
