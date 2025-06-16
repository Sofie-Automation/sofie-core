import * as React from 'react'
import ClassNames from 'classnames'

import {
	ActionButtonType,
	DashboardLayoutActionButton,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

export interface IDashboardButtonProps {
	button: DashboardLayoutActionButton
	playlist: DBRundownPlaylist
	studioMode: boolean

	onButtonDown: (button: DashboardLayoutActionButton, e: React.SyntheticEvent<HTMLElement>) => void
	onButtonUp: (button: DashboardLayoutActionButton, e: React.SyntheticEvent<HTMLElement>) => void
}

export function DashboardActionButton({
	button,
	playlist,
	studioMode,
	onButtonDown,
	onButtonUp,
}: IDashboardButtonProps): JSX.Element {
	const getSpecialClasses = () => {
		switch (button.type) {
			case ActionButtonType.READY_ON_AIR:
				return {
					rehearsal: playlist.rehearsal,
					active: !!playlist.activationId,
				}
			default:
				return {}
		}
	}

	const isToggled = button.type === ActionButtonType.READY_ON_AIR && (!!playlist.rehearsal || !!playlist.activationId)

	const label = isToggled && button.labelToggled && button.labelToggled.length > 0 ? button.labelToggled : button.label

	return (
		<div
			className="dashboard-panel dashboard-panel--actions"
			style={{
				width:
					button.width >= 0
						? `calc((${button.width} * var(--dashboard-button-grid-width)) + var(--dashboard-panel-margin-width))`
						: undefined,
				height:
					button.height >= 0
						? `calc((${button.height} * var(--dashboard-button-grid-height)) + var(--dashboard-panel-margin-height))`
						: undefined,
				left:
					button.x >= 0
						? `calc(${button.x} * var(--dashboard-button-grid-width))`
						: button.width < 0
							? `calc(${-1 * button.width - 1} * var(--dashboard-button-grid-width))`
							: undefined,
				top:
					button.y >= 0
						? `calc(${button.y} * var(--dashboard-button-grid-height) * 1.022)`
						: button.height < 0
							? `calc(${-1 * button.height - 1} * var(--dashboard-button-grid-height)) * 1.022`
							: undefined,
				right:
					button.x < 0
						? `calc(${-1 * button.x - 1} * var(--dashboard-button-grid-width))`
						: button.width < 0
							? `calc(${-1 * button.width - 1} * var(--dashboard-button-grid-width))`
							: undefined,
				bottom:
					button.y < 0
						? `calc(${-1 * button.y - 1} * var(--dashboard-button-grid-height))`
						: button.height < 0
							? `calc(${-1 * button.height - 1} * var(--dashboard-button-grid-height))`
							: undefined,
			}}
		>
			<div className="dashboard-panel__panel">
				<div
					className={ClassNames(
						'dashboard-panel__panel__button',
						'dashboard-panel__panel__button--standalone',
						`type--${button.type}`,
						getSpecialClasses(),
						{ uninteractive: !studioMode }
					)}
					onMouseDown={(e) => onButtonDown(button, e)}
					onMouseUp={(e) => onButtonUp(button, e)}
					data-obj-id={button.type}
				>
					<div className="dashboard-panel__panel__button__content">
						<div className="dashboard-panel__panel__button__label-container">
							<span className="dashboard-panel__panel__button__label">{label}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
