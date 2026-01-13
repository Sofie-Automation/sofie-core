import * as React from 'react'
import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import Tooltip from 'rc-tooltip'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRedo, faStopCircle, faChevronDown, faChevronRight, faExclamation } from '@fortawesome/free-solid-svg-icons'
import { MeteorCall } from '../../../lib/meteorApi.js'
import { doUserAction, UserAction } from '../../../lib/clientUserAction.js'

import { DisplayFormattedTime } from '../../RundownList/DisplayFormattedTime.js'
import { JobStatusIcon } from './JobStatusIcon.js'
import { ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'
import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'

export const PackageWorkStatus: React.FC<{ status: ExpectedPackageWorkStatus; connected: boolean }> =
	function PackageWorkStatus({ status, connected }) {
		const { t } = useTranslation()

		const [isOpen, setIsOpen] = React.useState(false)

		const restartExpectation = useCallback(
			(e: React.MouseEvent<HTMLButtonElement, MouseEvent>, status: ExpectedPackageWorkStatus) => {
				doUserAction(t, e, UserAction.PACKAGE_MANAGER_RESTART_WORK, (e, ts) =>
					MeteorCall.userAction.packageManagerRestartExpectation(e, ts, status.deviceId, unprotectString(status._id))
				)
			},
			[status.deviceId, status._id]
		)
		const abortExpectation = useCallback(
			(e: React.MouseEvent<HTMLButtonElement, MouseEvent>, status: ExpectedPackageWorkStatus) => {
				doUserAction(t, e, UserAction.PACKAGE_MANAGER_RESTART_WORK, (e, ts) =>
					MeteorCall.userAction.packageManagerAbortExpectation(e, ts, status.deviceId, unprotectString(status._id))
				)
			},
			[status.deviceId, status._id]
		)

		return (
			<React.Fragment>
				<tr
					key={unprotectString(status._id)}
					className="package-job"
					onClick={(e) => {
						e.preventDefault()
						setIsOpen((isOpen) => !isOpen)
					}}
				>
					<td className="indent"></td>
					<td colSpan={2}>
						<span className="package-job__required">
							{status.requiredForPlayout ? (
								<Tooltip overlay={t('This step is required for playout')} placement="top">
									<span>
										<FontAwesomeIcon icon={faExclamation} />
									</span>
								</Tooltip>
							) : null}
						</span>
						<span className="package-job__status">
							<JobStatusIcon status={status} connected={connected} />
						</span>
						<span className="package-job__description">
							<span className="package__chevron">
								{isOpen ? <FontAwesomeIcon icon={faChevronDown} /> : <FontAwesomeIcon icon={faChevronRight} />}
							</span>
							<span>{status.label}</span>
						</span>
					</td>
					<td className="package-job__buttons">
						<Tooltip overlay={t('Restart')} placement="top">
							<button className="action-btn" onClick={(e) => restartExpectation(e, status)}>
								<FontAwesomeIcon icon={faRedo} />
							</button>
						</Tooltip>
						<Tooltip overlay={t('Abort')} placement="top">
							<button
								className="action-btn"
								// disabled={status.status !== 'fullfilled'}
								onClick={(e) => abortExpectation(e, status)}
							>
								<FontAwesomeIcon icon={faStopCircle} />
							</button>
						</Tooltip>
					</td>
					<td></td>
				</tr>

				{isOpen ? (
					<tr key={`${status._id}_view`} className="package-job-details">
						<td></td>
						<td colSpan={4}>
							<table>
								<tbody>
									<tr>
										<td>{t('Work description')}</td>
										<td>{status.description}</td>
									</tr>
									<tr>
										<td>{t('Work status')}</td>
										<td>{status.status}</td>
									</tr>
									<tr>
										<td>{t('Work status reason')}</td>
										<td>
											<Tooltip
												overlay={t('Technical reason: {{reason}}', {
													reason: status.statusReason.tech,
												})}
												placement="bottom"
											>
												<span>{status.statusReason.user ?? JSON.stringify(status.statusReason)}</span>
											</Tooltip>
										</td>
									</tr>
									<tr>
										<td>{t('Previous work status reasons')}</td>
										<td>
											<ul>
												{status.prevStatusReasons &&
													Object.entries<ExpectedPackageStatusAPI.Reason>(status.prevStatusReasons).map(
														([key, reason]) => {
															return (
																<li key={key}>
																	{key}:
																	<Tooltip
																		overlay={t('Technical reason: {{reason}}', {
																			reason: reason.tech,
																		})}
																		placement="bottom"
																	>
																		<span>{reason.user ?? JSON.stringify(reason)}</span>
																	</Tooltip>
																</li>
															)
														}
													)}
											</ul>
										</td>
									</tr>
									<tr>
										<td>{t('Last updated')}</td>
										<td>
											<DisplayFormattedTime displayTimestamp={status.modified} t={t} />
										</td>
									</tr>
									<tr>
										<td>{t('Priority')}</td>
										<td>{status.priority}</td>
									</tr>
								</tbody>
							</table>
						</td>
					</tr>
				) : null}
			</React.Fragment>
		)
	}
