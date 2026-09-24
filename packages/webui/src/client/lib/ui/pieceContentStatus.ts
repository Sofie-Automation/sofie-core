import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import type { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import type { ReadonlyDeep } from 'type-fest'
import { getIgnorePieceContentStatus } from '../localStorage.js'

export function getVisiblePieceContentStatusCode(
	contentStatus: ReadonlyDeep<PieceContentStatusObj> | undefined
): PieceStatusCode | undefined {
	return getIgnorePieceContentStatus() ? undefined : contentStatus?.status
}
