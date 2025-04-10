import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
	StudioRouteSet,
	StudioRouteSetExclusivityGroup,
	StudioRouteBehavior,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import classNames from 'classnames'
import { RouteSetOverrideIcon } from '../../lib/ui/icons/switchboard'
import Tooltip from 'rc-tooltip'
import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib'
import { PopUpPanel } from './PopUpPanel'

interface IProps {
	onStudioRouteSetSwitch?: (
		e: React.MouseEvent<HTMLElement>,
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
				<h2 className="mhn mvn">{t('Switchboard')}</h2>
				{Object.entries<[string, StudioRouteSet][]>(exclusivityGroups).map(([key, routeSets]) => (
					<div className="switchboard-pop-up-panel__group" key={key}>
						{props.studioRouteSetExclusivityGroups[key]?.name && (
							<p className="mhs mbs mtn">{props.studioRouteSetExclusivityGroups[key]?.name}</p>
						)}
						{routeSets.length === 2 &&
						routeSets[0][1].behavior === StudioRouteBehavior.ACTIVATE_ONLY &&
						routeSets[1][1].behavior === StudioRouteBehavior.ACTIVATE_ONLY ? (
							<div key={routeSets[0][0]} className="switchboard-pop-up-panel__group__controls dual mhm mbs">
								<span
									className={classNames({
										'switchboard-pop-up-panel__group__controls__active': routeSets[0][1].active,
										'switchboard-pop-up-panel__group__controls__inactive': !routeSets[0][1].active,
									})}
								>
									{routeSets[0][1].name}
								</span>
								<a
									className={classNames('switch-button', 'sb-nocolor', {
										'sb-on': routeSets[1][1].active,
									})}
									role="button"
									onClick={(e) =>
										props.onStudioRouteSetSwitch &&
										props.onStudioRouteSetSwitch(
											e,
											routeSets[0][1].active ? routeSets[1][0] : routeSets[0][0],
											routeSets[0][1].active ? routeSets[1][1] : routeSets[0][1],
											true
										)
									}
									tabIndex={0}
								>
									<div className="sb-content">
										<div className="sb-label">
											<span className="mls">&nbsp;</span>
											<span className="mrs right">&nbsp;</span>
										</div>
										<div className="sb-switch"></div>
									</div>
								</a>
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
								<div key={id} className="switchboard-pop-up-panel__group__controls mhm mbs">
									<span
										className={classNames({
											'switchboard-pop-up-panel__group__controls__active': !routeSet.active,
											'switchboard-pop-up-panel__group__controls__inactive': routeSet.active,
										})}
									>
										{t('Off')}
									</span>
									<a
										className={classNames('switch-button', 'sb-nocolor', {
											'sb-on': routeSet.active,
										})}
										role="button"
										onClick={(e) =>
											!(routeSet.active && routeSet.behavior === StudioRouteBehavior.ACTIVATE_ONLY) &&
											props.onStudioRouteSetSwitch &&
											props.onStudioRouteSetSwitch(e, id, routeSet, !routeSet.active)
										}
										tabIndex={0}
									>
										<div className="sb-content">
											<div className="sb-label">
												<span className="mls">&nbsp;</span>
												<span className="mrs right">&nbsp;</span>
											</div>
											<div className="sb-switch"></div>
										</div>
									</a>
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
