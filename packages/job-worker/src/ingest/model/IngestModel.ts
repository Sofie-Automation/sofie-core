import type { ExpectedPackageIngestSource } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPlayoutItemRundown } from '@sofie-automation/corelib/dist/dataModel/ExpectedPlayoutItem'
import {
	ExpectedPackageId,
	PartId,
	PieceId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown, RundownOrphanedReason, RundownSource } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { CoreUserEditingDefinition } from '@sofie-automation/corelib/dist/dataModel/UserEditingDefinitions'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { LazyInitialiseReadonly } from '../../lib/lazy.js'
import type { PlaylistLock, RundownLock } from '../../jobs/lock.js'
import { IngestSegmentModel, IngestSegmentModelReadonly } from './IngestSegmentModel.js'
import { IngestPartModel, IngestPartModelReadonly } from './IngestPartModel.js'
import { ReadonlyDeep } from 'type-fest'
import { BaseModel } from '../../modelBase.js'
import { Piece, PieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { RundownNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { ProcessedShowStyleBase, ProcessedShowStyleVariant } from '../../jobs/showStyle.js'
import { WrappedShowStyleBlueprint } from '../../blueprints/cache.js'
import { IBlueprintRundown } from '@sofie-automation/blueprints-integration'
import type { INotificationsModel } from '../../notifications/NotificationsModel.js'
import type { IngestExpectedPackage } from './IngestExpectedPackage.js'

export interface IngestModelReadonly {
	/**
	 * The Id of the Rundown this IngestModel operates for
	 */
	readonly rundownId: RundownId
	/**
	 * The externalId (NRCS id) of the Rundown this IngestModel operates for
	 */
	readonly rundownExternalId: string
	/**
	 * Reference to the lock for the Rundown
	 */
	readonly rundownLock: RundownLock

	/**
	 * The ExpectedPlayoutItems for the baseline of this Rundown
	 */
	readonly expectedPlayoutItemsForRundownBaseline: ReadonlyDeep<ExpectedPlayoutItemRundown>[]

	/**
	 * The ExpectedPackages for the baseline of this Rundown
	 */
	readonly expectedPackagesForRundownBaseline: ReadonlyDeep<IngestExpectedPackage>[]

	/**
	 * The baseline Timeline objects of this Rundown
	 */
	readonly rundownBaselineTimelineObjects: LazyInitialiseReadonly<PieceTimelineObjectsBlob>

	/**
	 * The baseline AdLib Pieces of this Rundown
	 */
	readonly rundownBaselineAdLibPieces: LazyInitialiseReadonly<ReadonlyDeep<RundownBaselineAdLibItem[]>>

	/**
	 * The baseline AdLib Actions of this Rundown
	 */
	readonly rundownBaselineAdLibActions: LazyInitialiseReadonly<ReadonlyDeep<RundownBaselineAdLibAction[]>>

	/**
	 * The Rundown this IngestModel operates for
	 */
	readonly rundown: ReadonlyDeep<DBRundown> | undefined

	/**
	 * Gets the Rundown wrapped by this Model, or throws if it does not exist
	 */
	getRundown(): ReadonlyDeep<DBRundown>

	/**
	 * Get a Segment from the Rundown by `externalId`
	 * @param id Id of the Segment
	 */
	getSegmentByExternalId(externalId: string): IngestSegmentModelReadonly | undefined

	/**
	 * Get the internal `_id` of a segment from the `externalId`
	 * @param externalId External id of the Segment
	 */
	getSegmentIdFromExternalId(externalId: string): SegmentId

	/**
	 * Get a Segment from the Rundown
	 * @param id Id of the Segment
	 */
	getSegment(id: SegmentId): IngestSegmentModelReadonly | undefined
	/**
	 * Get the Segments of this Rundown, in no particular order
	 */
	getAllSegments(): IngestSegmentModelReadonly[]

	/**
	 * Get the Segments of this Rundown, in order
	 */
	getOrderedSegments(): IngestSegmentModelReadonly[]

	/**
	 * Get the Parts of this Rundown, in order
	 */
	getAllOrderedParts(): IngestPartModelReadonly[]

	/**
	 * Get the Pieces in this Rundown, in no particular order
	 */
	getAllPieces(): ReadonlyDeep<Piece>[]

	/**
	 * Get the Pieces which belong to the Rundown, not a Part
	 */
	getGlobalPieces(): ReadonlyDeep<Piece>[]

	/**
	 * Search for a Part through the whole Rundown
	 * @param id Id of the Part
	 */
	findPart(partId: PartId): IngestPartModelReadonly | undefined

	/**
	 * Search for an AdLibPiece in all Parts of the Rundown
	 * @param id Id of the AdLib Piece
	 */
	findAdlibPiece(adLibPieceId: PieceId): ReadonlyDeep<AdLibPiece> | undefined

	/**
	 * Search for an ExpectedPackage through the whole Rundown
	 * @param id Id of the ExpectedPackage
	 */
	findExpectedPackageIngestSources(packageId: ExpectedPackageId): ReadonlyDeep<ExpectedPackageIngestSource>[]
}

export interface IngestModel extends IngestModelReadonly, BaseModel, INotificationsModel {
	/**
	 * Search for a Part through the whole Rundown
	 * @param id Id of the Part
	 */
	findPart(partId: PartId): IngestPartModel | undefined

	/**
	 * Get a Segment from the Rundown by `externalId`
	 * @param id Id of the Segment
	 */
	getSegmentByExternalId(externalId: string): IngestSegmentModel | undefined

	/**
	 * Get a Segment from the Rundown
	 * @param id Id of the Segment
	 */
	getSegment(id: SegmentId): IngestSegmentModel | undefined
	/**
	 * Get the Segments of this Rundown, in order
	 */
	getAllSegments(): IngestSegmentModel[]

	/**
	 * Get the Segments of this Rundown, in order
	 */
	getOrderedSegments(): IngestSegmentModel[]

	/**
	 * Get the Parts of this Rundown, in order
	 */
	getAllOrderedParts(): IngestPartModel[]

	/**
	 * Remove a Segment from this Rundown
	 * @param id Id of the Segment
	 */
	removeSegment(id: SegmentId): void

	/**
	 * Replace or insert a Segment in this Rundown
	 * @param segment New Segment data
	 */
	replaceSegment(segment: IngestReplaceSegmentType): IngestSegmentModel

	/**
	 * Change the id of a Segment in this Rundown.
	 * All child documents of the Segment will be updated to reflect this rename
	 * @param oldId Old id of the Segment
	 * @param newId New id of the Segment
	 */
	changeSegmentId(oldId: SegmentId, newId: SegmentId): void

	/**
	 * Set the ExpectedPlayoutItems for the baseline of this Rundown
	 * @param expectedPlayoutItems The new ExpectedPlayoutItems
	 */
	setExpectedPlayoutItemsForRundownBaseline(expectedPlayoutItems: ExpectedPlayoutItemRundown[]): void

	/**
	 * Set the data for this Rundown.
	 * This will either update or create the Rundown
	 * @param rundownData The blueprint Rundown data
	 * @param showStyleBase The ShowStyleBase to be used for the Rundown
	 * @param showStyleVariant The ShowStyleVariant to be used for the Rundown
	 * @param showStyleBlueprint The ShowStyle bleprint used for the Rundown
	 * @param peripheralDevice The PeripheralDevice that created the Rundown, if any
	 * @param rundownNotes Any user facing notes generated during the creation of this Rundown
	 */
	setRundownData(
		rundownData: IBlueprintRundown,
		showStyleBase: ReadonlyDeep<ProcessedShowStyleBase>,
		showStyleVariant: ReadonlyDeep<ProcessedShowStyleVariant>,
		showStyleBlueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
		source: RundownSource,
		rundownNotes: RundownNote[],
		userEdits: CoreUserEditingDefinition[] | undefined
	): ReadonlyDeep<DBRundown>

	/**
	 * Set the baseline object and adlibs for this Rundown
	 * @param timelineObjectsBlob Rundown baseline timeline objects
	 * @param adlibPieces Rundown adlib pieces
	 * @param adlibActions Rundown adlib actions
	 * @param pieces Rundown owned pieces
	 */
	setRundownBaseline(
		timelineObjectsBlob: PieceTimelineObjectsBlob,
		adlibPieces: RundownBaselineAdLibItem[],
		adlibActions: RundownBaselineAdLibAction[],
		pieces: Piece[],
		expectedPackages: IngestExpectedPackage[]
	): Promise<void>

	/**
	 * Mark this Rundown as being orphaned
	 * @param orphaned New orphaned state
	 */
	setRundownOrphaned(orphaned: RundownOrphanedReason | undefined): void

	/**
	 * Set the parent RundownPlaylist of this Rundown
	 * This is only allowed when the id has not be set by the User
	 * @param playlistId Id of the RundownPlaylist
	 */
	setRundownPlaylistId(playlistId: RundownPlaylistId): void

	/**
	 * Set the AirStatus for this Rundown
	 * This is an indicator for the blueprints
	 * @param status Rundown air status
	 */
	setRundownAirStatus(status: string | undefined): void
}

export type IngestReplaceSegmentType = Omit<DBSegment, '_id' | 'rundownId'>

export interface IngestDatabasePersistedModel {
	/**
	 * Issue a save of the contents of this model to the database
	 */
	saveAllToDatabase(lock: PlaylistLock): Promise<void>
}
