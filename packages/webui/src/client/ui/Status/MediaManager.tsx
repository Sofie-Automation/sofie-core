import React, { useCallback, useContext } from 'react'
import * as CoreIcons from '@nrk/core-icons/jsx'
import { faChevronDown, faChevronRight, faCheck, faStopCircle, faRedo, faFlag } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ClassNames from 'classnames'
import { MomentFromNow } from '../../lib/Moment.js'
import { CircularProgressbar } from 'react-circular-progressbar'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { MediaWorkFlow } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlows'
import { MediaWorkFlowStep } from '@sofie-automation/shared-lib/dist/core/model/MediaWorkFlowSteps'
import { useTranslation } from 'react-i18next'
import { assertNever, unprotectString } from '../../lib/tempLib.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { Spinner } from '../../lib/Spinner.js'
import { sofieWarningIcon as WarningIcon } from '../../lib/notifications/warningIcon.js'
import { doUserAction, UserAction } from '../../lib/clientUserAction.js'
import { MeteorCall } from '../../lib/meteorApi.js'
import Tooltip from 'rc-tooltip'
import { MediaManagerAPI } from '@sofie-automation/meteor-lib/dist/api/mediaManager'
import { MediaWorkFlowId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MediaWorkFlows, MediaWorkFlowSteps } from '../../collections/index.js'
import { useToggleExpandHelper } from '../util/useToggleExpandHelper.js'
import { UserPermissionsContext } from '../UserPermissions.js'

interface MediaWorkFlowUi extends MediaWorkFlow {
	steps: MediaWorkFlowStep[]
}

interface IItemProps {
	item: MediaWorkFlowUi
	isExpanded: boolean
	toggleExpanded: (id: MediaWorkFlowId) => void
	actionRestart: (event: React.MouseEvent<HTMLElement>, workflow: MediaWorkFlowUi) => void
	actionAbort: (event: React.MouseEvent<HTMLElement>, workflow: MediaWorkFlowUi) => void
	actionPrioritize: (event: React.MouseEvent<HTMLElement>, workflow: MediaWorkFlowUi) => void
}

type TFunc = (label: string, attrs?: object) => string

function actionLabel(t: TFunc, action0: string): string {
	const action = action0 as MediaManagerAPI.WorkStepAction
	switch (action) {
		case MediaManagerAPI.WorkStepAction.COPY:
			return t('File Copy')
		case MediaManagerAPI.WorkStepAction.DELETE:
			return t('File Delete')
		case MediaManagerAPI.WorkStepAction.SCAN:
			return t('Check file size')
		case MediaManagerAPI.WorkStepAction.GENERATE_METADATA:
			return t('Scan File')
		case MediaManagerAPI.WorkStepAction.GENERATE_THUMBNAIL:
			return t('Generate Thumbnail')
		case MediaManagerAPI.WorkStepAction.GENERATE_PREVIEW:
			return t('Generate Preview')
		default:
			assertNever(action)
			return t('Unknown action: {{action}}', { action })
	}
}

function workFlowStatusLabel(
	t: TFunc,
	success: boolean,
	finished: boolean,
	keyFinishedOk: boolean,
	currentTask: MediaWorkFlowStep | undefined
): React.ReactChild {
	if (success && finished) {
		return (
			<React.Fragment>
				<CoreIcons.NrkCheck />
				{t('Done')}
			</React.Fragment>
		)
	} else if (!success && finished) {
		return (
			<React.Fragment>
				<WarningIcon />
				{t('Failed')}
			</React.Fragment>
		)
	} else if (!finished && currentTask && currentTask.status === MediaManagerAPI.WorkStepStatus.WORKING) {
		return (
			<React.Fragment>
				<Spinner className="working-spinner" size="medium" />
				{keyFinishedOk ? t('Working, Media Available') : t('Working')}
			</React.Fragment>
		)
	} else if (!finished && !currentTask) {
		return t('Pending')
	} else {
		return t('Unknown')
	}
}

function workStepStatusLabel(t: TFunc, step: MediaWorkFlowStep): string {
	switch (step.status) {
		case MediaManagerAPI.WorkStepStatus.BLOCKED:
			return t('Blocked')
		case MediaManagerAPI.WorkStepStatus.CANCELED:
			return t('Canceled')
		case MediaManagerAPI.WorkStepStatus.DONE:
			return t('Done')
		case MediaManagerAPI.WorkStepStatus.ERROR:
			return t('Error')
		case MediaManagerAPI.WorkStepStatus.IDLE:
			return t('Idle')
		case MediaManagerAPI.WorkStepStatus.SKIPPED:
			return t('Skipped')
		case MediaManagerAPI.WorkStepStatus.WORKING:
			if (step.progress) {
				return t('Step progress: {{progress}}', { progress: Math.round(step.progress * 100) + '%' })
			} else {
				return t('Processing')
			}
		default:
			return t('Unknown: {{status}}', { state: step.status })
	}
}

