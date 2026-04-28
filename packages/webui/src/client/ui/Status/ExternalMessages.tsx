import React, { useCallback, useContext, useState } from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getCurrentTime } from '../../lib/systemTime.js'
import { MomentFromNow } from '../../lib/Moment.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { makeTableOfObject } from '../../lib/utilComponents.js'
import ClassNames from 'classnames'
import { DatePickerFromTo } from '../../lib/datePicker.js'
import moment from 'moment'
import { faTrash, faPause, faPlay, faRedo } from '@fortawesome/free-solid-svg-icons'
import { MeteorCall } from '../../lib/meteorApi.js'
import { ExternalMessageQueue } from '../../collections/index.js'
import { catchError } from '../../lib/lib.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { useTranslation } from 'react-i18next'
import { UserPermissionsContext } from '../UserPermissions.js'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

export function ExternalMessages(): JSX.Element {
	const { t } = useTranslation()

	const [dateFrom, setDateFrom] = useState(() => moment().startOf('day').valueOf())
	const [dateTo, setDateTo] = useState(() => moment().add(1, 'days').startOf('day').valueOf())

	useSubscription(CorelibPubSub.externalMessageQueue, {
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
		<div className="external-message-status">
			<header className="mb-2">
				<h1>{t('Message Queue')}</h1>
			</header>
			<div>
				<div className="external-message-status">
					<div className="paging alc">
						<DatePickerFromTo from={dateFrom} to={dateTo} onChange={handleChangeDate} />
					</div>
					<div className="my-5">
						<ExternalMessagesQueuedMessages />
						<ExternalMessagesSentMessages />
					</div>
				</div>{' '}
			</div>
		</div>
	)
}

function ExternalMessagesQueuedMessages() {
	const { t } = useTranslation()

	const queuedMessages = useTracker(
		() =>
			ExternalMessageQueue.find(
				{
					sent: { $not: { $gt: 0 } },
				},
				{
					sort: {
						sent: -1,
						lastTry: -1,
					},
				}
			).fetch(),
		[],
		[]
	)

	return (
		<div>
			<h2>{t('Queued Messages')}</h2>
			<Row className="system-status-table">
				{queuedMessages.map((msg) => (
					<ExternalMessagesRow key={unprotectString(msg._id)} msg={msg} />
				))}
			</Row>
		</div>
	)
}

function ExternalMessagesSentMessages() {
	const { t } = useTranslation()

	const sentMessages = useTracker(
		() =>
			ExternalMessageQueue.find(
				{
					sent: { $gt: 0 },
				},
				{
					sort: {
						sent: -1,
						lastTry: -1,
					},
				}
			).fetch(),
		[],
		[]
	)

	return (
		<div>
			<h2>{t('Sent Messages')}</h2>

			<Row className="system-status-table">
				{sentMessages.map((msg) => (
					<ExternalMessagesRow key={unprotectString(msg._id)} msg={msg} />
				))}
			</Row>
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
		<React.Fragment key={unprotectString(msg._id)}>
			<Col xs={2} className={ClassNames(classes)}>
				{userPermissions.configure ? (
					<React.Fragment>
						<button className="action-btn m-2 ms-1" onClick={removeMessage}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
						<button className="action-btn m-2" onClick={toggleHoldMessage}>
							{msg.hold ? <FontAwesomeIcon icon={faPlay} /> : <FontAwesomeIcon icon={faPause} />}
						</button>
						<button className="action-btn m-2" onClick={retryMessage}>
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
			</Col>
			<Col xs={8} className={ClassNames(classes, 'small')}>
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
			</Col>
		</React.Fragment>
	)
}
