import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import {
	TimelineComplete,
	TimelineCompleteGenerationVersions,
	TimelineObjGeneric,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { BaseModel } from '../../modelBase.js'
import { ReadonlyDeep } from 'type-fest'
import { ExpectedPackageDBFromStudioBaselineObjects } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemStudio } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'

export interface StudioPlayoutModelBaseReadonly {
	/**
	 * All of the PeripheralDevices that belong to the Studio of this RundownPlaylist
	 */
	readonly peripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	/**
	 * Get the Timeline for the current Studio
	 */
	get timeline(): TimelineComplete | null

	/**
	 * Whether this Studio is operating in multi-gateway mode
	 */
	readonly isMultiGatewayMode: boolean
}

export interface StudioPlayoutModelBase extends StudioPlayoutModelBaseReadonly {
	/**
	 * Update the ExpectedPackages for the StudioBaseline of the current Studio
	 * @param packages ExpectedPackages to store
	 */
	setExpectedPackagesForStudioBaseline(packages: ExpectedPackageDBFromStudioBaselineObjects[]): void
	/**
	 * Update the ExpectedPlayoutItems for the StudioBaseline of the current Studio
	 * @param playoutItems ExpectedPlayoutItems to store
	 */
	setExpectedPlayoutItemsForStudioBaseline(playoutItems: ExpectedPlayoutItemStudio[]): void

	/**
	 * Update the Timeline for the current Studio
	 * @param timelineObjs Timeline objects to be run in the Studio
	 * @param generationVersions Details about the versions where these objects were generated
	 */
	setTimeline(
		timelineObjs: TimelineObjGeneric[],
		generationVersions: TimelineCompleteGenerationVersions,
		regenerateTimelineToken: string | undefined
	): ReadonlyDeep<TimelineComplete>
}

/**
 * A view of a `Studio` and its RundownPlaylists for playout when a RundownPlaylist is not activated
 */
export interface StudioPlayoutModel extends StudioPlayoutModelBase, BaseModel {
	readonly isStudio: true

	/**
	 * The unwrapped RundownPlaylists in this Studio
	 */
	readonly rundownPlaylists: ReadonlyDeep<DBRundownPlaylist[]>

	/**
	 * Get any activated RundownPlaylists in this Studio
	 * Note: This should return one or none, but could return more if in a bad state
	 * @param excludeRundownPlaylistId Ignore a given RundownPlaylist, useful to see if any other RundownPlaylists are active
	 */
	getActiveRundownPlaylists(excludeRundownPlaylistId?: RundownPlaylistId): ReadonlyDeep<DBRundownPlaylist[]>

	/**
	 * Update the active state of a RouteSet
	 * @param routeSetId The RouteSet to update
	 * @param isActive The new active state of the RouteSet
	 * @returns Whether the change may affect timeline generation
	 */
	switchRouteSet(routeSetId: string, isActive: boolean | 'toggle'): boolean
}
