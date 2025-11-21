import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { deserializePieceTimelineObjectsBlob, PieceGeneric } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	PieceInstance,
	PieceInstancePiece,
	ResolvedPieceInstance,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown, Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import {
	CoreUserEditingDefinition,
	CoreUserEditingDefinitionAction,
	CoreUserEditingDefinitionForm,
	CoreUserEditingProperties,
	CoreUserEditingDefinitionSofie,
} from '@sofie-automation/corelib/dist/dataModel/UserEditingDefinitions'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { assertNever, clone, cloneObject, Complete, literal, omit } from '@sofie-automation/corelib/dist/lib'
import { unprotectString, unprotectStringArray } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import {
	ExpectedPackage,
	ExpectedPlayoutItemGeneric,
	HackPartMediaObjectSubscription,
	IBlueprintActionManifest,
	IBlueprintActionManifestDisplay,
	IBlueprintActionManifestDisplayContent,
	IBlueprintActionTriggerMode,
	IBlueprintAdLibPieceDB,
	IBlueprintConfig,
	IBlueprintMutatablePart,
	IBlueprintPartDB,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceDB,
	IBlueprintPieceGeneric,
	IBlueprintPieceInstance,
	IBlueprintResolvedPieceInstance,
	IBlueprintRundownDB,
	IBlueprintRundownPlaylist,
	IBlueprintSegmentDB,
	IBlueprintSegmentRundown,
	IBlueprintShowStyleBase,
	IBlueprintShowStyleVariant,
	IOutputLayer,
	ISourceLayer,
	PieceAbSessionInfo,
	RundownPlaylistTiming,
} from '@sofie-automation/blueprints-integration'
import { JobContext, ProcessedShowStyleBase, ProcessedShowStyleVariant } from '../../jobs/index.js'
import { DBRundownPlaylist, QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import _ from 'underscore'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import {
	UserEditingDefinition,
	UserEditingDefinitionAction,
	UserEditingDefinitionForm,
	UserEditingProperties,
	UserEditingDefinitionSofieDefault,
	UserEditingType,
} from '@sofie-automation/blueprints-integration/dist/userEditing'
import type { PlayoutMutatablePart } from '../../playout/model/PlayoutPartInstanceModel.js'
import { BlueprintQuickLookInfo } from '@sofie-automation/blueprints-integration/dist/context/quickLoopInfo'
import { IngestPartNotifyItemReady } from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'

/**
 * Convert an object to have all the values of all keys (including optionals) be 'true'
 * This simplifies the definitions for
 */
type AllValuesAsTrue<T> = {
	[K in keyof Required<T>]: true
}
function allKeysOfObject<T>(sample: AllValuesAsTrue<T>): Array<keyof T> {
	return Object.keys(sample) as Array<keyof T>
}

// Compile a list of the keys which are allowed to be set
export const IBlueprintPieceObjectsSampleKeys = allKeysOfObject<IBlueprintPiece>({
	externalId: true,
	enable: true,
	virtual: true,
	pieceType: true,
	extendOnHold: true,
	name: true,
	privateData: true,
	publicData: true,
	sourceLayerId: true,
	outputLayerId: true,
	content: true,
	lifespan: true,
	prerollDuration: true,
	postrollDuration: true,
	toBeQueued: true,
	expectedPlayoutItems: true,
	tags: true,
	expectedPackages: true,
	hasSideEffects: true,
	allowDirectPlay: true,
	notInVision: true,
	abSessions: true,
	userEditOperations: true,
	userEditProperties: true,
	excludeDuringPartKeepalive: true,
})

// Compile a list of the keys which are allowed to be set
export const PlayoutMutatablePartSampleKeys = allKeysOfObject<PlayoutMutatablePart>({
	title: true,
	prompterTitle: true,
	privateData: true,
	publicData: true,
	autoNext: true,
	autoNextOverlap: true,
	inTransition: true,
	disableNextInTransition: true,
	outTransition: true,
	expectedDuration: true,
	holdMode: true,
	shouldNotifyCurrentPlayingPart: true,
	ingestNotifyPartExternalId: true,
	ingestNotifyPartReady: true,
	ingestNotifyItemsReady: true,
	classes: true,
	classesForNext: true,
	displayDurationGroup: true,
	displayDuration: true,
	identifier: true,
	hackListenToMediaObjectUpdates: true,
	userEditOperations: true,
	userEditProperties: true,
})

/*
 * There are all very explicit manual clones of the objects, to only provide the properties the blueprint types state they will have.
 * Note: they are all intended to 'clone' the objects, to avoid mutability concerns
 */

function convertPieceInstanceToBlueprintsInner(
	pieceInstance: ReadonlyDeep<PieceInstance>
): Complete<IBlueprintPieceInstance> {
	const obj: Complete<IBlueprintPieceInstance> = {
		_id: unprotectString(pieceInstance._id),
		partInstanceId: unprotectString(pieceInstance.partInstanceId),
		adLibSourceId: unprotectString(pieceInstance.adLibSourceId),
		dynamicallyInserted: pieceInstance.dynamicallyInserted,
		reportedStartedPlayback: pieceInstance.reportedStartedPlayback,
		reportedStoppedPlayback: pieceInstance.reportedStoppedPlayback,
		infinite: pieceInstance.infinite
			? literal<Complete<IBlueprintPieceInstance['infinite']>>({
					infinitePieceId: unprotectString(pieceInstance.infinite.infinitePieceId),
					fromHold: pieceInstance.infinite.fromHold,
					fromPreviousPart: pieceInstance.infinite.fromPreviousPart,
					fromPreviousPlayhead: pieceInstance.infinite.fromPreviousPlayhead,
				})
			: undefined,
		piece: convertPieceToBlueprints(pieceInstance.piece),
	}

	return obj
}

/**
 * Convert a PieceInstance into IBlueprintPieceInstance, for passing into the blueprints
 * @param pieceInstance the PieceInstance to convert
 * @returns a cloned complete and clean IBlueprintPieceInstance
 */
export function convertPieceInstanceToBlueprints(pieceInstance: ReadonlyDeep<PieceInstance>): IBlueprintPieceInstance {
	return convertPieceInstanceToBlueprintsInner(pieceInstance)
}

/**
 * Convert a ResolvedPieceInstance into IBlueprintResolvedPieceInstance, for passing into the blueprints
 * @param pieceInstance the ResolvedPieceInstance to convert
 * @returns a cloned complete and clean IBlueprintResolvedPieceInstance
 */
export function convertResolvedPieceInstanceToBlueprints(
	pieceInstance: ResolvedPieceInstance
): IBlueprintResolvedPieceInstance {
	const obj: Complete<IBlueprintResolvedPieceInstance> = {
		...convertPieceInstanceToBlueprintsInner(pieceInstance.instance),
		resolvedStart: pieceInstance.resolvedStart,
		resolvedDuration: pieceInstance.resolvedDuration,
	}

	return obj
}

/**
 * Convert a DBPartInstance into IBlueprintPartInstance, for passing into the blueprints
 * @param partInstance the DBPartInstance to convert
 * @returns a cloned complete and clean IBlueprintPartInstance
 */
export function convertPartInstanceToBlueprints(partInstance: ReadonlyDeep<DBPartInstance>): IBlueprintPartInstance {
	const obj: Complete<IBlueprintPartInstance> = {
		_id: unprotectString(partInstance._id),
		segmentId: unprotectString(partInstance.segmentId),
		part: convertPartToBlueprints(partInstance.part),
		rehearsal: partInstance.rehearsal,
		timings: clone(partInstance.timings),
		previousPartEndState: clone(partInstance.previousPartEndState),
		orphaned: partInstance.orphaned,
		blockTakeUntil: partInstance.blockTakeUntil,
	}

	return obj
}

function convertPieceGenericToBlueprintsInner(piece: ReadonlyDeep<PieceGeneric>): Complete<IBlueprintPieceGeneric> {
	const obj: Complete<IBlueprintPieceGeneric> = {
		externalId: piece.externalId,
		name: piece.name,
		privateData: clone(piece.privateData),
		publicData: clone(piece.publicData),
		lifespan: piece.lifespan,
		sourceLayerId: piece.sourceLayerId,
		outputLayerId: piece.outputLayerId,
		prerollDuration: piece.prerollDuration,
		postrollDuration: piece.postrollDuration,
		toBeQueued: piece.toBeQueued,
		expectedPlayoutItems: clone<ExpectedPlayoutItemGeneric[] | undefined>(piece.expectedPlayoutItems),
		tags: clone<string[] | undefined>(piece.tags),
		allowDirectPlay: clone<IBlueprintPieceDB['allowDirectPlay']>(piece.allowDirectPlay),
		expectedPackages: clone<ExpectedPackage.Any[] | undefined>(piece.expectedPackages),
		hasSideEffects: piece.hasSideEffects,
		content: {
			...cloneObject(piece.content),
			timelineObjects: deserializePieceTimelineObjectsBlob(piece.timelineObjectsString),
		},
		abSessions: clone<PieceAbSessionInfo[] | undefined>(piece.abSessions),
	}

	return obj
}

/**
 * Convert a Piece into IBlueprintPieceDB, for passing into the blueprints
 * @param piece the Piece to convert
 * @returns a cloned complete and clean IBlueprintPieceDB
 */
export function convertPieceToBlueprints(piece: ReadonlyDeep<PieceInstancePiece>): IBlueprintPieceDB {
	const obj: Complete<IBlueprintPieceDB> = {
		...convertPieceGenericToBlueprintsInner(piece),
		_id: unprotectString(piece._id),
		enable: clone(piece.enable),
		virtual: piece.virtual,
		pieceType: piece.pieceType,
		extendOnHold: piece.extendOnHold,
		notInVision: piece.notInVision,
		userEditOperations: translateUserEditsToBlueprint(piece.userEditOperations),
		userEditProperties: translateUserEditPropertiesToBlueprint(piece.userEditProperties),
		excludeDuringPartKeepalive: piece.excludeDuringPartKeepalive,
	}

	return obj
}

/**
 * Convert a DBPart into IBlueprintPartDB, for passing into the blueprints
 * @param part the Part to convert
 * @returns a cloned complete and clean IBlueprintPartDB
 */
export function convertPartToBlueprints(part: ReadonlyDeep<DBPart>): IBlueprintPartDB {
	const obj: Complete<IBlueprintPartDB> = {
		_id: unprotectString(part._id),
		segmentId: unprotectString(part.segmentId),
		externalId: part.externalId,
		invalid: part.invalid,
		invalidReason: clone(part.invalidReason),
		untimed: part.untimed,
		floated: part.floated,
		gap: part.gap,
		title: part.title,
		prompterTitle: part.prompterTitle,
		privateData: clone(part.privateData),
		publicData: clone(part.publicData),
		autoNext: part.autoNext,
		autoNextOverlap: part.autoNextOverlap,
		inTransition: clone(part.inTransition),
		disableNextInTransition: part.disableNextInTransition,
		outTransition: clone(part.outTransition),
		expectedDuration: part.expectedDuration,
		holdMode: part.holdMode,
		shouldNotifyCurrentPlayingPart: part.shouldNotifyCurrentPlayingPart,
		ingestNotifyPartExternalId: part.ingestNotifyPartExternalId,
		ingestNotifyPartReady: part.ingestNotifyPartReady,
		ingestNotifyItemsReady: clone<IngestPartNotifyItemReady[] | undefined>(part.ingestNotifyItemsReady),
		classes: clone<string[] | undefined>(part.classes),
		classesForNext: clone<string[] | undefined>(part.classesForNext),
		displayDurationGroup: part.displayDurationGroup,
		displayDuration: part.displayDuration,
		identifier: part.identifier,
		hackListenToMediaObjectUpdates: clone<HackPartMediaObjectSubscription[] | undefined>(
			part.hackListenToMediaObjectUpdates
		),
		userEditOperations: translateUserEditsToBlueprint(part.userEditOperations),
		userEditProperties: translateUserEditPropertiesToBlueprint(part.userEditProperties),
	}

	return obj
}

/**
 * Convert a AdLibPiece into IBlueprintAdLibPieceDB, for passing into the blueprints
 * @param adLib the AdLibPiece to convert
 * @returns a cloned complete and clean IBlueprintAdLibPieceDB
 */
export function convertAdLibPieceToBlueprints(adLib: ReadonlyDeep<AdLibPiece>): IBlueprintAdLibPieceDB {
	const obj: Complete<IBlueprintAdLibPieceDB> = {
		...convertPieceGenericToBlueprintsInner(adLib),
		_id: unprotectString(adLib._id),
		_rank: adLib._rank,
		invalid: adLib.invalid,
		expectedDuration: adLib.expectedDuration,
		floated: adLib.floated,
		currentPieceTags: clone<string[] | undefined>(adLib.currentPieceTags),
		nextPieceTags: clone<string[] | undefined>(adLib.nextPieceTags),
		uniquenessId: adLib.uniquenessId,
		invertOnAirState: adLib.invertOnAirState,
		hidden: adLib.hidden,
	}

	return obj
}

/**
 * Convert a AdLibAction into IBlueprintActionManifest, for passing into the blueprints
 * @param action the AdLibAction to convert
 * @returns a cloned complete and clean IBlueprintActionManifest
 */
export function convertAdLibActionToBlueprints(action: ReadonlyDeep<AdLibAction>): IBlueprintActionManifest {
	const obj: Complete<IBlueprintActionManifest> = {
		externalId: action.externalId,
		actionId: action.actionId,
		userData: clone(action.userData),
		privateData: clone(action.privateData),
		publicData: clone(action.publicData),
		partId: unprotectString(action.partId),
		allVariants: action.allVariants,
		userDataManifest: clone(action.userDataManifest),
		display: clone<IBlueprintActionManifestDisplay | IBlueprintActionManifestDisplayContent>(action.display), // TODO - type mismatch
		triggerModes: clone<IBlueprintActionTriggerMode[] | undefined>(action.triggerModes), // TODO - type mismatch
		expectedPlayoutItems: clone<ExpectedPlayoutItemGeneric[] | undefined>(action.expectedPlayoutItems),
		expectedPackages: clone<ExpectedPackage.Any[] | undefined>(action.expectedPackages),
	}

	return obj
}

/**
 * Convert a DBSegment into IBlueprintSegmentDB, for passing into the blueprints
 * @param segment the DBSegment to convert
 * @returns a cloned complete and clean IBlueprintSegmentDB
 */
export function convertSegmentToBlueprints(segment: ReadonlyDeep<DBSegment>): IBlueprintSegmentDB {
	const obj: Complete<IBlueprintSegmentDB> = {
		_id: unprotectString(segment._id),
		name: segment.name,
		privateData: clone(segment.privateData),
		publicData: clone(segment.publicData),
		isHidden: segment.isHidden,
		identifier: segment.identifier,
		displayAs: segment.displayAs,
		showShelf: segment.showShelf,
		segmentTiming: segment.segmentTiming,
		userEditOperations: translateUserEditsToBlueprint(segment.userEditOperations),
		userEditProperties: translateUserEditPropertiesToBlueprint(segment.userEditProperties),
	}

	return obj
}

/**
 * Convert a DBRundown into IBlueprintRundownDB, for passing into the blueprints
 * @param rundown the DBRundown to convert
 * @returns a cloned complete and clean IBlueprintRundownDB
 */
export function convertRundownToBlueprints(rundown: ReadonlyDeep<DBRundown>): IBlueprintRundownDB {
	const obj: Complete<IBlueprintRundownDB> = {
		externalId: rundown.externalId,
		name: rundown.name,
		description: rundown.description,
		timing: clone<RundownPlaylistTiming>(rundown.timing),
		privateData: clone(rundown.privateData),
		publicData: clone(rundown.publicData),
		playlistExternalId: rundown.playlistExternalId,
		endOfRundownIsShowBreak: rundown.endOfRundownIsShowBreak,
		_id: unprotectString(rundown._id),
		showStyleVariantId: unprotectString(rundown.showStyleVariantId),
		playlistId: unprotectString(rundown.playlistId),
		airStatus: rundown.airStatus,
		userEditOperations: translateUserEditsToBlueprint(rundown.userEditOperations),
	}

	return obj
}

/**
 * Convert a DBRundown into IBlueprintSegmentRundown, for passing into the blueprints
 * @param rundown the DBRundown to convert
 * @returns a cloned complete and clean IBlueprintSegmentRundown
 */
export function convertRundownToBlueprintSegmentRundown(
	rundown: ReadonlyDeep<DBRundown>,
	skipClone = false
): IBlueprintSegmentRundown {
	const obj: Complete<IBlueprintSegmentRundown> = {
		externalId: rundown.externalId,
		privateData: skipClone ? rundown.privateData : clone(rundown.privateData),
		publicData: skipClone ? rundown.publicData : clone(rundown.publicData),
	}

	return obj
}

/**
 * Convert a DBRundownPlaylist into IBlueprintRundownPlaylist, for passing into the blueprints
 * Note: also requires an array of Rundowns that belong to the studio (or that belong to the playlist)
 * @param playlist the DBRundownPlaylist to convert
 * @param rundownsInStudio the Rundown for the studio, that may belong to this playlist
 * @returns a cloned complete and clean IBlueprintRundownPlaylist
 */
export function convertRundownPlaylistToBlueprints(
	playlist: DBRundownPlaylist,
	rundownsInStudio: Pick<Rundown, '_id' | 'playlistId'>[]
): IBlueprintRundownPlaylist {
	const obj: Complete<IBlueprintRundownPlaylist> = {
		name: playlist.name,

		timing: clone<RundownPlaylistTiming>(playlist.timing),
		outOfOrderTiming: playlist.outOfOrderTiming,
		loop:
			playlist.quickLoop?.start?.type === QuickLoopMarkerType.PLAYLIST &&
			playlist.quickLoop.end?.type === QuickLoopMarkerType.PLAYLIST,
		timeOfDayCountdowns: playlist.timeOfDayCountdowns,

		privateData: clone(playlist.privateData),
		publicData: clone(playlist.publicData),

		_id: unprotectString(playlist._id),
		externalId: playlist.externalId,
		created: playlist.created,
		modified: playlist.modified,
		isActive: !!playlist.activationId,
		rehearsal: playlist.rehearsal ?? false,
		startedPlayback: playlist.startedPlayback,

		rundownCount: rundownsInStudio.filter((rundown) => rundown.playlistId === playlist._id).length,
	}

	return obj
}

/**
 * Convert a DBShowStyleBase into IBlueprintShowStyleBase, for passing into the blueprints
 * @param showStyleBase the DBShowStyleBase to convert
 * @returns a cloned complete and clean IBlueprintShowStyleBase
 */
export function convertShowStyleBaseToBlueprints(
	showStyleBase: ReadonlyDeep<ProcessedShowStyleBase>
): IBlueprintShowStyleBase {
	const obj: Complete<IBlueprintShowStyleBase> = {
		_id: unprotectString(showStyleBase._id),
		blueprintId: unprotectString(showStyleBase.blueprintId),
		outputLayers: clone(
			Object.values<IOutputLayer | undefined>(showStyleBase.outputLayers).filter((l): l is IOutputLayer => !!l)
		),
		sourceLayers: clone(
			Object.values<ISourceLayer | undefined>(showStyleBase.sourceLayers).filter((l): l is ISourceLayer => !!l)
		),
		blueprintConfig: clone<IBlueprintConfig>(showStyleBase.blueprintConfig),
	}

	return obj
}

/**
 * Convert a DBShowStyleVariant into IBlueprintShowStyleVariant, for passing into the blueprints
 * @param showStyleVariant the DBShowStyleVariant to convert
 * @returns a cloned complete and clean IBlueprintShowStyleVariant
 */
export function convertShowStyleVariantToBlueprints(
	showStyleVariant: ReadonlyDeep<ProcessedShowStyleVariant>
): IBlueprintShowStyleVariant {
	const obj: Complete<IBlueprintShowStyleVariant> = {
		_id: unprotectString(showStyleVariant._id),
		name: showStyleVariant.name,
		blueprintConfig: clone<IBlueprintConfig>(showStyleVariant.blueprintConfig),
	}

	return obj
}

/**
 * Get the durations of MediaObjects
 * @param context Context for the job
 * @param mediaId Id of the object to lookup
 * @returns Found durations
 */
export async function getMediaObjectDuration(context: JobContext, mediaId: string): Promise<number | undefined> {
	const span = context.startSpan('context.getMediaObjectDuration')
	const selector = { mediaId: mediaId.toUpperCase(), studioId: context.studioId }
	const mediaObjects = await context.directCollections.MediaObjects.findFetch(selector)

	const durations: Array<number | undefined> = []
	mediaObjects.forEach((doc) => {
		if (doc !== undefined) {
			durations.push(doc.mediainfo?.format?.duration as number)
		}
	})

	if (span) span.end()

	return durations.length > 0 ? durations[0] : undefined
}

function translateUserEditsToBlueprint(
	userEdits: ReadonlyDeep<CoreUserEditingDefinition[]> | undefined
): UserEditingDefinition[] | undefined {
	if (!userEdits) return undefined

	return _.compact(
		userEdits.map((userEdit) => {
			switch (userEdit.type) {
				case UserEditingType.ACTION:
					return literal<UserEditingDefinitionAction>({
						type: UserEditingType.ACTION,
						id: userEdit.id,
						label: omit(userEdit.label, 'namespaces'),
						icon: userEdit.icon,
						iconInactive: userEdit.iconInactive,
						isActive: userEdit.isActive,
					})
				case UserEditingType.FORM:
					return literal<UserEditingDefinitionForm>({
						type: UserEditingType.FORM,
						id: userEdit.id,
						label: omit(userEdit.label, 'namespaces'),
						schema: clone(userEdit.schema),
						currentValues: clone(userEdit.currentValues),
					})
				case UserEditingType.SOFIE:
					return literal<UserEditingDefinitionSofieDefault>({
						type: UserEditingType.SOFIE,
						id: userEdit.id,
					})
				default:
					assertNever(userEdit)
					return undefined
			}
		})
	)
}

function translateUserEditPropertiesToBlueprint(
	props: ReadonlyDeep<CoreUserEditingProperties> | undefined
): UserEditingProperties | undefined {
	if (!props) return undefined

	return {
		globalProperties: props.globalProperties,
		pieceTypeProperties: props.pieceTypeProperties,

		operations: props.operations?.map(
			(userEdit) =>
				({
					type: UserEditingType.ACTION,
					id: userEdit.id,
					label: omit(userEdit.label, 'namespaces'),
					icon: userEdit.icon,
					iconInactive: userEdit.iconInactive,
					isActive: userEdit.isActive,
				}) satisfies Complete<UserEditingDefinitionAction>
		),
	}
}

export function translateUserEditsFromBlueprint(
	userEdits: UserEditingDefinition[] | undefined,
	blueprintIds: BlueprintId[]
): CoreUserEditingDefinition[] | undefined {
	if (!userEdits) return undefined

	return _.compact(
		userEdits.map((userEdit) => {
			switch (userEdit.type) {
				case UserEditingType.ACTION:
					return literal<CoreUserEditingDefinitionAction>({
						type: UserEditingType.ACTION,
						id: userEdit.id,
						label: wrapTranslatableMessageFromBlueprints(userEdit.label, blueprintIds),
						icon: userEdit.icon,
						iconInactive: userEdit.iconInactive,
						isActive: userEdit.isActive,
					})
				case UserEditingType.FORM:
					return literal<CoreUserEditingDefinitionForm>({
						type: UserEditingType.FORM,
						id: userEdit.id,
						label: wrapTranslatableMessageFromBlueprints(userEdit.label, blueprintIds),
						schema: clone(userEdit.schema),
						currentValues: clone(userEdit.currentValues),
						translationNamespaces: unprotectStringArray(blueprintIds),
					})
				case UserEditingType.SOFIE:
					return literal<CoreUserEditingDefinitionSofie>({
						type: UserEditingType.SOFIE,
						id: userEdit.id,
					})
				default:
					assertNever(userEdit)
					return undefined
			}
		})
	)
}

export function translateUserEditPropertiesFromBlueprint(
	props: UserEditingProperties | undefined,
	blueprintIds: BlueprintId[]
): CoreUserEditingProperties | undefined {
	if (!props) return undefined

	return {
		globalProperties: clone(props.globalProperties),
		pieceTypeProperties: clone(props.pieceTypeProperties),

		operations: props.operations?.map(
			(userEdit) =>
				({
					type: UserEditingType.ACTION,
					id: userEdit.id,
					label: wrapTranslatableMessageFromBlueprints(userEdit.label, blueprintIds),
					icon: userEdit.icon,
					iconInactive: userEdit.iconInactive,
					isActive: userEdit.isActive,
				}) satisfies Complete<UserEditingDefinitionAction>
		),

		translationNamespaces: blueprintIds.map((id) => `blueprint_${id}`),
	}
}

/**
 * Converts a BlueprintMutatablePart into a PlayoutMutatablePart
 */
export function convertPartialBlueprintMutablePartToCore(
	updatePart: Partial<IBlueprintMutatablePart>,
	blueprintId: BlueprintId
): Partial<PlayoutMutatablePart> {
	const playoutUpdatePart: Partial<PlayoutMutatablePart> = {
		...updatePart,
		userEditOperations: undefined,
	}

	if ('userEditOperations' in updatePart) {
		playoutUpdatePart.userEditOperations = translateUserEditsFromBlueprint(updatePart.userEditOperations, [
			blueprintId,
		])
	} else {
		delete playoutUpdatePart.userEditOperations
	}

	if ('userEditProperties' in updatePart) {
		playoutUpdatePart.userEditProperties = translateUserEditPropertiesFromBlueprint(updatePart.userEditProperties, [
			blueprintId,
		])
	} else {
		delete playoutUpdatePart.userEditOperations
	}

	return playoutUpdatePart
}
export function createBlueprintQuickLoopInfo(playlist: ReadonlyDeep<DBRundownPlaylist>): BlueprintQuickLookInfo | null {
	const playlistLoopProps = playlist.quickLoop
	if (!playlistLoopProps) return null

	return {
		running: playlistLoopProps.running,
		locked: playlistLoopProps.locked,
	}
}
