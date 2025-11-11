import Tooltip from 'rc-tooltip'
import { useTranslation } from 'react-i18next'
import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib.js'

export interface IPlaylistRankMethodToggleProps {
	manualSortingActive: boolean
	nrcsName: string
	toggleCallbackHandler: () => void
}

export default function PlaylistRankResetButton({
	manualSortingActive,
	nrcsName,
	toggleCallbackHandler,
}: Readonly<IPlaylistRankMethodToggleProps>): JSX.Element | null {
	const { t } = useTranslation()

	if (!manualSortingActive) return null

	return (
		<Tooltip
			mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
			placement="top"
			overlay={t('Use {{nrcsName}} order', { nrcsName })}
		>
			<button
				className="btn btn-secondary btn-tight rundown-playlist__reset-sort-order"
				onClick={toggleCallbackHandler}
			>
				{t('Reset Sort Order')}
			</button>
		</Tooltip>
	)
}
