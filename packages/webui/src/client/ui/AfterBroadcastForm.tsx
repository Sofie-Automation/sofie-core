import React, { useMemo, useState } from 'react'
import { Meteor } from 'meteor/meteor'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { TFunction, useTranslation } from 'react-i18next'
import { EvaluationBase } from '@sofie-automation/meteor-lib/dist/collections/Evaluations'
import { doUserAction, UserAction } from '../lib/clientUserAction.js'
import { MeteorCall } from '../lib/meteorApi.js'
import { SnapshotId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { hashSingleUseToken } from '../lib/lib.js'
import { DropdownInputControl, DropdownInputOption, getDropdownInputOptions } from '../lib/Components/DropdownInput.js'
import { MultiLineTextInputControl } from '../lib/Components/MultiLineTextInput.js'
import { TextInputControl } from '../lib/Components/TextInput.js'
import { Spinner } from '../lib/Spinner.js'
import { NotificationCenter, Notification, NoticeLevel } from '../lib/notifications/notifications.js'
import { isLoopRunning } from '../lib/RundownResolver.js'
import { useTracker } from '../lib/ReactMeteorData/ReactMeteorData.js'
import { CoreSystem } from '../collections/index.js'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import { UserError } from '@sofie-automation/corelib/dist/error'

type ProblemType = 'nothing' | 'minor' | 'major'

const DEFAULT_STATE = {
	problems: 'nothing' as ProblemType,
	description: [],
	userName: '' as const,
} as const

export function AfterBroadcastForm({ playlist }: Readonly<{ playlist: DBRundownPlaylist }>): JSX.Element {
	const { t } = useTranslation()
	const shouldDeactivateRundown = !isLoopRunning(playlist)
	const [problems, setProblems] = useState<ProblemType>(DEFAULT_STATE.problems)
	const [description, setDescription] = useState<string[]>(DEFAULT_STATE.description.slice())
	const [userName, setUserName] = useState<string>(DEFAULT_STATE.userName)
	const [busy, setBusy] = useState(false)

	function resetForm() {
		setProblems(DEFAULT_STATE.problems)
		setDescription(DEFAULT_STATE.description.slice())
		setUserName(DEFAULT_STATE.userName)
		setBusy(false)
	}

	function saveForm(e: React.FormEvent<HTMLElement>) {
		e.preventDefault()
		setBusy(true)

		const answers = {
			q0: problems,
			q1: description.join('\n'),
			q2: userName,
		}

		e.persist()

		const saveEvaluation = (snapshotId?: SnapshotId) => {
			const evaluation: EvaluationBase = {
				studioId: playlist.studioId,
				playlistId: playlist._id,
				answers: answers,
				snapshots: [],
			}
			if (snapshotId && evaluation.snapshots) evaluation.snapshots.push(snapshotId)

			doUserAction(t, e, UserAction.SAVE_EVALUATION, (e, ts) => MeteorCall.userAction.saveEvaluation(e, ts, evaluation))

			if (shouldDeactivateRundown) {
				doUserAction(t, e, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, (e, ts) =>
					MeteorCall.userAction.deactivate(e, ts, playlist._id)
				)
			}

			resetForm()
		}

		if (answers.q0 !== 'nothing' || answers.q1.trim() !== '') {
			doUserAction(
				t,
				e,
				UserAction.CREATE_SNAPSHOT_FOR_DEBUG,
				async (e, ts) =>
					MeteorCall.system.generateSingleUseToken().then((tokenResult) => {
						if (ClientAPI.isClientResponseError(tokenResult)) throw UserError.fromSerialized(tokenResult.error)
						if (!tokenResult.result) throw new Error('Failed to generate token')
						return MeteorCall.userAction.storeRundownSnapshot(
							e,
							ts,
							hashSingleUseToken(tokenResult.result),
							playlist._id,
							'Evaluation form',
							false
						)
					}),
				(err, snapshotId) => {
					if (!err && snapshotId) {
						saveEvaluation(snapshotId)
						return false
					}
					saveEvaluation()
					if (err instanceof Meteor.Error && err.error === 503) {
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.CRITICAL,
								t(
									'Could not create a snapshot for the evaluation, because the previous one was created just moments ago. If you want another snapshot, try again in a couple of seconds.'
								),
								'userAction'
							)
						)
						return false
					}
				}
			)
		} else {
			saveEvaluation()
		}
	}

	const problemOptions = useMemo(() => getDropdownInputOptions<ProblemType>(getQuestionOptions(t)), [])

	return (
		<div className="afterbroadcastform-container my-4" role="complementary" aria-labelledby="evaluation-header">
			<div className="afterbroadcastform">
				<form className="form" onSubmit={saveForm}>
					<EvaluationInfoBubble />

					<h2 id="evaluation-header">{t('How did the show go?')}</h2>

					<p>{t('Keyboard shortcuts and Stream Deck buttons will not work while filling out the form!')}</p>

					<div className="question q0">
						<label>
							<span>{t('Did you have any problems with the broadcast?')}</span>
							<DropdownInputControl
								value={problems}
								options={problemOptions}
								handleUpdate={setProblems}
								disabled={busy}
							/>
						</label>
					</div>
					<div className="question q1">
						<label>
							<span>{t('Please explain the problems you experienced')}</span>
							<span className="secondary">
								{t(
									'(what happened and when, what should have happened, what could have triggered the problems, etcetera...)'
								)}
							</span>
							<MultiLineTextInputControl value={description} handleUpdate={setDescription} disabled={busy} />
						</label>
					</div>
					<div className="question q2">
						<label>
							<span>{t('Your name')}</span>
							<TextInputControl value={userName} handleUpdate={setUserName} disabled={busy} />
						</label>
					</div>

					<div>
						<button type="submit" className="btn btn-primary" disabled={busy}>
							{!shouldDeactivateRundown ? t('Send message') : t('Send message and Deactivate Rundown')}
						</button>
						{busy ? <Spinner className="afterbroadcastform-spinner" size="small" /> : null}
					</div>
				</form>
			</div>
		</div>
	)
}

