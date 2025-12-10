import { PeripheralDevices } from '../../../../collections/index.js'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData.js'
import { StudioPlayoutSubDevices } from './PlayoutSubDevices.js'
import { StudioInputSubDevices } from './InputSubDevices.js'
import { StudioIngestSubDevices } from './IngestSubDevices.js'
import { StudioParentDevices } from './ParentDevices.js'

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
