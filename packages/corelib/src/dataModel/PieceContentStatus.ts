import { ITranslatableMessage, PackageInfo } from '@sofie-automation/blueprints-integration'
import { ProtectedString } from '../protectedString'
import {
	RundownId,
	PartId,
	SegmentId,
	PieceId,
	AdLibActionId,
	RundownBaselineAdLibActionId,
	PieceInstanceId,
} from './Ids'
import { PieceStatusCode } from './Piece'

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

export interface PieceContentStatusObj {
	status: PieceStatusCode
	messages: ITranslatableMessage[]

	freezes: Array<PackageInfo.Anomaly>
	blacks: Array<PackageInfo.Anomaly>
	scenes: Array<number>

	thumbnailUrl: string | undefined
	previewUrl: string | undefined

	packageName: string | null

	contentDuration: number | undefined

	progress: number | undefined
}
