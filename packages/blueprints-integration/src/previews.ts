/**
 * This file defines the types for content previews that can be returned from blueprints.
 */
import { SourceLayerType, SplitsContentBoxContent, SplitsContentBoxProperties } from './content.js'
import { NoteSeverity } from './lib.js'
import { ITranslatableMessage } from './translations.js'

/**
 * Optional container for preview content with optional warnings and additional content.
 * If not added to a piece, the core will use the default preview handling.
 *
 * @example
 * ```ts
 * import { TablePreview, PreviewType } from 'blueprints-integration';
 * const preview: TablePreview = {
 *   type: PreviewType.Table,
 *   entries: [ { key: 'Title', value: 'My Piece' } ],
 *   displayTiming: true,
 *   // the additionalPreviewContent can contain any number of content items of various types
 *   additionalPreviewContent: [
 *     {
 *       type: 'script',
 *       script: 'console.log("Hello World")',
 *     },
 *     { type: 'separationLine' },
 *     {
 *       type: 'layerInfo',
 *       layerType: SourceLayerType.Graphics,
 *       text: ['Breaking News: Something happened!'],
 *       inTime: 0,
 *       duration: 5000
 *     },
 *     {
 *       type: 'layerInfo',
 *       layerType: SourceLayerType.Graphics,
 *       text: ['Person Name - Title'],
 *       inTime: 1000,
 *       duration: 3000
 *     },
 *     { type: 'separationLine' },
 *     {
 *       type: 'iframe',
 *       href: 'https://example.com/preview', // Could be an external URL or a local server serving live preview content
 *     }
 *   ]
 * };
 * return { preview };
 * ```
 */
export interface PopupPreview<P extends Previews = Previews> {
	name?: string
	preview?: P
	warnings?: InvalidPreview[]
	/**
	 * Add custom content preview content
	 */
	additionalPreviewContent?: Array<PreviewContent>
}
export type Previews = TablePreview | ScriptPreview | HTMLPreview | SplitPreview | VTPreview | BlueprintImagePreview

export enum PreviewType {
	Invalid = 'invalid',
	Table = 'table',
	Script = 'script',
	HTML = 'html',
	Split = 'split',
	VT = 'vt',
	BlueprintImage = 'blueprintImage',
}

/**
 * Additional preview content that can be added to a PopupPreview.
 * Supports various content types: iframe, image, video, script, title, inOutWords, layerInfo, separationLine, and data.
 * The purpose of this is to allow blueprints to provide extra preview content for pieces, e.g. showing script text,
 * Lower3rd GFX information, images, an iFrame with a live preview or other relevant information.
 * These preview content types are the same that are used in thedefault PreviewPopUp component in the web UI.
 */
export type PreviewContent =
	| {
			/** Embed an iframe with optional postMessage communication */
			type: 'iframe'
			href: string
			postMessage?: any
			dimensions?: { width: number; height: number }
	  }
	| {
			/** Display an image */
			type: 'image'
			src: string
	  }
	| {
			/** Display a video player */
			type: 'video'
			src: string
	  }
	| {
			/** Show script content with timing words and metadata */
			type: 'script'
			script?: string
			scriptFormatted?: string
			firstWords?: string
			lastWords?: string
			comment?: string
			lastModified?: number
	  }
	| {
			/** Display a title heading */
			type: 'title'
			content: string
	  }
	| {
			/** Show in/out timing words */
			type: 'inOutWords'
			in?: string
			out: string
	  }
	| {
			/** Display layer information with timing
			 * Used for showing information about a specific source layer, such as graphics or lower thirds.
			 * The inTime, outTime, and duration is for information only and can be specified as
			 * numbers (milliseconds) or strings (e.g. "00:00:05:00" for 5 seconds).
			 * They are optional, and if not specified, the layer info is shown without timing.
			 */
			type: 'layerInfo'
			layerType: SourceLayerType
			text: Array<string>
			inTime?: number | string
			outTime?: number | string
			duration?: number | string
	  }
	| {
			/** Add a visual separator line */
			type: 'separationLine'
	  }
	| {
			/** Display key-value data pairs
			 * this is a basic data preview where the key is the Label and the value is the value
			 * the layerInfo should preferably be used for layer specific information and color
			 */
			type: 'data'
			content: { key: string; value: string }[]
	  }

interface PreviewBase {
	type: PreviewType
}

/** Indicates an invalid preview with a severity level and reason */
export interface InvalidPreview extends PreviewBase {
	type: PreviewType.Invalid

	severity: NoteSeverity
	reason: ITranslatableMessage
}

/** Display a table of key-value pairs, optionally with timing information */
export interface TablePreview extends PreviewBase {
	type: PreviewType.Table

	entries: { key: string; value: string }[]
	displayTiming: boolean
}

/** Show script text with last words, comments, and last modified time */
export interface ScriptPreview extends PreviewBase {
	type: PreviewType.Script

	fullText?: string
	fullTextFormatted?: string
	lastWords?: string
	comment?: string
	lastModified?: number
}

/** Embed a custom HTML preview via URL, with optional steps and dimensions */
export interface HTMLPreview extends PreviewBase {
	// todo - expose if and how steps can be controlled
	type: PreviewType.HTML

	name?: string

	previewUrl: string
	previewDimension?: { width: number; height: number }

	postMessageOnLoad?: any

	steps?: { current: number; total: number }
}

/** Show a split screen with multiple content boxes (e.g. for multi-camera or multi-source content) */
export interface SplitPreview extends PreviewBase {
	type: PreviewType.Split

	background?: string // file asset upload?
	boxes: (SplitsContentBoxContent & SplitsContentBoxProperties)[]
}

/** Video Tape preview with in/out words for timing */
export interface VTPreview extends PreviewBase {
	type: PreviewType.VT

	// note: the info required for the preview follows from package manager so there's nothing for blueprins here
	// note: if we want to allow a preview for different media than saved on the piece (because perhaps the media is in a non-primary piece) should we allow to specifiy the package to preview?

	inWords?: string // note - only displayed if outWords are present
	outWords?: string
}

/** Show an image asset as a preview */
export interface BlueprintImagePreview extends PreviewBase {
	type: PreviewType.BlueprintImage

	image: string // to be put in as asset
}
