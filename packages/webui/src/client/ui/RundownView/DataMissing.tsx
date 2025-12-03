import { useTranslation } from 'react-i18next'
import { Route } from 'react-router-dom'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import type { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import type { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import type { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import type { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'

interface RundownDataMissingProps {
	playlist: DBRundownPlaylist | undefined
	studio: UIStudio | undefined
	rundowns: DBRundown[]
	showStyleBase: UIShowStyleBase | undefined
	showStyleVariant: DBShowStyleVariant | undefined
}

export function RundownDataMissing(props: RundownDataMissingProps): JSX.Element {
	const { t } = useTranslation()

	return (
		<div className="rundown-view rundown-view--unpublished">
			<div className="rundown-view__label">
				<p className="summary">
					{!props.playlist
						? t('This rundown has been unpublished from Sofie.')
						: !props.studio
							? t('Error: The studio of this Rundown was not found.')
							: !props.rundowns.length
								? t('This playlist is empty')
								: !props.showStyleBase || !props.showStyleVariant
									? t('Error: The ShowStyle of this Rundown was not found.')
									: t('Unknown error')}
				</p>
				<p>
					<Route
						render={({ history }) => (
							<button
								className="btn btn-primary"
								onClick={() => {
									history.push('/rundowns')
								}}
							>
								{t('Return to list')}
							</button>
						)}
					/>
				</p>
			</div>
		</div>
	)
}
