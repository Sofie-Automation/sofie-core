import { NodeConstruct, ParserState, CharHandlerResult } from '../parserState'
import { ParagraphNode } from '../astNodes'

export function paragraph(): NodeConstruct {
	function paragraphStart(char: string, state: ParserState) {
		if (state.nodeCursor !== null) return
		if (char === '\n') return
		const newParagraph: ParagraphNode = {
			type: 'paragraph',
			children: [],
		}
		state.replaceStack(newParagraph)
	}

	function paragraphEnd(_char: string, state: ParserState): CharHandlerResult {
		if (state.nodeCursor === null) {
			return CharHandlerResult.StopProcessingNoBuffer
		}

		state.flushBuffer()
		state.nodeCursor = null

		return CharHandlerResult.StopProcessingNoBuffer
	}

	return {
		name: 'paragraph',
		char: {
			end: paragraphEnd,
			'\n': paragraphEnd,
			any: paragraphStart,
		},
	}
}
