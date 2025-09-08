import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
	StudioRouteBehavior,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import classNames from 'classnames'
import { RouteSetOverrideIcon } from '../../lib/ui/icons/switchboard.js'
import Tooltip from 'rc-tooltip'
import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib.js'
import { ToggleSwitchControl } from '../../lib/Components/ToggleSwitch.js'
import { PopUpPanel } from './PopUpPanel.js'

interface IProps {
	onStudioRouteSetSwitch?: (
		e: React.ChangeEvent<HTMLInputElement>,
		routeSetId: string,
		routeSet: StudioRouteSet,
		state: boolean
	) => void
	availableRouteSets: [string, StudioRouteSet][]
	studioRouteSetExclusivityGroups: {
		[id: string]: StudioRouteSetExclusivityGroup
	}
}

/**
 * This is a panel for which Route Sets are active in the current studio
 */
export function SwitchboardPopUp(props: Readonly<IProps>): JSX.Element {
	const { t } = useTranslation()
	const exclusivityGroups: {
		[id: string]: Array<[string, StudioRouteSet]>
	} = {}
	for (const [id, routeSet] of props.availableRouteSets) {
		const group = routeSet.exclusivityGroup || '__noGroup'
		if (exclusivityGroups[group] === undefined) exclusivityGroups[group] = []
		exclusivityGroups[group].push([id, routeSet])
	}

	return (
		<PopUpPanel className="switchboard-pop-up-panel" role="dialog">
			<div className="switchboard-pop-up-panel__inside">
				<h2 className="">{t('Switchboard')}</h2>
				{Object.entries<[string, StudioRouteSet][]>(exclusivityGroups).map(([key, routeSets]) => (
					<div className="switchboard-pop-up-panel__group" key={key}>
						{props.studioRouteSetExclusivityGroups[key]?.name && (
							<p className="mx-4 mb-2">{props.studioRouteSetExclusivityGroups[key]?.name}</p>
						)}
						{routeSets.length === 2 &&
						routeSets[0][1].behavior === StudioRouteBehavior.ACTIVATE_ONLY &&
						routeSets[1][1].behavior === StudioRouteBehavior.ACTIVATE_ONLY ? (
							<div key={routeSets[0][0]} className="switchboard-pop-up-panel__group__controls dual mx-4 mb-2">
								<span
									className={classNames({
										'switchboard-pop-up-panel__group__controls__active': routeSets[0][1].active,
										'switchboard-pop-up-panel__group__controls__inactive': !routeSets[0][1].active,
									})}
								>
									{routeSets[0][1].name}
								</span>

								<ToggleSwitchControl
									classNames="switch-nocolor switch-lg"
									value={routeSets[1][1].active}
									handleUpdate={(_state, e) =>
										props.onStudioRouteSetSwitch &&
										props.onStudioRouteSetSwitch(
											e,
											routeSets[0][1].active ? routeSets[1][0] : routeSets[0][0],
											routeSets[0][1].active ? routeSets[1][1] : routeSets[0][1],
											true
										)
									}
								/>

								<span
									className={classNames({
										'switchboard-pop-up-panel__group__controls__active': routeSets[1][1].active,
										'switchboard-pop-up-panel__group__controls__inactive': !routeSets[1][1].active,
									})}
								>
									{routeSets[1][1].name}
								</span>
								{((routeSets[0][1].defaultActive !== undefined &&
									routeSets[0][1].active !== routeSets[0][1].defaultActive) ||
									(routeSets[1][1].defaultActive !== undefined &&
										routeSets[1][1].active !== routeSets[1][1].defaultActive)) && (
									<span className="switchboard-pop-up-panel__group__controls__notice">
										<Tooltip
											mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
											overlay={t("This is not in it's normal setting")}
											placement="top"
										>
											<span>
												<RouteSetOverrideIcon />
											</span>
										</Tooltip>
									</span>
								)}
							</div>
						) : (
							routeSets.map(([id, routeSet]) => (
								<div key={id} className="switchboard-pop-up-panel__group__controls mx-4 mb-2">
									<span
										className={classNames({
											'switchboard-pop-up-panel__group__controls__active': !routeSet.active,
											'switchboard-pop-up-panel__group__controls__inactive': routeSet.active,
										})}
									>
										{t('Off')}
									</span>

									<ToggleSwitchControl
										classNames="switch-nocolor switch-lg"
										value={routeSet.active}
										handleUpdate={(_state, e) =>
											!(routeSet.active && routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY) &&
											props.onStudioRouteSetSwitch &&
											props.onStudioRouteSetSwitch(e, id, routeSet, !routeSet.active)
										}
									/>

									<span
										className={classNames({
											'switchboard-pop-up-panel__group__controls__active': routeSet.active,
											'switchboard-pop-up-panel__group__controls__inactive': !routeSet.active,
										})}
									>
										{routeSet.name}
									</span>
									{routeSet.defaultActive !== undefined && routeSet.active !== routeSet.defaultActive && (
										<span className="switchboard-pop-up-panel__group__controls__notice">
											<Tooltip
												mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
												overlay={t("This is not in it's normal setting")}
												placement="top"
											>
												<span>
													<RouteSetOverrideIcon />
												</span>
											</Tooltip>
										</span>
									)}
								</div>
							))
						)}
					</div>
				))}
			</div>
		</PopUpPanel>
	)
}
