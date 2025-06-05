import { BlueprintMapping } from './Timeline.js'
import { TSR } from '../../tsr.js'

export type AbPlayerId = number | string

export interface StudioRouteSetExclusivityGroup {
	name: string
}

export interface StudioRouteSet {
	/** User-presentable name */
	name: string
	/** Whether this group is active or not */
	active: boolean
	/** Default state of this group */
	defaultActive?: boolean
	/** Only one Route can be active at the same time in the exclusivity-group */
	exclusivityGroup?: string
	/** If true, should be displayed and toggleable by user */
	behavior: StudioRouteBehavior

	routes: RouteMapping[]
	/**
	 * AB Pool members
	 * An AB player will be active if either no routesets reference it, or any active routset references it.
	 * Specify the players here which this routeset should enable
	 */
	abPlayers: StudioAbPlayerDisabling[]
}

export enum StudioRouteBehavior {
	HIDDEN = 0,
	TOGGLE = 1,
	ACTIVATE_ONLY = 2,
}

export enum StudioRouteType {
	/** Default */
	REROUTE = 0,
	/** Replace all properties with a new mapping */
	REMAP = 1,
}

export interface RouteMapping extends ResultingMappingRoute {
	/** Which original layer to route. If false, a "new" layer will be inserted during routing */
	mappedLayer: string | undefined
}

export interface StudioAbPlayerDisabling {
	poolName: string
	playerId: AbPlayerId
}

export interface ResultingMappingRoutes {
	/** Routes that route existing layers */
	existing: {
		[mappedLayer: string]: ResultingMappingRoute[]
	}
	/** Routes that create new layers, from nothing */
	inserted: ResultingMappingRoute[]
}
export interface ResultingMappingRoute {
	outputMappedLayer: string
	deviceType?: TSR.DeviceType
	remapping?: Partial<BlueprintMapping>
	routeType: StudioRouteType
}