const EvaluationInfoBubble = React.memo(function EvaluationInfoBubble() {
	const coreSystemSettings = useTracker(() => {
		const core = CoreSystem.findOne(SYSTEM_ID, { projection: { settingsWithOverrides: 1 } })
		return core && applyAndValidateOverrides(core.settingsWithOverrides).obj
	}, [])

	const message = coreSystemSettings?.evaluationsMessage?.enabled ? coreSystemSettings.evaluationsMessage : undefined
	if (!message) return null

	return (
		<div className="afterbroadcastform-bubble-container">
			<div className="afterbroadcastform-bubble">
				<h5>{message.heading ?? ''}</h5>
				<p>{message.message ?? ''}</p>
			</div>
			<EvaluationBubbleStem />
		</div>
	)
})

function EvaluationBubbleStem() {
	return (
		<svg width="101" height="40" viewBox="0 0 101 40" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M0 0.400223H101C101 0.400223 97.5 0.400146 84 0.400146C70.5 0.400146 56.5 5.99992 42.5 21.4999C28.5 36.9999 21.1095 39.4985 16.5 39.4985C15.9438 39.4985 16.2207 38.9292 17.1378 37.928C30.1502 23.7223 23.3237 0.400195 4.05909 0.400218L0 0.400223Z"
				fill="white"
			/>
		</svg>
	)
}

export function getQuestionOptions(t: TFunction): Omit<DropdownInputOption<string>, 'i'>[] {
	return [
		{ value: 'nothing', name: t('No problems') },
		{ value: 'minor', name: t("Something went wrong, but it didn't affect the output") },
		{ value: 'major', name: t('Something went wrong, and it affected the output') },
	]
}
