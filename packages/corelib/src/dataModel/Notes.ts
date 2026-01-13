import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { ITranslatableMessage } from '../TranslatableMessage.js'
import { RundownId, SegmentId, PartId, PieceId } from './Ids.js'

export interface INoteBase {
	type: NoteSeverity
	message: ITranslatableMessage
}

export interface TrackedNote extends GenericNote {
	rank: number
	origin: {
		name: string
		segmentName?: string
		rundownId?: RundownId
		segmentId?: SegmentId
		partId?: PartId
		pieceId?: PieceId
	}
}

export interface GenericNote extends INoteBase {
	origin: {
		name: string
	}
}
export interface RundownPlaylistNote extends INoteBase {
	origin: {
		name: string
	}
}
export interface RundownNote extends INoteBase {
	origin: {
		name: string
	}
}
export interface SegmentNote extends RundownNote {
	origin: {
		name: string
	}
}

export interface PartNote extends SegmentNote {
	origin: {
		name: string
		pieceId?: PieceId
	}
}
