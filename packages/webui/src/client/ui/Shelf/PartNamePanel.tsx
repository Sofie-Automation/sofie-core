import ClassNames from 'classnames'
import {
	DashboardLayoutPartName,
	RundownLayoutBase,
	RundownLayoutPartName,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { dashboardElementStyle } from './DashboardPanel.js'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { findPieceInstanceToShowFromInstances, IFoundPieceInstance } from '../PieceIcons/utils.js'
import { pieceIconSupportedLayers } from '../PieceIcons/PieceIcon.js'
import { RundownUtils } from '../../lib/rundown.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { PieceInstances } from '../../collections/index.js'
import { RundownPlaylistClientUtil } from '../../lib/rundownPlaylistUtil.js'
import { useTranslation } from 'react-i18next'

interface IPartNamePanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutPartName
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
}

interface IPartNamePanelTrackedProps {
	partName?: string
	instanceToShow?: IFoundPieceInstance
}

export function PartNamePanel({ layout, panel, playlist, showStyleBase }: IPartNamePanelProps): JSX.Element {
	const { t } = useTranslation()

	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

	const selectedPartInstanceId =
		panel.part === 'current' ? playlist.currentPartInfo?.partInstanceId : playlist.nextPartInfo?.partInstanceId

	const { partName, instanceToShow } = useTracker<IPartNamePanelTrackedProps>(
		() => {
			if (!selectedPartInstanceId || !panel.showPieceIconColor) return {}
			const selectedPartInstance = RundownPlaylistClientUtil.getActivePartInstances(playlist, {
				_id: selectedPartInstanceId,
			})[0]
			if (!selectedPartInstance) return {}

			const partName = selectedPartInstance.part?.title
			const pieceInstances = PieceInstances.find({ partInstanceId: selectedPartInstance._id }).fetch()
			const instanceToShow = findPieceInstanceToShowFromInstances(
				pieceInstances,
				showStyleBase.sourceLayers,
				pieceIconSupportedLayers
			)
			return { partName, instanceToShow }
		},
		[panel.showPieceIconColor, playlist._id, showStyleBase.sourceLayers],
		{}
	)

	const sourceLayerType = instanceToShow?.sourceLayer?.type
	let backgroundSourceLayer = sourceLayerType ? RundownUtils.getSourceLayerClassName(sourceLayerType) : undefined

	if (!backgroundSourceLayer) {
		backgroundSourceLayer = ''
	}

	return (
		<div
			className={ClassNames('part-name-panel', {
				[backgroundSourceLayer || 'unknown']: true,
			})}
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutPartName) : {}}
		>
			<div className="wrapper">
				<span className="part-name-title">{panel.part === 'current' ? t('Current Part') : t('Next Part')}</span>
				<span className="part-name">{partName}</span>
			</div>
		</div>
	)
}
