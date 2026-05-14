import ClassNames from 'classnames'

import './DashboardButtonTagStrip.scss'

export function DashboardButtonTagStrip(
	props: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>
): JSX.Element {
	return (
		<div className={ClassNames('dashboard-panel__panel__button__tag-container', props.className)}>{props.children}</div>
	)
}
