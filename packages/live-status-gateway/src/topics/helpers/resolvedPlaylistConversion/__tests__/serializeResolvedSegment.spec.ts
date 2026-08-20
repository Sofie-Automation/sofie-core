import { serializePart, serializePiece, serializeSegmentExtended } from '../segments/serializeResolvedSegment.js'

describe('serializeResolvedSegment helpers', () => {
	it('serializePiece omits outputLayer and keeps transport-safe fields', () => {
		const result = serializePiece({
			renderedInPoint: 1,
			renderedDuration: 2,
			instance: { _id: 'inst0' },
			outputLayer: { circular: true },
		})

		expect(result).toEqual({
			renderedInPoint: 1,
			renderedDuration: 2,
			instance: { _id: 'inst0' },
		})
	})

	it('serializePart serializes nested pieces', () => {
		const result = serializePart({
			partId: 'part0',
			instance: { _id: 'pi0' },
			renderedDuration: 2000,
			startsAt: 1000,
			willProbablyAutoNext: false,
			pieces: [{ instance: { _id: 'piece0' } }],
		})
		expect(result.pieces).toEqual([
			{ renderedInPoint: undefined, renderedDuration: undefined, instance: { _id: 'piece0' } },
		])
	})

	it('serializeSegmentExtended strips cyclic refs from layers', () => {
		const result = serializeSegmentExtended({
			_id: 'segment0',
			outputLayers: {
				ol1: { _id: 'ol1', sourceLayers: [{ _id: 'sl1' }] },
			},
			sourceLayers: {
				sl1: { _id: 'sl1', pieces: [{ _id: 'pieceA' }, { instance: { _id: 'pieceB' } }] },
			},
		})

		expect(result.outputLayers.ol1.sourceLayers).toEqual([])
		expect(result.sourceLayers.sl1.pieces).toEqual(['pieceA', 'pieceB'])
	})
})
