import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import type { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import type { PieceUi } from '../../../ui/SegmentContainer/withResolvedSegment.js'
import { setIgnorePieceContentStatus } from '../../localStorage.js'
import { pieceUiClassNames } from '../pieceUiClassNames.js'

function makePiece(): PieceUi {
	return {
		cropped: false,
		instance: {
			disabled: false,
			piece: {
				enable: {
					start: 0,
				},
				lifespan: PieceLifespan.WithinPart,
				notInVision: false,
			},
		},
	} as unknown as PieceUi
}

function makeStatus(status: PieceStatusCode): PieceContentStatusObj {
	return {
		status,
	} as PieceContentStatusObj
}

describe('pieceUiClassNames', () => {
	afterEach(() => {
		setIgnorePieceContentStatus(false)
	})

	it('shows missing-source styling normally', () => {
		setIgnorePieceContentStatus(false)

		const result = pieceUiClassNames(makePiece(), makeStatus(PieceStatusCode.SOURCE_MISSING), 'piece', false)

		expect(result).toContain('source-missing')
	})

	it('hides missing-source styling when piece content status is ignored', () => {
		setIgnorePieceContentStatus(true)

		const result = pieceUiClassNames(makePiece(), makeStatus(PieceStatusCode.SOURCE_MISSING), 'piece', false)

		expect(result).not.toContain('source-missing')
	})
})
