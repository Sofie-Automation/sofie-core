import React, { useCallback, useContext, useState } from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Time, unprotectString } from '../../lib/tempLib'
import { getCurrentTime } from '../../lib/systemTime'
import { MomentFromNow } from '../../lib/Moment'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { makeTableOfObject } from '../../lib/utilComponents'
import ClassNames from 'classnames'
import { DatePickerFromTo } from '../../lib/datePicker'
import moment from 'moment'
import { faTrash, faPause, faPlay, faRedo } from '@fortawesome/free-solid-svg-icons'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MeteorCall } from '../../lib/meteorApi'
import { UIStudios } from '../Collections'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ExternalMessageQueue } from '../../collections'
import { catchError } from '../../lib/lib'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { useTranslation } from 'react-i18next'
import { UserPermissionsContext } from '../UserPermissions'

function ExternalMessages(): JSX.Element {
	const { t } = useTranslation()

	useSubscription(MeteorPubSub.uiStudio, null)

	const studios = useTracker(() => UIStudios.find({}).fetch(), [], [])

	const [selectedStudioId, setSelectedStudioId] = useState<StudioId | null>(null)

	return (
		<div className="mhl gutter external-message-status">
			<header className="mbs">
				<h1>{t('Message Queue')}</h1>
			</header>
			<div className="mod mvl">
				<strong>Studio</strong>
				<ul>
					{studios.map((studio) => {
						return (
							<li key={unprotectString(studio._id)}>
								<a href="#" onClick={() => setSelectedStudioId(studio._id)}>
									{studio.name}
								</a>
							</li>
						)
					})}
				</ul>
			</div>
			<div>{selectedStudioId ? <ExternalMessagesInStudio studioId={selectedStudioId} /> : null}</div>
		</div>
	)
}

interface IExternalMessagesInStudioProps {
	studioId: StudioId
}
function ExternalMessagesInStudio({ studioId }: Readonly<IExternalMessagesInStudioProps>) {
	const [dateFrom, setDateFrom] = useState(() => moment().startOf('day').valueOf())
	const [dateTo, setDateTo] = useState(() => moment().add(1, 'days').startOf('day').valueOf())

	useSubscription(CorelibPubSub.externalMessageQueue, {
		studioId: studioId,
		created: {
			$gte: dateFrom,
			$lt: dateTo,
		},
	})

	const handleChangeDate = useCallback((from: Time, to: Time) => {
		setDateFrom(from)
		setDateTo(to)
	}, [])

	return (
		<div className="mhl gutter external-message-status">
			<div className="paging alc">
				<DatePickerFromTo from={dateFrom} to={dateTo} onChange={handleChangeDate} />
			</div>
			<div className="mod mvl">
				<ExternalMessagesQueuedMessages studioId={studioId} />
				<ExternalMessagesSentMessages studioId={studioId} />
			</div>
		</div>
	)
}

interface ExternalMessagesQueuedMessagesProps {
	studioId: StudioId
}
function ExternalMessagesQueuedMessages({ studioId }: Readonly<ExternalMessagesQueuedMessagesProps>) {
	const { t } = useTranslation()

	const queuedMessages = useTracker(
		() =>
			ExternalMessageQueue.find(
				{
					studioId: studioId,
					sent: { $not: { $gt: 0 } },
				},
				{
					sort: {
						sent: -1,
						lastTry: -1,
					},
				}
			).fetch(),
		[studioId],
		[]
	)

	return (
		<div>
			<h2>{t('Queued Messages')}</h2>
			<table className="table system-status-table">
				<tbody>
					{queuedMessages.map((msg) => (
						<ExternalMessagesRow key={unprotectString(msg._id)} msg={msg} />
					))}
				</tbody>
			</table>
		</div>
	)
}

