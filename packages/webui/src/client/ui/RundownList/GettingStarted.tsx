import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'
import { ToolTipStep } from '../RundownList.js'

export interface IGettingStartedProps {
	step: ToolTipStep
}

export function GettingStarted({ step }: Readonly<IGettingStartedProps>): JSX.Element {
	const { t } = useTranslation()

	return (
		<div className="mx-5 mt-5 has-statusbar">
			<h1>{t('Getting Started')}</h1>
			<div>
				<ul>
					<li>
						{t('Start with giving this browser configuration permissions by adding this to the URL: ')}&nbsp;
						<Tooltip overlay={t('Start Here!')} visible={step === ToolTipStep.TOOLTIP_START_HERE} placement="top">
							<a href="?configure=1">?configure=1</a>
						</Tooltip>
					</li>
					<li>
						{t('Then, run the migrations script:')}&nbsp;
						<Tooltip
							overlay={t('Run Migrations to get set up')}
							visible={step === ToolTipStep.TOOLTIP_RUN_MIGRATIONS}
							placement="bottom"
						>
							<a href="/settings/tools/migration">{t('Migrations')}</a>
						</Tooltip>
					</li>
				</ul>
				{t('Documentation is available at')}&nbsp;
				<a href="https://github.com/Sofie-Automation/Sofie-TV-automation/">
					https://github.com/Sofie-Automation/Sofie-TV-automation/
				</a>
			</div>
		</div>
	)
}
