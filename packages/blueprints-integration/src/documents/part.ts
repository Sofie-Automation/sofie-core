import { UserEditingDefinition, UserEditingProperties } from '../userEditing.js'
import type { NoteSeverity } from '../lib.js'
import type { ITranslatableMessage } from '../translations.js'
import type { IngestPartNotifyItemReady } from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'

/** Timings for the inTransition, when supported and allowed */
export interface IBlueprintPartInTransition {
	/** Duration this transition block a take for. After this time, another take is allowed which may cut this transition off early */
	blockTakeDuration: number
	/** Duration the previous part be kept playing once the transition is started. Typically the duration of it remaining in-vision */
	previousPartKeepaliveDuration: number
	/** Duration the pieces of the part should be delayed for once the transition starts. Typically the duration until the new part is in-vision */
	partContentDelayDuration: number
}

/** Timings for the outTransition, when supported and allowed */
export interface IBlueprintPartOutTransition {
	/** How long to keep this part alive after taken out  */
	duration: number
}

export enum PartHoldMode {
	NONE = 0,
	FROM = 1,
	TO = 2,
}

export interface IBlueprintMutatablePart<TPrivateData = unknown, TPublicData = unknown> {
	/** The story title */
	title: string
	/**
	 * The story title to show in the prompter
	 * If unset, `title` is used instead
	 */
	prompterTitle?: string

	/** Arbitraty data storage for internal use in the blueprints */
	privateData?: TPrivateData
	/** Arbitraty data relevant for other systems, made available to them through APIs */
	publicData?: TPublicData

	/** Should this item should progress to the next automatically */
	autoNext?: boolean
	/** How much to overlap on when doing autonext */
	autoNextOverlap?: number

	/** Timings for the inTransition, when supported and allowed */
	inTransition?: IBlueprintPartInTransition

	/** Should we block the inTransition when starting the next Part */
	disableNextInTransition?: boolean

	/** Timings for the outTransition, when supported and allowed */
	outTransition?: IBlueprintPartOutTransition

	/** Expected duration of the line, in milliseconds */
	expectedDuration?: number

	/** Whether this segment line supports being used in HOLD */
	holdMode?: PartHoldMode

	/** The externalId of the part as expected by the NRCS. If not set, the externalId property will be used */
	ingestNotifyPartExternalId?: string

	/** Set to true if ingest-device should be notified when this part starts playing */
	shouldNotifyCurrentPlayingPart?: boolean

	/** Whether part should be reported as ready to the ingest-device. Set to undefined/null to disable this reporting */
	ingestNotifyPartReady?: boolean | null

	/** Report items as ready to the ingest-device. Only named items will be reported, using the boolean value provided */
	ingestNotifyItemsReady?: IngestPartNotifyItemReady[]

	/** Classes to set on the TimelineGroupObj for this part */
	classes?: string[]
	/** Classes to set on the TimelineGroupObj for the following part */
	classesForNext?: string[]

	/**
	 * Use and provide timing to a `displayDurationGroup` with the same ID. This allows Parts to "share" timing.
	 *
	 * **NOTE**: The behavior of the system is undefined when using both `displayDurationGroups` and `budgetDuration`
	 */
	displayDurationGroup?: string
	/**
	 * How long to make the Part appear in the UI, if other than expectedDuration.
	 *
	 * **NOTE**: The behavior of the system is undefined when using both `displayDurationGroups` and `budgetDuration` */
	displayDuration?: number

	/** User-facing identifier that can be used by the User to identify the contents of a segment in the Rundown source system */
	identifier?: string

	/** MediaObjects that when created/updated, should cause the blueprint to be rerun for the Segment of this Part */
	hackListenToMediaObjectUpdates?: HackPartMediaObjectSubscription[]

	/**
	 * User editing definitions for this part
	 */
	userEditOperations?: UserEditingDefinition[]

	/**
	 * Properties that are user editable from the properties panel in the Sofie UI, if the user saves changes to these
	 * it will trigger a user edit operation of type DefaultUserOperationEditProperties
	 */
	userEditProperties?: UserEditingProperties
}

export interface HackPartMediaObjectSubscription {
	/** The playable reference (CasparCG clip name, quantel GUID, etc) */
	mediaId: string
}

/** The Part generated from Blueprint */
export interface IBlueprintPart<TPrivateData = unknown, TPublicData = unknown> extends IBlueprintMutatablePart<
	TPrivateData,
	TPublicData
> {
	/** Id of the part from the gateway if this part does not map directly to an IngestPart. This must be unique for each part */
	externalId: string

	/**
	 * When something bad has happened, we can mark the part as invalid, which will prevent the user from TAKEing it.
	 * Situations where a part can be marked as invalid include:
	 *  - part could not be handled by the blueprint, but NRCS would expect it to exist in Rundown (f.g. no part type in ENPS)
	 *  - part was handled by the blueprint, but blueprint could not produce a playable result (f.g. the part is a VT clip, but no clip information was present in NRCS)
	 *  - part was handled by the blueprint, but business logic prevents it from being played (f.g. the part has been marked as "Not approved" by the editor)
	 *  - there is another issue preventing the part from being playable, but the user expects it to be there
	 *
	 * Invalid means that in Sofie:
	 * * The Part is not playable
	 * * The Part is displayed in the Rundown GUI (as invalid)
	 * * The Part is still used in timing calculations as normal
	 * * The Part is still showed in prompter, etc, as normal
	 * * The Part has Adlibs that are playable
	 * * Infinites still works as normal
	 */
	invalid?: boolean

	/**
	 * Provide additional information about the reason a part is invalid. The `key` is the string key from blueprints
	 * translations. Args will be used to replace placeholders within the translated file. If `key` is not found in the
	 * translation, it will be interpollated using the `args` and used as the string to be displayed.
	 * The blueprints can also provide a color hint that the UI can use when displaying the part.
	 * Color needs to be in #xxxxxx RGB hexadecimal format.
	 *
	 * @type {{
	 * 		message: ITranslatableMessage,
	 *      severity?: NoteSeverity
	 * 		color?: string
	 * 	}}
	 * @memberof IBlueprintPart
	 */
	invalidReason?: {
		message: ITranslatableMessage
		/** Set the severity of the displayed invalid part note */
		severity?: NoteSeverity
		color?: string
	}

	/**
	 * Take a part out of timing considerations for a Rundown & Rundown Playlist. This part can be TAKEN but will not
	 * update playlist's startedPlayback and will not count time in the GUI.
	 *
	 * Some parts shouldn't count towards the various timing information in Sofie. Specifically, it may be useful to
	 * have some Parts execute Timelines outside of the regular flow of time, such as when doing an ad break or
	 * performing some additional actions before a show actually begins (such as when there's a bit of a buffer before
	 * the On Air time of a Show and when the MCR cuts to the PGM, because the previous show ended quicker).
	 */
	untimed?: boolean

	/** When the NRCS informs us that the producer marked the part as floated, we can prevent the user from TAKE'ing and NEXT'ing it, but still have it visible and allow manipulation */
	floated?: boolean

	/** When this part is just a filler to fill space in a segment. Generally, used with invalid: true */
	gap?: boolean
}

/** The Part sent from Core */
export interface IBlueprintPartDB<TPrivateData = unknown, TPublicData = unknown> extends IBlueprintPart<
	TPrivateData,
	TPublicData
> {
	_id: string
	/** The segment ("Title") this line belongs to */
	segmentId: string
}
