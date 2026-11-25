import { ITranslatableMessage, PieceContentStatusObj } from '@sofie-automation/blueprints-integration'
import { ProtectedString } from '../protectedString.js'
import {
	RundownId,
	PartId,
	SegmentId,
	PieceId,
	AdLibActionId,
	RundownBaselineAdLibActionId,
	PieceInstanceId,
} from './Ids.js'

export type UIPieceContentStatusId = ProtectedString<'UIPieceContentStatus'>
export interface UIPieceContentStatus {
	_id: UIPieceContentStatusId

	segmentRank: number
	partRank: number

	rundownId: RundownId
	partId: PartId | undefined
	segmentId: SegmentId | undefined

	pieceId: PieceId | AdLibActionId | RundownBaselineAdLibActionId | PieceInstanceId
	isPieceInstance: boolean

	name: string | ITranslatableMessage
	segmentName: string | undefined

	status: PieceContentStatusObj
}

export type { PieceContentStatusObj, SplitBoxPreviewUrls } from '@sofie-automation/blueprints-integration'
