import { useTranslation } from 'react-i18next'
import { useRundownPlaylistId } from '../../RundownPlaylistContext.js'
import { usePlaylistTimingField } from './usePlaylistTimingValue.js'

export function AutoNextStatus(): JSX.Element | null {
	const { t } = useTranslation()

	const currentPartWillAutoNext = usePlaylistTimingField(useRundownPlaylistId(), 'currentPartWillAutoNext')

	return currentPartWillAutoNext ? (
		<div className="rundown-view__part__icon rundown-view__part__icon--auto-next">{t('Auto')}</div>
	) : null
}
