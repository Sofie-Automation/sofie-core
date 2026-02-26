import { NodeConstruct, ParserState, CharHandlerResult } from '../parserState'
import { ReverseNode } from '../astNodes'

export function reverse(): NodeConstruct {
	function reverse(char: string, state: ParserState): CharHandlerResult | void {
		if (state.nodeCursor === null) throw new Error('cursor === null assertion')
		if (state.nodeCursor.type === 'reverse' && 'code' in state.nodeCursor) {
			if (state.nodeCursor.code === char) {
				state.flushBuffer()
				state.popNode()
				return CharHandlerResult.StopProcessingNoBuffer
			}
		}

		state.flushBuffer()

		const type = 'reverse'

		const reverseNode: ReverseNode = {
			type,
			children: [],
			code: char,
		}
		state.pushNode(reverseNode)

		return CharHandlerResult.StopProcessingNoBuffer
	}

	return {
		name: 'reverse',
		char: {
			'~': reverse,
		},
	}
}
