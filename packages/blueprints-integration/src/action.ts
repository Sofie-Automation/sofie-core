import { ExpectedPackage } from './package.js'
import { SomeContent } from './content.js'
import { ITranslatableMessage } from './translations.js'
import { ExpectedPlayoutItemGeneric } from './documents/index.js'
import { JSONBlob } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { JSONSchema } from '@sofie-automation/shared-lib/dist/lib/JSONSchemaTypes'

export interface ActionUserData {
	[key: string]: any
}

// export enum ActionExecuteAfterChanged {
// 	/** Do not execute the action after userData has changed, unless specifically triggered by the user */
// 	none = 'none',
// 	/** Execute the action immediately after userData has changed */
// 	immediately = 'immediately',
// 	/** Execute the action after userData has changed and there was an identifiable period of calm in the changes */
// 	debounce = 'debounce',
// }

export interface IBlueprintActionManifestDisplay {
	/** A label to be displayed to the user */
	label: ITranslatableMessage
	/** An optional, longer description that will not be immediately visible to the user */
	description?: ITranslatableMessage
	_rank?: number

	/** This is the label to be shown in the inspector for "Execute Action" */
	triggerLabel?: ITranslatableMessage

	tags?: string[]
	/** Piece tags to use to determine if action is currently active */
	currentPieceTags?: string[]
	/** Piece tags to use to determine if action is set as next */
	nextPieceTags?: string[]
	/**
	 * String that can be used to identify adlibs that are equivalent to each other,
	 * if there are multiple Adlibs with the same uniquenessId,
	 * only one of them should be displayed in the GUI.
	 */
	uniquenessId?: string
	/** When not playing, display in the UI as playing, and vice versa. Useful for Adlibs that toggle something off when taken */
	invertOnAirState?: boolean
	/** Hide this adLib from the shelf - it is accessible only through the API */
	hidden?: boolean
}

export interface IBlueprintActionManifestDisplayContent extends IBlueprintActionManifestDisplay {
	/** Source layer the timeline item belongs to */
	sourceLayerId: string
	/** Layer output this piece belongs to */
	outputLayerId: string
	/** Description used to produce the thumbnail, sourceDuration, etc. information for the adlib */
	content: SomeContent
}

export interface IBlueprintActionTriggerMode {
	/** Data sent to action when executing */
	data: string

	display: {
		_rank: number
		/** A label to be displayed to the user */
		label: ITranslatableMessage
		/** An optional, longer description that will not be immediately visible to the user */
		description?: ITranslatableMessage
		/** An icon to be displayed to the user next to the label
		 *
		 * This can either be a relative URL to an image in the Blueprints assets or a `data:` URL
		 */
		icon?: string
	}
}

export interface IBlueprintActionManifest<TPrivateData = unknown, TPublicData = unknown> {
	/**
	 * An identifier for this Action
	 * It should be unique within the part it belongs to, and consistent across ingest updates
	 */
	externalId: string

	/** Id of the action */
	actionId: string
	/** Arbitraty data storage for internal use in the blueprints */
	privateData?: TPrivateData
	/** Arbitraty data relevant for other systems, made available to them through APIs */
	publicData?: TPublicData
	/**
	 * Arbitrary data relevant for other systems and/or users, available through APIs.
	 * It can be overriden when executing the action.
	 * It can be made user-editable with userDataManifest.
	 */
	userData: ActionUserData
	/**
	 * Set if ad-lib action should be limited in context to the current part/segment
	 * Note: Only valid for items returned from getSegment
	 */
	partId?: string

	/** When something bad has happened, we can mark the action as invalid, which will prevent the user from executing it */
	invalid?: boolean

	/**
	 * Set to true if ad-lib action should can be used in any showstyle-variant. Default: false = only used by the current variant.
	 * This is useful for actions in Buckets, so that they can be easily shared between rundowns.
	 * Note: When used, this must be set for ALL adlibs of a certain type (not just a few variants).
	 * Note: Only valid for items returned from getAdlibItem
	 */
	allVariants?: boolean

	userDataManifest: {
		/** Schema for the executeAdLib adLibOptions property to allow for customising */
		optionsSchema?: JSONBlob<JSONSchema>
		// Potential future properties:
		// /** Execute the action after userData is changed. If not present ActionExecuteAfterChanged.none is assumed. */
		// executeOnUserDataChanged?: ActionExecuteAfterChanged
		// asloDisplayACtionButton: boolean
	}

	display: IBlueprintActionManifestDisplay | IBlueprintActionManifestDisplayContent

	/** Optional ways of executing this action. The default option is computed from the display properties */
	triggerModes?: IBlueprintActionTriggerMode[]

	/** Array of items expected to be played out. This is used by playout-devices to preload stuff. */
	expectedPlayoutItems?: ExpectedPlayoutItemGeneric[]
	/**
	 * An array of which Packages this Action uses. This is used by a Package Manager to ensure that the Package is in place for playout.
	 */
	expectedPackages?: ExpectedPackage.Any[]
}
