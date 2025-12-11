import React, { useEffect, useState, useLayoutEffect } from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { UserActionsLogItem } from '@sofie-automation/meteor-lib/dist/collections/UserActionsLog'
import { DatePickerFromTo } from '../../lib/datePicker.js'
import moment from 'moment'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { useTranslation } from 'react-i18next'
import { parse as queryStringParse } from 'query-string'
import { Link, useHistory, useLocation } from 'react-router-dom'
import classNames from 'classnames'
import { getCoreSystem, UserActionsLog } from '../../collections/index.js'
import Tooltip from 'rc-tooltip'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CollapseJSON } from '../../lib/collapseJSON.js'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { downloadBlob } from '../../lib/downloadBlob.js'
import Button from 'react-bootstrap/Button'

const PARAM_DATE_FORMAT = 'YYYY-MM-DDTHHmm'
const PARAM_NAME_FROM_DATE = 'fromDate'
const PARAM_NAME_TO_DATE = 'toDate'

interface IUserActionsListProps {
	logItems: UserActionsLogItem[]
	startDate?: number
	highlighted?: string
	onItemClick?: (item: UserActionsLogItem) => void
	renderButtons?: (item: UserActionsLogItem) => React.ReactElement
}

function UserActionsList(props: Readonly<IUserActionsListProps>) {
	const { t } = useTranslation()

	function renderMessageHead() {
		return (
			<thead>
				<tr>
					<th className="c3 user-action-log__timestamp">{t('Timestamp')}</th>
					<th className="c3 user-action-log__executionTime">{t('Execution times')}</th>
					<th className="c1 user-action-log__userId">{t('User ID')}</th>
					<th className="c2 user-action-log__clientAddress">{t('Client IP')}</th>
					<th className="c3 user-action-log__context">{t('Action')}</th>
					<th className="c3 user-action-log__method">{t('Method')}</th>
					<th className="c3 user-action-log__status">{t('Status')}</th>
					<th className="c1 user-action-log__args">{t('Parameters')}</th>
					{props.renderButtons ? <th className="c1 user-action-log__buttons"></th> : null}
				</tr>
			</thead>
		)
	}

	return (
		<table className="table user-action-log">
			{renderMessageHead()}
			<tbody>
				{props.logItems.map((msg) => {
					const formattedTimestamp = moment(msg.timestamp).format('YYYY/MM/DD HH:mm:ss.SSS')
					const anchorId = `t${msg.timestamp}`
					const selfLink = `${location.pathname}?${PARAM_NAME_FROM_DATE}=${moment(props.startDate).format(
						PARAM_DATE_FORMAT
					)}#${anchorId}`
					return (
						<tr
							className={classNames({
								clickable: props.onItemClick,
								hl: props.highlighted === anchorId,
							})}
							key={unprotectString(msg._id)}
							onClick={() => props.onItemClick?.(msg)}
						>
							<td className="user-action-log__timestamp">
								<Link id={anchorId} to={selfLink}>
									{formattedTimestamp}
								</Link>
							</td>
							<td className="user-action-log__executionTime">
								<table>
									<tbody>
										{msg.clientTime ? (
											<tr>
												<td>
													<Tooltip
														overlay={t('Time from platform user event to Action received by Core')}
														placement="topLeft"
													>
														<span>{t('GUI')}:</span>
													</Tooltip>
												</td>
												<td>{Math.round((msg.timestamp - msg.clientTime) * 100) / 100} ms</td>
											</tr>
										) : null}
										{msg.executionTime ? (
											<tr>
												<td>
													<Tooltip overlay={t('Core + Worker processing time')} placement="topLeft">
														<span>{t('Core')}:</span>
													</Tooltip>
												</td>
												<td>{msg.executionTime} ms</td>
											</tr>
										) : null}
										{msg.workerTime ? (
											<tr>
												<td>{t('Worker')}:</td>
												<td>{msg.workerTime} ms</td>
											</tr>
										) : null}
										{msg.gatewayDuration ? (
											<tr>
												<td>{t('Gateway')}:</td>
												<td>{msg.gatewayDuration.join(', ')} ms</td>
											</tr>
										) : null}
										{msg.timelineResolveDuration ? (
											<tr>
												<td>{t('TSR')}:</td>
												<td>{msg.timelineResolveDuration.join(', ')} ms</td>
											</tr>
										) : null}
									</tbody>
								</table>
							</td>
							<td className="user-action-log__userId">{unprotectString(msg.userId)}</td>
							<td className="user-action-log__clientAddress">{msg.clientAddress}</td>
							<td className="user-action-log__context">{msg.context}</td>
							<td className="user-action-log__method">{msg.method}</td>
							<td className="user-action-log__status">
								{msg.success ? 'Success' : msg.success === false ? 'Error: ' + msg.errorMessage : null}
							</td>
							<td className="user-action-log__args">
								<CollapseJSON json={msg.args} />
							</td>
							{props.renderButtons ? <td className="user-action-log__buttons">{props.renderButtons(msg)}</td> : null}
						</tr>
					)
				})}
				{props.logItems.length >= 10_000 && ( // The publication is capped at this amount of documents
					<tr>
						<td colSpan={10}>
							<em>{t('Amount of entries exceeds the limt of 10 000 items.')}</em>
						</td>
					</tr>
				)}
			</tbody>
		</table>
	)
}