function MediaManagerWorkFlowItem(props: Readonly<IItemProps>): JSX.Element {
	const { t } = useTranslation()

	const mediaWorkflow = props.item

	const isExpanded = props.isExpanded
	const finishedOK = mediaWorkflow.success && mediaWorkflow.finished
	const finishedError = !mediaWorkflow.success && mediaWorkflow.finished
	const criticalSteps = mediaWorkflow.steps.filter((j) => j.criticalStep)
	const keyFinishedOK =
		criticalSteps.length === 0
			? false
			: criticalSteps.reduce((memo, item) => {
					return memo && item.status === MediaManagerAPI.WorkStepStatus.DONE
				}, true)
	const currentTask = mediaWorkflow.steps
		.sort((a, b) => b.priority - a.priority)
		.find(
			(i) => i.status === MediaManagerAPI.WorkStepStatus.WORKING || i.status === MediaManagerAPI.WorkStepStatus.ERROR
		)
	const progress =
		mediaWorkflow.steps
			.map((i) => {
				switch (i.status) {
					case MediaManagerAPI.WorkStepStatus.DONE:
						return 1
					case MediaManagerAPI.WorkStepStatus.WORKING:
						return i.progress || 0
					default:
						return 0
				}
			})
			.reduce((memo, i) => memo + i, 0) / mediaWorkflow.steps.length

	return (
		<div
			className={ClassNames('workflow mb-2', {
				expanded: isExpanded,

				keyOk: keyFinishedOK,
				ok: finishedOK,
				error: finishedError,
			})}
		>
			<div className="workflow__header">
				<div className="workflow__header__progress">
					{finishedOK && (
						<div className="big-status ok">
							<FontAwesomeIcon icon={faCheck} />
						</div>
					)}
					{finishedError && (
						<div className="big-status error">
							<WarningIcon />
						</div>
					)}
					{!finishedOK && !finishedError && (
						<CircularProgressbar
							value={progress * 100} // TODO: initialAnimation={true} removed, make the animation other way if needed
							text={Math.round(progress * 100) + '%'}
							strokeWidth={10}
							styles={{
								path: { stroke: `#1769ff`, strokeLinecap: 'round' },
								trail: { stroke: '#E0E3E4' },
								text: { fill: '#252627', fontSize: '170%', transform: 'translate(0, 8%)', textAnchor: 'middle' },
							}}
						/>
					)}
					{!finishedOK && !finishedError && keyFinishedOK && (
						<div className="big-status sub-icon ok">
							<FontAwesomeIcon icon={faCheck} />
						</div>
					)}
				</div>
				<div className="workflow__header__summary">
					{mediaWorkflow.comment && mediaWorkflow.name !== mediaWorkflow.comment ? (
						<div className="workflow__header__name">
							<span className="workflow__header__name__name">{mediaWorkflow.name || 'Unnamed Workflow'}</span>
							<span className="workflow__header__name__comment">{mediaWorkflow.comment}</span>
						</div>
					) : (
						<div className="workflow__header__name">{mediaWorkflow.name || 'Unnamed Workflow'}</div>
					)}
					<div className="workflow__header__created">
						<MomentFromNow>{mediaWorkflow.created}</MomentFromNow>
					</div>
					<div className="workflow__header__expand" onClick={() => props.toggleExpanded(mediaWorkflow._id)}>
						{isExpanded ? t('Collapse') : t('Details')}
						{isExpanded ? <FontAwesomeIcon icon={faChevronDown} /> : <FontAwesomeIcon icon={faChevronRight} />}
					</div>
					<div className="workflow__header__status">
						{workFlowStatusLabel(t, mediaWorkflow.success, mediaWorkflow.finished, keyFinishedOK, currentTask)}
					</div>
					<div className="workflow__header__current-task workflow__step">
						{currentTask && (
							<React.Fragment>
								<div className="workflow__step__action">{actionLabel(t, currentTask.action)}</div>
								<div className="workflow__step__status">{workStepStatusLabel(t, currentTask)}</div>
							</React.Fragment>
						)}
					</div>
				</div>
				<div className="workflow__header__actions">
					<Tooltip overlay={t('Restart')} placement="top">
						<button className="action-btn" onClick={(e) => props.actionRestart(e, mediaWorkflow)}>
							<FontAwesomeIcon icon={faRedo} />
						</button>
					</Tooltip>
					<Tooltip overlay={t('Abort')} placement="top">
						<button
							className="action-btn"
							disabled={mediaWorkflow.finished}
							onClick={(e) => props.actionAbort(e, mediaWorkflow)}
						>
							<FontAwesomeIcon icon={faStopCircle} />
						</button>
					</Tooltip>
					<Tooltip overlay={t('Prioritize')} placement="top">
						<button
							className={ClassNames('action-btn', {
								prioritized: mediaWorkflow.priority > 1,
							})}
							disabled={mediaWorkflow.finished}
							onClick={(e) => props.actionPrioritize(e, mediaWorkflow)}
						>
							<FontAwesomeIcon icon={faFlag} />
						</button>
					</Tooltip>
				</div>
			</div>

			{isExpanded && (
				<div>
					{mediaWorkflow.steps
						.sort((a, b) => b.priority - a.priority)
						.map((step) => (
							<div
								className={ClassNames('workflow__step', {
									ok: step.status === MediaManagerAPI.WorkStepStatus.DONE,
									error: step.status === MediaManagerAPI.WorkStepStatus.ERROR,
									working: step.status === MediaManagerAPI.WorkStepStatus.WORKING,
								})}
								key={unprotectString(step._id)}
							>
								<div className="workflow__step__action pas">{actionLabel(t, step.action)}</div>
								<div className="workflow__step__status pas">{workStepStatusLabel(t, step)}</div>
								<div className="workflow__step__progress progress-bar">
									<div
										className="pb-indicator"
										style={{
											width: (step.progress || 0) * 100 + '%',
										}}
									/>
								</div>
								{step.messages && step.messages.length > 0 && (
									<ul className="workflow__step__messages pas man">
										{step.messages.map((k, key) => (
											<li key={key}>{k}</li>
										))}
									</ul>
								)}
							</div>
						))}
				</div>
			)}
		</div>
	)
}

