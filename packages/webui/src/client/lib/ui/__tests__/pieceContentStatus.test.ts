import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import type { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { setIgnorePieceContentStatus } from '../../localStorage.js'
import { getVisiblePieceContentStatusCode } from '../pieceContentStatus.js'

describe('getVisiblePieceContentStatusCode', () => {
	afterEach(() => {
		setIgnorePieceContentStatus(false)
	})

	it('hides the status code when piece content status is ignored', () => {
		const status = { status: PieceStatusCode.SOURCE_NOT_READY } as PieceContentStatusObj

		setIgnorePieceContentStatus(false)
		expect(getVisiblePieceContentStatusCode(status)).toBe(PieceStatusCode.SOURCE_NOT_READY)

		setIgnorePieceContentStatus(true)
		expect(getVisiblePieceContentStatusCode(status)).toBeUndefined()
	})
})
