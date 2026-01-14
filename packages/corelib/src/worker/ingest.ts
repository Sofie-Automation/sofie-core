import {
	BucketAdLibActionId,
	BucketAdLibId,
	BucketId,
	ExpectedPackageId,
	RundownId,
	SegmentId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '../dataModel/Ids.js'
import type { MOS } from '@sofie-automation/shared-lib/dist/mos'
import {
	IngestAdlib,
	IngestPart,
	IngestRundown,
	IngestSegment,
	UserOperationTarget,
} from '@sofie-automation/blueprints-integration'
import { BucketAdLibAction } from '../dataModel/BucketAdLibAction.js'
import { RundownSource } from '../dataModel/Rundown.js'

export enum IngestJobs {
	/**
	 * Attempt to remove a rundown, or orphan it
	 */
	RemoveRundown = 'removeRundown',
	/**
	 * Insert or update a rundown with a new IngestRundown
	 */
	UpdateRundown = 'updateRundown',
	/**
	 * Update a rundown from a new IngestRundown (ingoring IngestSegments)
	 */
	UpdateRundownMetaData = 'updateRundownMetaData',
	/**
	 * Attempt to remove a segment, or orphan it
	 */
	RemoveSegment = 'removeSegment',
	/**
	 * Insert or update a segment from a new IngestSegment
	 */
	UpdateSegment = 'updateSegment',
	/**
	 * Update the ranks of the Segments in a Rundown
	 */
	UpdateSegmentRanks = 'updateSegmentRanks',
	/**
	 * Remove a Part from a Segment
	 */
	RemovePart = 'removePart',
	/**
	 * Insert or update a Part in a Segment
	 */
	UpdatePart = 'updatePart',
	/**
	 * Regnerate a Rundown from the cached IngestRundown
	 */
	RegenerateRundown = 'regenerateRundown',
	/**
	 * Regnerate a Segment from the cached IngestSegment
	 */
	RegenerateSegment = 'regenerateSegment',

	/**
	 * Check for and remove any orphaned segments if their contents are no longer on air
	 */
	RemoveOrphanedSegments = 'removeOrphanedSegments',

	/**
	 * Insert or update a mos rundown
	 */
	MosRundown = 'mosRundown',
	/**
	 * Update the payload of a mos rundown, without changing any parts or segments
	 */
	MosRundownMetadata = 'mosRundownMetadata',
	/**
	 * Update the status of a mos rundown
	 */
	MosRundownStatus = 'mosRundownStatus',
	/**
	 * Update the ready to air state of a mos rundown
	 */
	MosRundownReadyToAir = 'mosRundownReadyToAir',
	/**
	 * Update the payload of a mos story
	 */
	MosFullStory = 'mosFullStory',
	/**
	 * Delete a mos story
	 */
	MosDeleteStory = 'mosDeleteStory',
	/**
	 * Insert a mos story before the referenced existing story
	 */
	MosInsertStory = 'mosInsertStory',
	/**
	 * Move a list of mos stories
	 */
	MosMoveStory = 'mosMoveStory',
	/**
	 * Swap positions of two mos stories
	 */
	MosSwapStory = 'mosSwapStory',

	/**
	 * Some PackageInfos have been updated, regenerate any Parts which depend on these PackageInfos
	 */
	PackageInfosUpdatedRundown = 'packageInfosUpdatedRundown',

	/**
	 * User requested removing a rundown
	 */
	UserRemoveRundown = 'userRemoveRundown',
	/**
	 * User requested unsyncing a rundown
	 */
	UserUnsyncRundown = 'userUnsyncRundown',

	/**
	 * User executed a change operation
	 */
	UserExecuteChangeOperation = 'userExecuteChangeOperation',

	// For now these are in this queue, but if this gets split up to be per rundown, then a single bucket queue will be needed
	BucketItemImport = 'bucketItemImport',
	BucketItemRegenerate = 'bucketItemRegenerate',
	BucketActionRegenerateExpectedPackages = 'bucketActionRegenerateExpectedPackages',
	BucketActionModify = 'bucketActionModify',
	BucketPieceModify = 'bucketPieceModify',
	BucketRemoveAdlibPiece = 'bucketRemoveAdlibPiece',
	BucketRemoveAdlibAction = 'bucketRemoveAdlibAction',
	BucketEmpty = 'bucketEmpty',

	/**
	 * Create a testing rundown for the specified ShowStyleVariant
	 */
	CreateAdlibTestingRundownForShowStyleVariant = 'createAdlibTestingRundownForShowStyleVariant',
}

export interface IngestPropsBase {
	rundownExternalId: string
}
export interface IngestRemoveRundownProps extends IngestPropsBase {
	forceDelete?: boolean
}
export interface IngestUpdateRundownProps extends IngestPropsBase {
	ingestRundown: IngestRundown
	isCreateAction: boolean // TODO: Document what isCreateAction means

	rundownSource: RundownSource
}
export interface IngestUpdateRundownMetaDataProps extends IngestPropsBase {
	ingestRundown: Omit<IngestRundown, 'segments'>

	rundownSource: RundownSource
}
export interface IngestRemoveSegmentProps extends IngestPropsBase {
	segmentExternalId: string
}
export interface IngestUpdateSegmentProps extends IngestPropsBase {
	ingestSegment: IngestSegment
	isCreateAction: boolean // TODO: Document what isCreateAction means
}
export interface IngestUpdateSegmentRanksProps extends IngestPropsBase {
	newRanks: { [segmentExternalId: string]: number }
}
export interface IngestRemovePartProps extends IngestPropsBase {
	segmentExternalId: string
	partExternalId: string
}
export interface IngestUpdatePartProps extends IngestPropsBase {
	segmentExternalId: string
	ingestPart: IngestPart
	isCreateAction: boolean // TODO: Document what isCreateAction means
}
export type IngestRegenerateRundownProps = IngestPropsBase
export interface IngestRegenerateSegmentProps extends IngestPropsBase {
	segmentExternalId: string
}

export interface RemoveOrphanedSegmentsProps extends IngestPropsBase {
	orphanedDeletedSegmentIds: SegmentId[]
	orphanedHiddenSegmentIds: SegmentId[]
}

export interface MosRundownProps extends IngestPropsBase {
	mosRunningOrder: MOS.IMOSRunningOrder
	/**
	 * True if this was an update operation from the ingest gateway.
	 * If true, it will fail if the Rundown does not already exist
	 */
	isUpdateOperation: boolean

	rundownSource: RundownSource
}
export interface MosRundownMetadataProps extends IngestPropsBase {
	mosRunningOrderBase: MOS.IMOSRunningOrderBase
	rundownSource: RundownSource
}
export interface MosRundownStatusProps extends IngestPropsBase {
	status: string
}
export interface MosRundownReadyToAirProps extends IngestPropsBase {
	status: string
}
export interface MosFullStoryProps extends IngestPropsBase {
	story: MOS.IMOSROFullStory
}
export interface MosDeleteStoryProps extends IngestPropsBase {
	stories: MOS.IMOSString128[]
}
export interface MosInsertStoryProps extends IngestPropsBase {
	insertBeforeStoryId: MOS.IMOSString128 | null
	replace: boolean
	newStories: MOS.IMOSROStory[]
}
export interface MosMoveStoryProps extends IngestPropsBase {
	insertBeforeStoryId: MOS.IMOSString128 | null
	stories: MOS.IMOSString128[]
}
export interface MosSwapStoryProps extends IngestPropsBase {
	story0: MOS.IMOSString128
	story1: MOS.IMOSString128
}

export interface PackageInfosUpdatedRundownProps extends IngestPropsBase {
	packageIds: ExpectedPackageId[]
}

export interface UserRundownPropsBase {
	rundownId: RundownId
}
export interface UserRemoveRundownProps extends UserRundownPropsBase {
	force?: boolean
}
export type UserUnsyncRundownProps = UserRundownPropsBase

export interface UserExecuteChangeOperationProps extends IngestPropsBase {
	operationTarget: UserOperationTarget
	operation: { id: string; [key: string]: any }
}

export interface BucketItemImportProps {
	bucketId: BucketId
	showStyleBaseId: ShowStyleBaseId
	showStyleVariantIds?: ShowStyleVariantId[]
	payload: IngestAdlib
}
export interface BucketItemRegenerateProps {
	bucketId: BucketId
	externalId: string
}
export interface BucketActionRegenerateExpectedPackagesProps {
	actionId: BucketAdLibActionId
}
export interface BucketActionModifyProps {
	actionId: BucketAdLibActionId
	props: Partial<Omit<BucketAdLibAction, '_id'>>
}
export interface BucketPieceModifyProps {
	pieceId: BucketAdLibId
	props: Partial<Omit<BucketAdLibAction, '_id'>>
}
export interface BucketRemoveAdlibPieceProps {
	pieceId: BucketAdLibId
}
export interface BucketRemoveAdlibActionProps {
	actionId: BucketAdLibActionId
}
export interface BucketEmptyProps {
	bucketId: BucketId
}

export interface CreateAdlibTestingRundownForShowStyleVariantProps {
	showStyleVariantId: ShowStyleVariantId
}

/**
 * Set of valid functions, of form:
 * `id: (data) => return`
 */
export type IngestJobFunc = {
	[IngestJobs.RemoveRundown]: (data: IngestRemoveRundownProps) => void
	[IngestJobs.UpdateRundown]: (data: IngestUpdateRundownProps) => void
	[IngestJobs.UpdateRundownMetaData]: (data: IngestUpdateRundownMetaDataProps) => void
	[IngestJobs.RemoveSegment]: (data: IngestRemoveSegmentProps) => void
	[IngestJobs.UpdateSegment]: (data: IngestUpdateSegmentProps) => void
	[IngestJobs.UpdateSegmentRanks]: (data: IngestUpdateSegmentRanksProps) => void
	[IngestJobs.RemovePart]: (data: IngestRemovePartProps) => void
	[IngestJobs.UpdatePart]: (data: IngestUpdatePartProps) => void
	[IngestJobs.RegenerateRundown]: (data: IngestRegenerateRundownProps) => void
	[IngestJobs.RegenerateSegment]: (data: IngestRegenerateSegmentProps) => void

	[IngestJobs.RemoveOrphanedSegments]: (data: RemoveOrphanedSegmentsProps) => void

	[IngestJobs.MosRundown]: (data: MosRundownProps) => void
	[IngestJobs.MosRundownMetadata]: (data: MosRundownMetadataProps) => void
	[IngestJobs.MosRundownStatus]: (data: MosRundownStatusProps) => void
	[IngestJobs.MosRundownReadyToAir]: (data: MosRundownReadyToAirProps) => void
	[IngestJobs.MosFullStory]: (data: MosFullStoryProps) => void
	[IngestJobs.MosDeleteStory]: (data: MosDeleteStoryProps) => void
	[IngestJobs.MosInsertStory]: (data: MosInsertStoryProps) => void
	[IngestJobs.MosMoveStory]: (data: MosMoveStoryProps) => void
	[IngestJobs.MosSwapStory]: (data: MosSwapStoryProps) => void

	[IngestJobs.PackageInfosUpdatedRundown]: (data: PackageInfosUpdatedRundownProps) => void

	[IngestJobs.UserRemoveRundown]: (data: UserRemoveRundownProps) => void
	[IngestJobs.UserUnsyncRundown]: (data: UserUnsyncRundownProps) => void
	[IngestJobs.UserExecuteChangeOperation]: (data: UserExecuteChangeOperationProps) => void

	[IngestJobs.BucketItemImport]: (data: BucketItemImportProps) => void
	[IngestJobs.BucketItemRegenerate]: (data: BucketItemRegenerateProps) => void
	[IngestJobs.BucketActionModify]: (data: BucketActionModifyProps) => void
	[IngestJobs.BucketPieceModify]: (data: BucketPieceModifyProps) => void
	[IngestJobs.BucketActionRegenerateExpectedPackages]: (data: BucketActionRegenerateExpectedPackagesProps) => void
	[IngestJobs.BucketRemoveAdlibPiece]: (data: BucketRemoveAdlibPieceProps) => void
	[IngestJobs.BucketRemoveAdlibAction]: (data: BucketRemoveAdlibActionProps) => void
	[IngestJobs.BucketEmpty]: (data: BucketEmptyProps) => void

	[IngestJobs.CreateAdlibTestingRundownForShowStyleVariant]: (
		data: CreateAdlibTestingRundownForShowStyleVariantProps
	) => RundownId
}

// Future: there should probably be a queue per rundown or something. To be improved later
export function getIngestQueueName(studioId: StudioId): string {
	return `ingest:${studioId}`
}
