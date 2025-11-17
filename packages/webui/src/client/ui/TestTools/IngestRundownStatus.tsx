import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { makeTableOfObject } from '../../lib/utilComponents'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useTranslation } from 'react-i18next'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PeripheralDevices } from '../../collections'
import { Link } from 'react-router-dom'
import { PeripheralDeviceCategory } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { IngestRundownStatuses } from './collections'
import { IngestPartStatus, IngestRundownStatus } from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

interface IMappingsViewProps {
	match?: {
		params?: {
			peripheralDeviceId: PeripheralDeviceId
		}
	}
}
function IngestRundownStatusView(props: Readonly<IMappingsViewProps>): JSX.Element {
	const { t } = useTranslation()

	return (
		<div className="mx-5">
			<header className="my-2">
				<h1>{t('Ingest Rundown Status')}</h1>
			</header>
			<div className="my-5">
				{props.match && props.match.params && (
					<ComponentMappingsTable peripheralDeviceId={props.match.params.peripheralDeviceId} />
				)}
			</div>
		</div>
	)
}

interface ComponentMappingsTableProps {
	peripheralDeviceId: PeripheralDeviceId
}
function ComponentMappingsTable({ peripheralDeviceId }: Readonly<ComponentMappingsTableProps>): JSX.Element {
	useSubscription(MeteorPubSub.ingestDeviceRundownStatusTestTool, peripheralDeviceId)

	const rundowns = useTracker(() => IngestRundownStatuses.find({}).fetch(), [], [])

	return (
		<>
			{rundowns.map((rundown) => (
				<StatusesForRundown key={rundown.externalId} rundown={rundown} />
			))}
		</>
	)
}

function StatusesForRundown({ rundown }: { rundown: IngestRundownStatus }): JSX.Element {
	return (
		<Row>
			<Col xs={12}>
				<h3>
					{rundown.externalId} ({unprotectString(rundown._id)})
				</h3>

				<p>Status: {rundown.active}</p>

				<table className="testtools-timelinetable">
					<tbody>
						<tr>
							<th>Segment Id</th>
							<th>Part Id</th>
							<th>Ready</th>
							<th>Status</th>
							<th>Items</th>
						</tr>
						{rundown.segments.flatMap((segment) =>
							segment.parts.map((part) => (
								<StatusesForSegmentRow key={segment.externalId} part={part} segmentId={segment.externalId} />
							))
						)}
					</tbody>
				</table>
			</Col>
		</Row>
	)
}

interface StatusesForSegmentRowProps {
	segmentId: string
	part: IngestPartStatus
}
function StatusesForSegmentRow({ segmentId, part }: Readonly<StatusesForSegmentRowProps>) {
	return (
		<tr>
			<td>{segmentId}</td>
			<td>{part.externalId}</td>
			<td>{JSON.stringify(part.isReady)}</td>
			<td>{part.playbackStatus}</td>
			<td>{makeTableOfObject(part.itemsReady)}</td>
		</tr>
	)
}

function IngestRundownStatusSelect(): JSX.Element | null {
	const { t } = useTranslation()

	useSubscription(CorelibPubSub.peripheralDevices, null)
	const devices = useTracker(() => PeripheralDevices.find({ category: PeripheralDeviceCategory.INGEST }).fetch(), [])

	return (
		<div className="mx-5 recordings-studio-select">
			<header className="mb-2">
				<h1>{t('Ingest Rundown Statuses')}</h1>
			</header>
			<div className="my-5">
				<strong>Peripheral Device</strong>
				<ul>
					{devices?.map((device) => (
						<li key={unprotectString(device._id)}>
							<Link to={`ingestRundownStatus/${device._id}`}>{device.name}</Link>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}

export { IngestRundownStatusView, IngestRundownStatusSelect }
