import { SplitsContentBoxContent, SplitsContentBoxProperties } from './content.js'
import { NoteSeverity } from './lib.js'
import { ITranslatableMessage } from './translations.js'

export interface PopupPreview<P extends Previews = Previews> {
	name?: string
	preview?: P
	warnings?: InvalidPreview[]
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

interface PreviewBase {
	type: PreviewType
}

export interface InvalidPreview extends PreviewBase {
	type: PreviewType.Invalid

	severity: NoteSeverity
	reason: ITranslatableMessage
}
export interface TablePreview extends PreviewBase {
	type: PreviewType.Table

	entries: { key: string; value: string }[]
	displayTiming: boolean
}
export interface ScriptPreview extends PreviewBase {
	type: PreviewType.Script

	fullText?: string
	lastWords?: string
	comment?: string
	lastModified?: number
}
export interface HTMLPreview extends PreviewBase {
	// todo - expose if and how steps can be controlled
	type: PreviewType.HTML

	name?: string

	previewUrl: string
	previewDimension?: { width: number; height: number }

	postMessageOnLoad?: any

	steps?: { current: number; total: number }
}
export interface SplitPreview extends PreviewBase {
	type: PreviewType.Split

	background?: string // file asset upload?
	boxes: (SplitsContentBoxContent & SplitsContentBoxProperties)[]
}
export interface VTPreview extends PreviewBase {
	type: PreviewType.VT

	// note: the info required for the preview follows from package manager so there's nothing for blueprins here
	// note: if we want to allow a preview for different media than saved on the piece (because perhaps the media is in a non-primary piece) should we allow to specifiy the package to preview?

	inWords?: string // note - only displayed if outWords are present
	outWords?: string
}
export interface BlueprintImagePreview extends PreviewBase {
	type: PreviewType.BlueprintImage

	image: string // to be put in as asset
}
