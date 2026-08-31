import { PieceLifespan } from '@sofie-automation/shared-lib/dist/core/model/Rundown'
import type { UserEditingDefinition, UserEditingProperties } from '../userEditing.js'
import type { PieceAbSessionInfo } from '../abPlayback.js'
import type { ActionUserData } from '../action.js'
import type { SomeContent, WithTimeline } from '../content.js'
import type { ExpectedPackage } from '../package.js'
import type { ExpectedPlayoutItemGeneric } from './expectedPlayoutItem.js'

export { PieceLifespan }

export enum IBlueprintDirectPlayType {
	AdLibPiece = 'adlib',
	AdLibAction = 'action',
}
export interface IBlueprintDirectPlayBase {
	type: IBlueprintDirectPlayType
}
export interface IBlueprintDirectPlayAdLibPiece extends IBlueprintDirectPlayBase {
	/** Copy the Piece and insert it dynamically at the playhead, as if it were an adlib */
	type: IBlueprintDirectPlayType.AdLibPiece
}
export interface IBlueprintDirectPlayAdLibAction extends IBlueprintDirectPlayBase {
	/** When direct playing a Piece execute a specified AdLib Action */
	type: IBlueprintDirectPlayType.AdLibAction
	/** Id of the action to be executed when user requests to direct play a Piece */
	actionId: string
	/** Properties defining the action behaviour */
	userData: ActionUserData
}
export type IBlueprintDirectPlay = IBlueprintDirectPlayAdLibPiece | IBlueprintDirectPlayAdLibAction

/**
 * The properties of a Piece which can be varied per Branding.
 * These are limited to properties which affect how the Piece is displayed, so that a Branding cannot alter playout.
 */
export interface IBlueprintBrandablePieceGeneric {
	/** User-presentable name for the timeline item */
	name: string

	/** Source layer the timeline item belongs to */
	sourceLayerId: string
	/** Layer output this piece belongs to */
	outputLayerId: string

	/** User-defined tags that can be used for filtering adlibs in the shelf and identifying pieces by actions */
	tags?: string[]
}

/** Overrides to apply to a Piece while a Branding is selected */
export type IBlueprintPieceBranding = Partial<IBlueprintBrandablePieceGeneric>

export interface IBlueprintPieceGeneric<
	TPrivateData = unknown,
	TPublicData = unknown,
> extends IBlueprintBrandablePieceGeneric {
	/**
	 * An identifier for this Piece
	 * It should be unique within the part it belongs to, and consistent across ingest updates
	 */
	externalId: string

	/** Arbitraty data storage for internal use in the blueprints */
	privateData?: TPrivateData
	/** Arbitraty data relevant for other systems, made available to them through APIs */
	publicData?: TPublicData

	/** Whether and how the piece is infinite */
	lifespan: PieceLifespan

	/** The object describing the item in detail */
	content: WithTimeline<SomeContent>

	/**
	 * How long this piece needs to prepare its content before it will have an effect on the output.
	 * This allows for flows such as starting a clip playing, then cutting to it after some ms once the player is outputting frames.
	 */
	prerollDuration?: number

	/**
	 * How long this piece needs to continue it's content after a take has been done to ensure a
	 * seemless transition into the next part.
	 */
	postrollDuration?: number

	/** Whether the adlib should always be inserted queued */
	toBeQueued?: boolean
	/** Array of items expected to be played out. This is used by playout-devices to preload stuff. */
	expectedPlayoutItems?: ExpectedPlayoutItemGeneric[]

	/** Allow this piece to be direct played (eg, by double clicking in the rundown timeline view) */
	allowDirectPlay?: IBlueprintDirectPlay

	/**
	 * An array of which Packages this Piece uses. This is used by a Package Manager to ensure that the Package is in place for playout.
	 * @todo
	 */
	expectedPackages?: ExpectedPackage.Any[]

	/** HACK: Some pieces have side effects on other pieces, and pruning them when they have finished playback will cause playout glitches. This will tell core to not always preserve it */
	hasSideEffects?: boolean

	/**
	 * AB playback sessions needed for this Piece
	 */
	abSessions?: PieceAbSessionInfo[]

	/**
	 * User editing definitions for this piece
	 */
	userEditOperations?: UserEditingDefinition[]

	/**
	 * Properties that are user editable from the properties panel in the Sofie UI, if the user saves changes to these
	 * it will trigger a user edit operation of type DefaultUserOperationEditProperties
	 */
	userEditProperties?: UserEditingProperties

	/**
	 * If set, this Piece is only used while one of these Brandings is selected.
	 * An empty array means the Piece is never used.
	 */
	onlyValidForBranding?: string[]

	/**
	 * Overrides to apply to this Piece while a Branding is selected, keyed by the id of the Branding.
	 * Any property named here replaces the one on the Piece in full.
	 */
	branding?: Record<string, IBlueprintPieceBranding>
}
