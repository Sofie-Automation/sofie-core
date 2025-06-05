import { StudioRouteSet } from '@sofie-automation/shared-lib/dist/core/model/StudioRouteSet'

export interface IRouteSetMethods {
	/** Returns a list of the Routesets */
	listRouteSets(): Promise<Record<string, StudioRouteSet>>

	/** Switch RouteSet State */
	switchRouteSet(routeSetId: string, state: boolean | 'toggle'): Promise<void>
}
