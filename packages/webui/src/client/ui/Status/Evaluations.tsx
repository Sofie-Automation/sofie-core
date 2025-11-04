import { useCallback, useMemo, useState } from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import Moment from 'react-moment'
import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { Evaluation } from '@sofie-automation/meteor-lib/dist/collections/Evaluations'
import { DatePickerFromTo } from '../../lib/datePicker.js'
import moment from 'moment'
import { getQuestionOptions } from '../AfterBroadcastForm.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { Evaluations } from '../../collections/index.js'
import { DropdownInputOption } from '../../lib/Components/DropdownInput.js'
import { useTranslation } from 'react-i18next'

export function EvaluationView(): JSX.Element {
	const { t } = useTranslation()

	const questionOptions = useMemo(() => getQuestionOptions(t), [t])

	const [dateFrom, setDateFrom] = useState(() => moment().startOf('day').valueOf())
	const [dateTo, setDateTo] = useState(() => moment().add(1, 'days').startOf('day').valueOf())

	useSubscription(MeteorPubSub.evaluations, dateFrom, dateTo)
	const evaluations = useTracker(
		() => {
			return Evaluations.find(
				{},
				{
					sort: {
						timestamp: 1,
					},
				}
			).fetch()
		},
		[],
		[]
	)

	const handleChangeDate = useCallback((from: Time, to: Time) => {
		setDateFrom(from)
		setDateTo(to)
	}, [])

	return (
		<div className="mx-5">
			<header className="mb-2">
				<h1>{t('Evaluations')}</h1>
			</header>
			<div className="my-5">
				<div className="paging">
					<DatePickerFromTo from={dateFrom} to={dateTo} onChange={handleChangeDate} />
				</div>
				<table className="table user-action-log">
					<thead>
						<tr>
							<th className="c3 user-action-log__timestamp">{t('Timestamp')}</th>
							<th className="c1 user-action-log__userId">{t('User Name')}</th>
							<th>{t('Rundown')}</th>
							<th colSpan={99} className="c8">
								{t('Answers')}
							</th>
						</tr>
					</thead>
					<tbody>
						{evaluations
							.filter((e) => e.timestamp >= dateFrom && e.timestamp < dateTo)
							.map((evaluation) => {
								return (
									<EvaluationRow
										key={unprotectString(evaluation._id)}
										questionOptions={questionOptions}
										evaluation={evaluation}
									/>
								)
							})}
					</tbody>
				</table>
			</div>
		</div>
	)
}

interface EvaluationRowProps {
	questionOptions: Omit<DropdownInputOption<string>, 'i'>[]
	evaluation: Evaluation
}

function EvaluationRow({ questionOptions, evaluation }: Readonly<EvaluationRowProps>): JSX.Element {
	const tds = Object.entries<string>(evaluation.answers).map(([key, answer]) => {
		let str: string = answer
		if (key === 'q0') {
			for (const option of questionOptions) {
				if (option.value === str) {
					str = option.name
					break
				}
			}
		}

		return (
			<td key={key} className="user-action-log__answer">
				{str}
			</td>
		)
	})

	return (
		<tr key={unprotectString(evaluation._id)}>
			<td key="c0" className="user-action-log__timestamp">
				<Moment format="YYYY/MM/DD HH:mm:ss">{evaluation.timestamp}</Moment>
			</td>
			<td key="c1" className="user-action-log__userId">
				{evaluation.answers.q2 || ''}
			</td>
			<td key="c2" className="user-action-log__rundown">
				{unprotectString(evaluation.playlistId)}
			</td>

			{tds}
		</tr>
	)
}
