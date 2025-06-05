import { useTranslation } from 'react-i18next'
import { TimingDataResolution, TimingTickResolution, withTiming, WithTiming } from './withTiming'

export const AutoNextStatus = withTiming<{}, {}>({
	filter: 'currentPartWillAutoNext',
	dataResolution: TimingDataResolution.High,
	tickResolution: TimingTickResolution.High,
})(function AutoNextStatus({ timingDurations }: WithTiming<{}>) {
	const { t } = useTranslation()

	return timingDurations.currentPartWillAutoNext ? (
		<div className="rundown-view__part__icon rundown-view__part__icon--auto-next">{t('Auto')}</div>
	) : null
})
