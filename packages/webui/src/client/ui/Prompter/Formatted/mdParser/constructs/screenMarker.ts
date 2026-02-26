import { NodeConstruct, ParserState, CharHandlerResult } from '../parserState'

export function screenMarker(): NodeConstruct {
	function screenMarker(_: string, state: ParserState) {
		if (state.nodeCursor === null) throw new Error('cursor === null assertion')
		if (state.peek(2) !== 'X)') return

		// consume twice to rid of "X)"
		state.consume()
		state.consume()

		state.flushBuffer()
		state.setMarker()

		return CharHandlerResult.StopProcessingNoBuffer
	}

	return {
		name: 'screenMarker',
		char: {
			'(': screenMarker,
		},
	}
}