export function MediaManagerStatus(): JSX.Element {
	const { t } = useTranslation()

	const userPermissions = useContext(UserPermissionsContext)

	// Subscribe to data:
	useSubscription(MeteorPubSub.mediaWorkFlows) // TODO: add some limit
	useSubscription(MeteorPubSub.mediaWorkFlowSteps)

	const actionRestartAll = useCallback(
		(event: React.MouseEvent<HTMLElement>) => {
			doUserAction(t, event, UserAction.RESTART_MEDIA_WORKFLOW, (e, ts) =>
				MeteorCall.userAction.mediaRestartAllWorkflows(e, ts)
			)
		},
		[t]
	)
	const actionAbortAll = useCallback(
		(event: React.MouseEvent<HTMLElement>) => {
			doUserAction(t, event, UserAction.ABORT_ALL_MEDIA_WORKFLOWS, (e, ts) =>
				MeteorCall.userAction.mediaAbortAllWorkflows(e, ts)
			)
		},
		[t]
	)

	const actionRestart = useCallback(
		(event: React.MouseEvent<HTMLElement>, workflow: MediaWorkFlowUi) => {
			doUserAction(t, event, UserAction.RESTART_MEDIA_WORKFLOW, (e, ts) =>
				MeteorCall.userAction.mediaRestartWorkflow(e, ts, workflow.deviceId, workflow._id)
			)
		},
		[t]
	)
	const actionAbort = useCallback(
		(event: React.MouseEvent<HTMLElement>, workflow: MediaWorkFlowUi) => {
			doUserAction(t, event, UserAction.ABORT_MEDIA_WORKFLOW, (e, ts) =>
				MeteorCall.userAction.mediaAbortWorkflow(e, ts, workflow.deviceId, workflow._id)
			)
		},
		[t]
	)
	const actionPrioritize = useCallback(
		(event: React.MouseEvent<HTMLElement>, workflow: MediaWorkFlowUi) => {
			doUserAction(t, event, UserAction.PRIORITIZE_MEDIA_WORKFLOW, (e, ts) =>
				MeteorCall.userAction.mediaPrioritizeWorkflow(e, ts, workflow.deviceId, workflow._id)
			)
		},
		[t]
	)

	const allWorkFlows: MediaWorkFlowUi[] = useTracker(
		() =>
			MediaWorkFlows.find({})
				.fetch()
				.map((i) => ({
					...i,
					steps: MediaWorkFlowSteps.find({
						workFlowId: i._id,
					}).fetch(),
				})),
		[],
		[]
	)
	const sortedWorkflows = allWorkFlows.sort((a, b) => b.created - a.created).sort((a, b) => b.priority - a.priority)

	const expandedHelper = useToggleExpandHelper()

	return (
		<div className="media-manager-status">
			<header className="mb-2">
				<h1>{t('Media Transfer Status')}</h1>
			</header>
			<div className="mx-2 my-4 text-end">
				{userPermissions.studio || userPermissions.configure ? (
					<React.Fragment>
						<button className="btn btn-secondary ms-1" onClick={actionAbortAll}>
							{t('Abort All')}
						</button>
						<button className="btn btn-secondary ms-1" onClick={actionRestartAll}>
							{t('Restart All')}
						</button>
					</React.Fragment>
				) : null}
			</div>
			<div className="my-5">
				{sortedWorkflows.map((mediaWorkflow) => (
					<MediaManagerWorkFlowItem
						isExpanded={expandedHelper.isExpanded(mediaWorkflow._id)}
						item={mediaWorkflow}
						key={unprotectString(mediaWorkflow._id)}
						toggleExpanded={expandedHelper.toggleExpanded}
						actionRestart={actionRestart}
						actionAbort={actionAbort}
						actionPrioritize={actionPrioritize}
					/>
				))}
			</div>
		</div>
	)
}
