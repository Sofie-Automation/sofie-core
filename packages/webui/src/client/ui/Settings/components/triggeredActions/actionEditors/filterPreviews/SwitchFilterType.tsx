import { FilterType } from '@sofie-automation/blueprints-integration'
import Button from 'react-bootstrap/Button'
import ButtonGroup from 'react-bootstrap/ButtonGroup'
import { useTranslation } from 'react-i18next'

export function SwitchFilterType({
	className,
	allowedTypes,
	selectedType,
	onChangeType,
}: {
	className?: string
	allowedTypes: FilterType[]
	selectedType: FilterType
	onChangeType: (newType: FilterType) => void
}): JSX.Element {
	const { t } = useTranslation()

	return (
		<ButtonGroup size="sm" className={className}>
			{allowedTypes.includes('view') ? (
				<Button
					variant={selectedType === 'view' ? "primary" : "outline-secondary"}
					onClick={() => onChangeType('view')}
				>
					{t('View')}
				</Button>
			) : null}
			{allowedTypes.includes('rundownPlaylist') ? (
				<Button
					variant={selectedType === 'rundownPlaylist' ? "primary" : "outline-secondary"}
					onClick={() => onChangeType('rundownPlaylist')}
				>
					{t('Rundown')}
				</Button>
			) : null}
			{allowedTypes.includes('adLib') ? (
				<Button
					variant={selectedType === 'adLib' ? "primary" : "outline-secondary"}
					onClick={() => onChangeType('adLib')}
				>
					{t('AdLib')}
				</Button>
			) : null}
		</ButtonGroup>
	)
}
