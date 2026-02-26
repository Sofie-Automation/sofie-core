import { ColourNode } from '../astNodes'
import { NodeConstruct, ParserState, CharHandlerResult } from '../parserState'

export function colour(): NodeConstruct {
	function colour(char: string, state: ParserState): CharHandlerResult | void {
		if (state.nodeCursor === null) throw new Error('cursor === null assertion')

		/**
		 * support for:
		 * [colour=#ff0000][/colour] => red text
		 * [colour=#ffff00][/colour] => yellow text
		 *
		 * i.e. the colour tag uses a hex code but does not actually support hex codes.
		 * in the future we can support more colours easily, and the length of the tag is stable
		 * which means the parsing is a bit simpler.
		 */

		let rest = state.peek(15)
		let end = false
		if (rest?.startsWith('/')) {
			end = true
			rest = state.peek(8)?.slice(1)
		}
		if (!rest || (end ? rest.length < 7 : rest.length < 15)) return
		if (!rest?.endsWith(']')) return
		if (!rest.includes('colour')) return

		if (end) {
			if (state.nodeCursor.type === 'colour') {
				for (let i = 0; i < 8; i++) state.consume()
				state.flushBuffer()
				state.popNode()
				return CharHandlerResult.StopProcessingNoBuffer
			}
		} else {
			for (let i = 0; i < 15; i++) state.consume()

			state.flushBuffer()

			const colourNode: ColourNode = {
				type: 'colour',
				children: [],
				code: char,
				colour: rest.slice(7, 14),
			}
			state.pushNode(colourNode)

			return CharHandlerResult.StopProcessingNoBuffer
		}
	}

	return {
		name: 'colour',
		char: {
			'[': colour,
		},
	}
}
