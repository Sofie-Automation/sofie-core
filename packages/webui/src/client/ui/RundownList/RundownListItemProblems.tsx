import { INoteBase } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { CriticalIconSmall, WarningIconSmall } from '../../lib/ui/icons/notifications.js'

interface IRundownListItemProblemsProps {
	warnings: INoteBase[]
	errors: INoteBase[]
}

export default function RundownListItemProblems(props: Readonly<IRundownListItemProblemsProps>): JSX.Element {
	const { warnings, errors } = props

	return (
		<span className="rundown-list-item__problems">
			{errors.length > 0 && (
				<span className="rundown-list-item__problem">
					<CriticalIconSmall />
					<span>{errors.length}</span>
				</span>
			)}
			{warnings.length > 0 && (
				<span className="rundown-list-item__problem">
					<WarningIconSmall />
					<span>{warnings.length}</span>
				</span>
			)}
		</span>
	)
}
