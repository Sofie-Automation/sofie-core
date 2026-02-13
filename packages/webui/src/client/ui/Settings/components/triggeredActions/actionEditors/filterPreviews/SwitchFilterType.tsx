import { FilterType } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'

export function SwitchFilterType({
	allowedTypes,
	selectedType,
	className,
	onChangeType,
}: {
	className?: string
	allowedTypes: FilterType[]
	selectedType: FilterType
	onChangeType: (newType: FilterType) => void
}): JSX.Element {
	const { t } = useTranslation()

	return (
		<div className={`btn-group ${className ?? ''}`}>
			{allowedTypes.includes('view') ? (
				<button
					className={classNames('btn btn-tight btn-secondary', {
						'btn-selected': selectedType === 'view',
					})}
					onClick={() => onChangeType('view')}
				>
					{t('View')}
				</button>
			) : null}
			{allowedTypes.includes('rundownPlaylist') ? (
				<button
					className={classNames('btn btn-tight btn-secondary', {
						'btn-selected': selectedType === 'rundownPlaylist',
					})}
					onClick={() => onChangeType('rundownPlaylist')}
				>
					{t('Rundown')}
				</button>
			) : null}
			{allowedTypes.includes('adLib') ? (
				<button
					className={classNames('btn btn-tight btn-secondary', {
						'btn-selected': selectedType === 'adLib',
					})}
					onClick={() => onChangeType('adLib')}
				>
					{t('AdLib')}
				</button>
			) : null}
		</div>
	)
}
