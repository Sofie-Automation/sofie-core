import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { useContext } from 'react'
import { isEventInInputField } from '../../lib/lib'
import { isModalShowing } from '../../lib/ModalDialog'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownPlaylistClientUtil } from '../../lib/rundownPlaylistUtil'
import { SorensenContext } from '../../lib/SorensenContext'
import { TriggersHandler } from '../../lib/triggers/TriggersHandler'
import { UIParts } from '../Collections'
import { UserPermissionsContext } from '../UserPermissions'

interface RundownSorensenContextProps {
	playlist: DBRundownPlaylist
	currentRundown: Rundown
	studio: UIStudio
	showStyleBase: UIShowStyleBase
}

export function RundownSorensenContext({
	playlist,
	currentRundown,
	studio,
	showStyleBase,
}: RundownSorensenContextProps): JSX.Element {
	const userPermissions = useContext(UserPermissionsContext)

	const partInstances = useTracker(
		() => playlist && RundownPlaylistClientUtil.getSelectedPartInstances(playlist),
		[playlist?._id, playlist?.currentPartInfo, playlist?.nextPartInfo]
	)

	const currentSegmentId = partInstances?.currentPartInstance?.part?.segmentId
	const currentSegmentPartIds = useTracker(
		() =>
			currentSegmentId
				? UIParts.find(
						{
							segmentId: currentSegmentId,
						},
						{
							fields: {
								_id: 1,
							},
						}
					).map((part) => part._id)
				: [],
		[currentSegmentId],
		[]
	)

	const nextSegmentId = partInstances?.nextPartInstance?.part?.segmentId
	const nextSegmentPartIds = useTracker(
		() =>
			nextSegmentId
				? UIParts.find(
						{
							segmentId: nextSegmentId,
						},
						{
							fields: {
								_id: 1,
							},
						}
					).map((part) => part._id)
				: [],
		[nextSegmentId],
		[]
	)

	return (
		<SorensenContext.Consumer>
			{(sorensen) =>
				sorensen &&
				userPermissions.studio && (
					<TriggersHandler
						studioId={studio._id}
						rundownPlaylistId={playlist._id}
						showStyleBaseId={showStyleBase._id}
						currentRundownId={currentRundown?._id || null}
						currentPartId={partInstances?.currentPartInstance?.part._id || null}
						nextPartId={partInstances?.nextPartInstance?.part._id || null}
						currentSegmentPartIds={currentSegmentPartIds}
						nextSegmentPartIds={nextSegmentPartIds}
						sorensen={sorensen}
						global={isHotkeyAllowed}
					/>
				)
			}
		</SorensenContext.Consumer>
	)
}

const isHotkeyAllowed = (e: KeyboardEvent): boolean => {
	if (isModalShowing() || isEventInInputField(e)) {
		return false
	}
	return true
}
