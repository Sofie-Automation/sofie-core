import ClassNames from 'classnames'
import {
	DashboardLayoutEndsWords,
	RundownLayoutBase,
	RundownLayoutEndWords,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { dashboardElementStyle } from './DashboardPanel.js'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ScriptContent } from '@sofie-automation/blueprints-integration'
import { getUnfinishedPieceInstancesReactive } from '../../lib/rundownLayouts.js'
import { getScriptPreview } from '../../lib/ui/scriptPreview.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { PieceInstances } from '../../collections/index.js'
import { ReadonlyDeep } from 'type-fest'
import { useTranslation } from 'react-i18next'

interface IEndsWordsPanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutEndWords
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
}

export function EndWordsPanel({ layout, panel, playlist, showStyleBase }: IEndsWordsPanelProps): JSX.Element {
	const { t } = useTranslation()

	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

	const livePieceInstance = useTracker(
		() => getPieceWithScript(playlist, showStyleBase, panel),
		[playlist, showStyleBase, panel]
	)

	const content = livePieceInstance?.piece.content as Partial<ScriptContent> | undefined

	const { endOfScript } = getScriptPreview(content?.fullScript || '')

	return (
		<div
			className={ClassNames(
				'end-words-panel timing',
				isDashboardLayout ? (panel as DashboardLayoutEndsWords).customClasses : undefined
			)}
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutEndsWords) : {}}
		>
			<div className="timing-clock left">
				{!panel.hideLabel && <span className="timing-clock-label">{t('End Words')}</span>}
				<span className="text">&lrm;{endOfScript}&lrm;</span>
			</div>
		</div>
	)
}

function getPieceWithScript(
	playlist: DBRundownPlaylist,
	showStyleBase: UIShowStyleBase,
	panel: RundownLayoutEndWords
): PieceInstance | undefined {
	const currentPartInstanceId = playlist.currentPartInfo?.partInstanceId

	const unfinishedPiecesIncludingFinishedPiecesWhereEndTimeHaveNotBeenSet = getUnfinishedPieceInstancesReactive(
		playlist,
		showStyleBase
	)

	const highestStartedPlayback = unfinishedPiecesIncludingFinishedPiecesWhereEndTimeHaveNotBeenSet.reduce(
		(hsp, piece: ReadonlyDeep<PieceInstance>) => Math.max(hsp, piece.reportedStartedPlayback ?? 0),
		0
	)

	const unfinishedPieces = unfinishedPiecesIncludingFinishedPiecesWhereEndTimeHaveNotBeenSet.filter(
		(pieceInstance: ReadonlyDeep<PieceInstance>) => {
			return !pieceInstance.reportedStartedPlayback || pieceInstance.reportedStartedPlayback == highestStartedPlayback
		}
	)

	const activeLayers = unfinishedPieces.map((p) => p.piece.sourceLayerId)
	const hasAdditionalLayer: boolean = panel.additionalLayers?.some((s) => activeLayers.includes(s)) ?? false

	if (!hasAdditionalLayer) {
		return undefined
	}

	// we have to call this because getUnfinishedPieceInstancesReactive does not return script/manus pieces
	const piecesInPart: PieceInstance[] = currentPartInstanceId
		? PieceInstances.find({
				partInstanceId: currentPartInstanceId,
				playlistActivationId: playlist.activationId,
			}).fetch()
		: []

	return panel.requiredLayerIds && panel.requiredLayerIds.length
		? piecesInPart.find((piece: PieceInstance) => {
				return (
					(panel.requiredLayerIds || []).indexOf(piece.piece.sourceLayerId) !== -1 &&
					piece.partInstanceId === playlist.currentPartInfo?.partInstanceId
				)
			})
		: undefined
}
