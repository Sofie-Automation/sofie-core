import { IDirectCollections } from '../db/index.js'
import { ReadonlyDeep } from 'type-fest'
import { WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache.js'
import {
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ApmSpan } from '../profiler.js'
import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { EventsJobFunc } from '@sofie-automation/corelib/dist/worker/events'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ProcessedShowStyleConfig, ProcessedStudioConfig } from '../blueprints/config.js'
import { StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { PlaylistLock, RundownLock } from './lock.js'
import { BaseModel } from '../modelBase.js'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { ProcessedShowStyleBase, ProcessedShowStyleVariant, ProcessedShowStyleCompound } from './showStyle.js'
import { JobStudio } from './studio.js'

export { ApmSpan }
export { ProcessedShowStyleVariant, ProcessedShowStyleBase, ProcessedShowStyleCompound }
export { JobStudio }

/**
 * Context for any job run in the job-worker
 */
export interface JobContext extends StudioCacheContext {
	/** Internal: Track a cache, to check it was saved at the end of the job */
	trackCache(cache: BaseModel): void

	/** Aquire the PlayoutModel/write lock for a Playlist */
	lockPlaylist(playlistId: RundownPlaylistId): Promise<PlaylistLock>
	/** Aquire the IngestModel/write lock for a Rundown */
	lockRundown(rundownId: RundownId): Promise<RundownLock>

	/** Start an APM span, if there is an active APM transaction */
	startSpan(name: string): ApmSpan | null

	/**
	 * Queue an Ingest job to be run
	 * It is not possible to wait for the result. This ensures the threads don't get deadlocked
	 * @param name Name of the job
	 * @param data Data for the job
	 * @returns Promise which resolves once successfully queued
	 */
	queueIngestJob<T extends keyof IngestJobFunc>(name: T, data: Parameters<IngestJobFunc[T]>[0]): Promise<void>
	/**
	 * Queue a Studio job to be run
	 * It is not possible to wait for the result. This ensures the threads don't get deadlocked
	 * @param name Name of the job
	 * @param data Data for the job
	 * @returns Promise which resolves once successfully queued
	 */
	queueStudioJob<T extends keyof StudioJobFunc>(name: T, data: Parameters<StudioJobFunc[T]>[0]): Promise<void>
	/**
	 * Queue an Event job to be run
	 * It is not possible to wait for the result. This ensures the threads don't get deadlocked
	 * @param name Name of the job
	 * @param data Data for the job
	 * @returns Promise which resolves once successfully queued
	 */
	queueEventJob<T extends keyof EventsJobFunc>(name: T, data: Parameters<EventsJobFunc[T]>[0]): Promise<void>

	/** Hack: fast-track the timeline out to the playout-gateway. */
	hackPublishTimelineToFastTrack(newTimeline: TimelineComplete): void

	/**
	 * Set whether a routeset for this studio is active.
	 * Any routeset `exclusivityGroup` will be respected.
	 * The changes will be immediately visible in subsequent calls to the `studio` getter
	 * @param routeSetId The routeSetId to change
	 * @param isActive Whether the routeSet should be active, or toggle
	 * @returns Whether the change could affect playout
	 */
	setRouteSetActive(routeSetId: string, isActive: boolean | 'toggle'): boolean

	/**
	 * Save any changes to the routesets for this studio to the database
	 */
	saveRouteSetChanges(): Promise<void>

	/**
	 * Discard any unsaved changes to the routesets for this studio
	 */
	discardRouteSetChanges(): void
}

/**
 * Base Context available for any operation run in the job-worker
 */
export interface StudioCacheContext {
	/**
	 * Direct MongoDB Collections
	 * Where possible it is preferable to use a Cache, or one of the caching methods on this context
	 * Using this incorrectly can result in data races
	 */
	readonly directCollections: Readonly<IDirectCollections>

	/**
	 * Id of the Studio the job belongs to
	 */
	readonly studioId: StudioId
	/**
	 * The Studio the job belongs to.
	 * This has any ObjectWithOverrides in their computed/flattened form
	 */
	readonly studio: ReadonlyDeep<JobStudio>

	/**
	 * The Studio the job belongs to
	 * This has any ObjectWithOverrides in their original form
	 */
	readonly rawStudio: ReadonlyDeep<DBStudio>

	/**
	 * Blueprint for the studio the job belongs to
	 */
	readonly studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>

	/**
	 * Processed Blueprint config for the studio the job belongs to
	 * @returns Processed configuration blob
	 */
	getStudioBlueprintConfig(): ProcessedStudioConfig

	/**
	 * Get the ShowStyleBases that are allowed in the Studio
	 * @returns Array of ShowStyleBase
	 */
	getShowStyleBases(): Promise<ReadonlyDeep<Array<ProcessedShowStyleBase>>>
	/**
	 * Get a specific ShowStyleBase which is allowed in the Studio
	 * @param id Id of the ShowStyleBase
	 * @returns The ShowStyleBase
	 * @throws If not found or not allowed in the Studio
	 */
	getShowStyleBase(id: ShowStyleBaseId): Promise<ReadonlyDeep<ProcessedShowStyleBase>>
	/**
	 * Get the ShowStyleVariants for a specific ShowStyleBase which is allowed in the Studio
	 * @param id Id of the ShowStyleBase the variants belong to
	 * @returns Array of ProcessedShowStyleVariant
	 * @throws If ShowStyleBase is not found or not allowed in the Studio
	 */
	getShowStyleVariants(id: ShowStyleBaseId): Promise<ReadonlyDeep<Array<ProcessedShowStyleVariant>>>
	/**
	 * Get a specific ShowStyleVariant which is allowed in the Studio
	 * @param id Id of the ShowStyleVariant
	 * @returns The ShowStyleVariant
	 * @throws If not found or not allowed in the Studio
	 */
	getShowStyleVariant(id: ShowStyleVariantId): Promise<ReadonlyDeep<ProcessedShowStyleVariant>>
	/**
	 * Get a ShowStyleCompound for a ShowStyleVariant which is allowed in the Studio
	 * @param variantId Id of the ShowStyleVariant
	 * @param baseId (Optional) If known, the id of the ShowStyleBase. This is a Performance optimisation to allow the documents to be loaded in parallel
	 * @returns The ShowStyleCompound
	 * @throws If not found or not allowed in the Studio
	 */
	getShowStyleCompound(
		variantId: ShowStyleVariantId,
		baseId?: ShowStyleBaseId
	): Promise<ReadonlyDeep<ProcessedShowStyleCompound>>

	/**
	 * Processed Blueprint config for the provided ShowStyle
	 * @param id Id of the ShowStyleBase to get the Blueprint for
	 * @returns Blueprint for the ShowStyle
	 */
	getShowStyleBlueprint(id: ShowStyleBaseId): Promise<ReadonlyDeep<WrappedShowStyleBlueprint>>
	/**
	 * Processed Blueprint config for the provided ShowStyle
	 * @param showStyle The ShowStyle to get the processed configuration
	 * @returns Processed configuration blob
	 * @throws If the blueprint for the ShowStyle has not yet been loaded
	 */
	getShowStyleBlueprintConfig(showStyle: ReadonlyDeep<ProcessedShowStyleCompound>): ProcessedShowStyleConfig
}
