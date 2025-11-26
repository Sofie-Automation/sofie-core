import { useTranslation } from 'react-i18next'
import { TimingDataResolution, TimingTickResolution, useTiming } from './withTiming.js'

export function AutoNextStatus(): JSX.Element | null {
	const { t } = useTranslation()

	const timingDurations = useTiming(TimingTickResolution.High, TimingDataResolution.High, 'currentPartWillAutoNext')

	return timingDurations.currentPartWillAutoNext ? (
		<div className="rundown-view__part__icon rundown-view__part__icon--auto-next">{t('Auto')}</div>
	) : null
}
