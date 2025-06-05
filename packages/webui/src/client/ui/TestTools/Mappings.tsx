import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { omit, unprotectString } from '../../lib/tempLib'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { makeTableOfObject } from '../../lib/utilComponents'
import { StudioSelect } from './StudioSelect'
import { MappingExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { LookaheadMode, TSR } from '@sofie-automation/blueprints-integration'
import { createSyncPeripheralDeviceCustomPublicationMongoCollection } from '../../collections/lib'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevicePubSubCollectionsNames } from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { useTranslation } from 'react-i18next'

const StudioMappings = createSyncPeripheralDeviceCustomPublicationMongoCollection(
	PeripheralDevicePubSubCollectionsNames.studioMappings
)

interface IMappingsViewProps {
	match?: {
		params?: {
			studioId: StudioId
		}
	}
}
function MappingsView(props: Readonly<IMappingsViewProps>): JSX.Element {
	const { t } = useTranslation()

	return (
		<div className="mtl gutter">
			<header className="mvs">
				<h1>{t('Routed Mappings')}</h1>
			</header>
			<div className="mod mvl">
				{props.match && props.match.params && (
					<div>
						<ComponentMappingsTable studioId={props.match.params.studioId} />
					</div>
				)}
			</div>
		</div>
	)
}

interface ComponentMappingsTableProps {
	studioId: StudioId
}
function ComponentMappingsTable({ studioId }: Readonly<ComponentMappingsTableProps>): JSX.Element {
	useSubscription(MeteorPubSub.mappingsForStudio, studioId)

	const mappingsObj = useTracker(
		() => {
			return StudioMappings.findOne(studioId)
		},
		[studioId],
		null
	)

	const mappingsItems = mappingsObj ? _.sortBy(Object.entries<MappingExt>(mappingsObj.mappings), (o) => o[0]) : []

	return (
		<div>
			<div>
				<div>
					<table className="testtools-timelinetable">
						<tbody>
							<tr>
								<th>Mapping</th>
								<th>DeviceId</th>
								<th>Type</th>
								<th>Name</th>
								<th>Lookahead</th>
								<th>Data</th>
							</tr>
							{mappingsItems.map(([id, obj]) => (
								<ComponentMappingsTableRow key={id} id={id} obj={obj} />
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	)
}

interface ComponentMappingsTableRowProps {
	id: string
	obj: MappingExt<TSR.TSRMappingOptions>
}
function ComponentMappingsTableRow({ id, obj }: Readonly<ComponentMappingsTableRowProps>) {
	return (
		<tr>
			<td>{id}</td>
			<td>{unprotectString(obj.deviceId)}</td>
			<td>{TSR.DeviceType[obj.device]}</td>
			<td>{obj.layerName}</td>
			<td>
				Mode: {LookaheadMode[obj.lookahead]}
				<br />
				Distance: {obj.lookaheadMaxSearchDistance}
				<br />
				Depth: {obj.lookaheadDepth}
			</td>
			<td>
				{makeTableOfObject(
					omit(obj, 'deviceId', 'device', 'lookahead', 'lookaheadDepth', 'lookaheadMaxSearchDistance', 'layerName')
				)}
			</td>
		</tr>
	)
}

function MappingsStudioSelect(): JSX.Element {
	return <StudioSelect path="mappings" title="Mappings" />
}

export { MappingsView, MappingsStudioSelect }
