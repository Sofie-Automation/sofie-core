import { NodeConstruct, ParserState, CharHandlerResult } from '../parserState'
import { EmphasisNode, StrongNode, Node, ParentNodeBase } from '../astNodes'

export function emphasisAndStrong(): NodeConstruct {
	function emphasisOrStrong(char: string, state: ParserState): CharHandlerResult | void {
		if (state.nodeCursor === null) throw new Error('cursor === null assertion')

		let len = 1
		let peeked = state.peek(len)
		while (peeked && peeked.length === len && peeked.slice(-1) === char) {
			len++
			peeked = state.peek(len)
		}

		if (len > 2) return // this parser only handles 2 chars

		if (state.nodeCursor && isEmphasisOrStrongNode(state.nodeCursor)) {
			if (state.nodeCursor.code === char && state.nodeCursor.type === 'emphasis' && len === 1) {
				state.flushBuffer()
				state.popNode()
				return CharHandlerResult.StopProcessingNoBuffer
			}
			if (state.nodeCursor.code.startsWith(char) && state.nodeCursor.type === 'strong' && len === 2) {
				state.consume()
				state.flushBuffer()
				state.popNode()
				return CharHandlerResult.StopProcessingNoBuffer
			}
		}

		state.flushBuffer()

		let type: 'emphasis' | 'strong' = 'emphasis'

		if (len === 2) {
			type = 'strong'
			char += state.consume()
		}

		const emphasisOrStrongNode: EmphasisNode | StrongNode = {
			type,
			children: [],
			code: char,
		}
		state.pushNode(emphasisOrStrongNode)

		return CharHandlerResult.StopProcessingNoBuffer
	}

	return {
		name: 'emphasisOrStrong',
		char: {
			'*': emphasisOrStrong,
			_: emphasisOrStrong,
		},
	}
}

function isEmphasisOrStrongNode(node: Node | ParentNodeBase): node is EmphasisNode | StrongNode {
	return node.type === 'emphasis' || node.type === 'strong'
}
