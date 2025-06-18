import { PeripheralDevices } from '../../../../collections'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { StudioPlayoutSubDevices } from './PlayoutSubDevices'
import { StudioInputSubDevices } from './InputSubDevices'
import { StudioIngestSubDevices } from './IngestSubDevices'
import { StudioParentDevices } from './ParentDevices'

interface IStudioDevicesProps {
	studioId: StudioId
}

export function StudioDevices({ studioId }: Readonly<IStudioDevicesProps>): JSX.Element {
	const studioDevices = useTracker(
		() =>
			PeripheralDevices.find({
				'studioAndConfigId.studioId': studioId,
			}).fetch(),
		[studioId],
		[]
	)

	return (
		<>
			<StudioParentDevices studioId={studioId} />

			<StudioPlayoutSubDevices studioId={studioId} studioDevices={studioDevices} />

			<StudioIngestSubDevices studioId={studioId} studioDevices={studioDevices} />

			<StudioInputSubDevices studioId={studioId} studioDevices={studioDevices} />
		</>
	)
}