function getStartAndEndDateFromLocationSearch(locationSearch: string): { from: Time; to: Time } {
	const queryParams = queryStringParse(locationSearch, {
		arrayFormat: 'comma',
	})

	let qsStartDate: ReturnType<typeof moment> | null = null
	let qsEndDate: ReturnType<typeof moment> | null = null
	if (queryParams[PARAM_NAME_FROM_DATE]) {
		qsStartDate = moment(queryParams[PARAM_NAME_FROM_DATE], PARAM_DATE_FORMAT, true)
	}
	if (queryParams[PARAM_NAME_TO_DATE]) {
		qsEndDate = moment(queryParams[PARAM_NAME_TO_DATE], PARAM_DATE_FORMAT, true)
	}

	return qsStartDate?.isValid()
		? {
				from: qsStartDate.valueOf(),
				to: qsEndDate?.isValid() ? qsEndDate.valueOf() : qsStartDate.add(1, 'days').valueOf(),
			}
		: qsEndDate?.isValid()
			? {
					to: qsEndDate.valueOf(),
					from: qsStartDate?.isValid() ? qsStartDate.valueOf() : qsEndDate.add(1, 'days').valueOf(),
				}
			: {
					from: moment().startOf('day').valueOf(),
					to: moment().add(1, 'days').startOf('day').valueOf(),
				}
}

function UserActivity(): JSX.Element {
	const { t } = useTranslation()

	const location = useLocation()

	const [dateFrom, setDateFrom] = useState<Time>(() => {
		const { from } = getStartAndEndDateFromLocationSearch(location.search)
		return from
	})
	const [dateTo, setDateTo] = useState<Time>(() => {
		const { to } = getStartAndEndDateFromLocationSearch(location.search)
		return to
	})

	useSubscription(MeteorPubSub.userActionsLog, dateFrom, dateTo)

	const log = useTracker(
		() =>
			UserActionsLog.find(
				{},
				{
					sort: {
						timestamp: 1,
					},
				}
			).fetch(),
		[],
		[]
	)

	const history = useHistory()

	useEffect(() => {
		const { from, to } = getStartAndEndDateFromLocationSearch(location.search)
		setDateFrom(from)
		setDateTo(to)
	}, [location])

	function onDateChange(from: Time, to: Time) {
		setDateFrom(from)
		setDateTo(to)
		const newParams = new URLSearchParams(location.search)
		newParams.set(PARAM_NAME_FROM_DATE, moment(from).format(PARAM_DATE_FORMAT))
		newParams.set(PARAM_NAME_TO_DATE, moment(to).format(PARAM_DATE_FORMAT))
		location.search = `?${newParams.toString()}`
		history.replace(location)
	}

	const logItems = log.filter(({ timestamp }) => timestamp >= dateFrom && timestamp < dateTo)

	function onDownloadAllLogItems() {
		const coreSystem = getCoreSystem()
		const systemName = coreSystem?.name ?? 'Sofie'
		const fileName = `${systemName}_UserActionsLog_${moment(dateFrom).format(PARAM_DATE_FORMAT)}.json`

		downloadBlob(
			new Blob([JSON.stringify(logItems)], {
				type: 'application/json',
			}),
			fileName
		)
	}

	const [highlighted, setHighlighted] = useState<string | undefined>(undefined)

	function renderUserActivity() {
		return (
			<div>
				<div className="user-action-log__pickers">
					<DatePickerFromTo from={dateFrom} to={dateTo} onChange={onDateChange} />
					<div>
						<Tooltip overlay={t('Export visible')} placement="top">
							<Button variant="outline-secondary" onClick={onDownloadAllLogItems}>
								<FontAwesomeIcon icon={faDownload} />
							</Button>
						</Tooltip>
					</div>
				</div>
				<UserActionsList logItems={logItems} startDate={dateFrom} highlighted={highlighted} />
			</div>
		)
	}

	useLayoutEffect(() => {
		const targetId = location.hash ? location.hash.substring(1) : undefined
		if (highlighted !== targetId && logItems.length && targetId) {
			const targetElement = document.getElementById(targetId)
			if (!targetElement) return
			targetElement.scrollIntoView()
			setHighlighted(targetId)
		}
	}, [location, location.hash, highlighted, logItems.length])

	return (
		<div>
			<header className="mb-2">
				<h1>{t('User Activity Log')}</h1>
			</header>
			<div className="my-5">{renderUserActivity()}</div>
		</div>
	)
}

export { UserActivity }
