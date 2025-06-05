import { JSONBlob } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { Time } from './common.js'
import { TSR, TimelineObjectCoreExt } from './timeline.js'
import { SourceLayerType } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'
import { PopupPreview } from './previews.js'

export type WithTimeline<T extends BaseContent> = T & {
	timelineObjects: TimelineObjectCoreExt<TSR.TSRTimelineContent>[]
}

export interface BaseContent {
	editable?: BaseEditableParameters

	/** Is this content looping, or will it only play once. This property is used to show a "looping" icon on the Piece. Default is `false` */
	loop?: boolean

	/** Length of the source content (in milliseconds). This property is used to show "freeze-frame" icons and countdowns. Default is `undefined`, meaning the content has no specific duration */
	sourceDuration?: number
	ignoreMediaObjectStatus?: boolean
	ignoreBlackFrames?: boolean
	ignoreFreezeFrame?: boolean
	ignoreAudioFormat?: boolean

	/**
	 * Overwrite any default hover previews in Sofie
	 */
	popUpPreview?: PopupPreview
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BaseEditableParameters {}

export interface VTEditableParameters extends BaseEditableParameters {
	editorialStart: number
	editorialDuration: number
}

/** @todo Should all this be deprecated and replaced by expectedPackages altogether? */
export type SomeContent =
	| VTContent
	| CameraContent
	| RemoteContent
	| ScriptContent
	| NoraContent
	| SplitsContent
	// eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
	| LiveSpeakContent
	| TransitionContent
	| GraphicsContent
	| UnknownContent
	| EvsContent
	// eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
	| RemoteSpeakContent
	// eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
	| LightingContent

export type UnknownContent = BaseContent

export interface VTContent extends BaseContent {
	fileName: string
	path: string
	/** Frame that media manager should grab for thumbnail preview */
	previewFrame?: number
	mediaFlowIds?: string[]
	seek?: number
	/** Duration of extra content past sourceDuration. Not planned to play back but present on the media and playable. */
	postrollDuration?: number
	editable?: VTEditableParameters
	/** This is for the VT's in out words */
	firstWords?: string
	lastWords?: string
	fullScript?: string
}

export interface GraphicsContent extends BaseContent {
	fileName: string
	path: string
	mediaFlowIds?: string[]
	thumbnail?: string
	templateData?: Record<string, any>
}

export interface CameraContent extends BaseContent {
	studioLabel: string
	studioLabelShort?: string
	switcherInput: number | string
}

export interface RemoteContent extends BaseContent {
	studioLabel: string
	studioLabelShort?: string
	switcherInput: number | string
}

/** Content description for the EVS variant of a LOCAL source */
export interface EvsContent extends BaseContent {
	studioLabel: string
	studioLabelShort?: string
	/** Switcher input for the EVS channel */
	switcherInput: number | string
	/** Name of the EVS channel as used in the studio */
	channelName: string
	/** Color code used to represent the EVS channel in 24 bit hex format (fx ff0000) */
	color?: string
}

export interface ScriptContent extends BaseContent {
	firstWords: string
	lastWords: string
	fullScript?: string
	comment?: string
	lastModified?: Time | null
}

/** Data describing a Nora template's step attributes */
export interface NoraPayloadStepData {
	/** the step to move to - used when sending commands to nora */
	to?: number | 'next'
	/** the current step (which you are moving from) - provided by nora */
	from?: number
	/** Enable/disable step. This is usually provided by the template it self, but can be overwritten by providing the value. */
	enabled?: boolean
	/** -1 means unknown/infinite value of steps available, positive values are literal - provided by nora */
	total?: number
	/** if true only forward linear advances are allowed, if false you can jump around */
	orderLocked?: boolean
	/** if true the graphics will start at the first step again if given a next command when on the last. If false it will stay on the last step */
	repeat?: boolean
}

export interface NoraPayload {
	content: { [key: string]: unknown }
	manifest: string
	template: {
		event: string
		layer: string
		name: string
	}
	metadata?: {
		templateName: string
		templateVariant: string | undefined
	}
	changed?: Time
	step?: NoraPayloadStepData
}

export interface NoraContentSteps {
	current: number
	count: number
}

export interface NoraContent extends BaseContent {
	/** URL of the preview renderer */
	previewRenderer: string
	/** Payload for the preview renderer to display the graphic */
	previewPayload: JSONBlob<NoraPayload>
	/** Dimensions of the rendered hover-preview viewport in pixels. Defaults to 1920x1080. */
	previewRendererDimensions?: { width: number; height: number }

	/** Basic display info about the template */
	templateInfo?: {
		name: string
		variant?: string
	}

	/** Time the graphic was last changed in the NRCS (if known) */
	changed?: Time

	/** If set, the graphic supports steps */
	step?: NoraContentSteps
}

export interface SplitsContentBoxProperties {
	type: SourceLayerType
	studioLabel: string
	studioLabelShort?: string
	switcherInput: number | string
	/** Geometry information for a given box item in the Split. X,Y are relative to center of Box, Scale is 0...1, where 1 is Full-Screen */
	geometry?: {
		x: number
		y: number
		scale: number
		crop?: {
			left: number
			top: number
			right: number
			bottom: number
		}
	}
}
export type SplitsContentBoxContent = VTContent | CameraContent | RemoteContent | NoraContent | GraphicsContent
export interface SplitsContent extends BaseContent {
	/** Array of contents, 0 is towards the rear */
	boxSourceConfiguration: (SplitsContentBoxContent & SplitsContentBoxProperties)[]
}

export interface AudioContent extends BaseContent {
	fileName: string
	path: string
}

// export type LowerThirdContent = GraphicsContent
export type LiveSpeakContent = VTContent

export interface TransitionContent extends BaseContent {
	icon?: string
	preview?: string
}

export type SomeTransitionContent = VTContent | TransitionContent

export type RemoteSpeakContent = RemoteContent

export type LightingContent = UnknownContent

export { SourceLayerType }
