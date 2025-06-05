import * as React from 'react'
import { ExpectedPackageWorkStatus } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackageWorkStatuses'
import { useTranslation } from 'react-i18next'

export const JobStatusIcon: React.FC<{ status: ExpectedPackageWorkStatus; connected: boolean }> = ({
	status,
	connected,
}) => {
	const { t } = useTranslation()

	let progress: number
	let label: string
	if (status.status === 'fulfilled') {
		progress = 1
		label = t('Done')
	} else if (status.status === 'working') {
		progress = status.progress || 0
		label = Math.floor(progress * 100) + '%'
	} else {
		progress = 0
		label = status.status
	}
	console.log('connected', connected)
	if (!connected) {
		progress = 0
		label = '?'
	}
	return (
		<div
			className="job-status-icon"
			style={{
				width: '10em',
			}}
		>
			<div
				className="job-status-icon__progress"
				style={{
					width: progress * 100 + '%',
				}}
			></div>
			<div className="job-status-icon__label">{label}</div>
		</div>
	)
}