interface ExternalMessagesSentMessagesProps {
	studioId: StudioId
}
function ExternalMessagesSentMessages({ studioId }: Readonly<ExternalMessagesSentMessagesProps>) {
	const { t } = useTranslation()

	const sentMessages = useTracker(
		() =>
			ExternalMessageQueue.find(
				{
					studioId: studioId,
					sent: { $gt: 0 },
				},
				{
					sort: {
						sent: -1,
						lastTry: -1,
					},
				}
			).fetch(),
		[studioId],
		[]
	)

	return (
		<div>
			<h2>{t('Sent Messages')}</h2>
			<table className="table system-status-table">
				<tbody>
					{sentMessages.map((msg) => (
						<ExternalMessagesRow key={unprotectString(msg._id)} msg={msg} />
					))}
				</tbody>
			</table>
		</div>
	)
}

interface ExternalMessagesRowProps {
	msg: ExternalMessageQueueObj
}
function ExternalMessagesRow({ msg }: Readonly<ExternalMessagesRowProps>) {
	const userPermissions = useContext(UserPermissionsContext)

	const removeMessage = useCallback(() => {
		MeteorCall.externalMessages.remove(msg._id).catch(catchError('externalMessages.remove'))
	}, [msg._id])
	const toggleHoldMessage = useCallback(() => {
		MeteorCall.externalMessages.toggleHold(msg._id).catch(catchError('externalMessages.toggleHold'))
	}, [msg._id])
	const retryMessage = useCallback(() => {
		MeteorCall.externalMessages.retry(msg._id).catch(catchError('externalMessages.retry'))
	}, [msg._id])

	const classes: string[] = ['message-row']
	let info: JSX.Element | null = null
	if (msg.sent) {
		classes.push('sent')
		info = (
			<div>
				<b>Sent: </b>
				<MomentFromNow unit="seconds">{msg.sent}</MomentFromNow>
			</div>
		)
	} else if (getCurrentTime() - (msg.lastTry || 0) < 10 * 1000 && (msg.lastTry || 0) > (msg.errorMessageTime || 0)) {
		classes.push('sending')
		info = (
			<div>
				<b>Sending...</b>
			</div>
		)
	} else if (msg.errorFatal) {
		classes.push('fatal')
		info = (
			<div>
				<b>Fatal error: </b>
				<span className="text-s vsubtle">{msg.errorMessage}</span>
			</div>
		)
	} else if (msg.errorMessage) {
		classes.push('error')
		info = (
			<div>
				<b>Error: </b>
				<span className="text-s vsubtle">{msg.errorMessage}</span>
				<div>
					<MomentFromNow>{msg.errorMessageTime}</MomentFromNow>
				</div>
			</div>
		)
	} else {
		classes.push('waiting')
		if (msg.tryCount) {
			info = (
				<div>
					<b>Tried {msg.tryCount} times</b>
				</div>
			)
		}
		if (msg.lastTry) {
			info = (
				<div>
					<b>Last try: </b>
					<MomentFromNow unit="seconds">{msg.lastTry}</MomentFromNow>
				</div>
			)
		}
	}
	return (
		<tr key={unprotectString(msg._id)} className={ClassNames(classes)}>
			<td className="c2">
				{userPermissions.configure ? (
					<React.Fragment>
						<button className="action-btn mod mls" onClick={removeMessage}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
						<button className="action-btn mod" onClick={toggleHoldMessage}>
							{msg.hold ? <FontAwesomeIcon icon={faPlay} /> : <FontAwesomeIcon icon={faPause} />}
						</button>
						<button className="action-btn mod" onClick={retryMessage}>
							<FontAwesomeIcon icon={faRedo} />
						</button>
						<br />
					</React.Fragment>
				) : null}
				ID: {unprotectString(msg._id)}
				<br />
				Created: <MomentFromNow unit="seconds">{msg.created}</MomentFromNow>
				{msg.queueForLaterReason !== undefined ? (
					<div>
						<b>Queued for later due to: {msg.queueForLaterReason || 'Unknown reason'}</b>
					</div>
				) : null}
			</td>
			<td className="c7 small">
				<div>{info}</div>
				<div>
					<div>
						<strong>Receiver</strong>
						<br />
						{makeTableOfObject(msg.receiver)}
					</div>
					<div>
						<strong>Message</strong>
						<br />
						{makeTableOfObject(msg.message)}
					</div>
				</div>
			</td>
		</tr>
	)
}

export { ExternalMessages }
