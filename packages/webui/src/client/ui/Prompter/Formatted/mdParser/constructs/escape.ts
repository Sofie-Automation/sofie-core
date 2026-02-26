import { CharHandlerResult, NodeConstruct, ParserState } from '../parserState'

export function escape(): NodeConstruct {
	function escapeChar(_: string, state: ParserState): CharHandlerResult | void {
		if (state.peek() === undefined || state.peek() === '') {
			// Trailing backslash with nothing to escape — treat as literal
			return
		}
		state.dataStore['inEscape'] = true
		return CharHandlerResult.StopProcessingNoBuffer
	}

	function passthroughChar(_: string, state: ParserState): CharHandlerResult | void {
		if (state.dataStore['inEscape'] !== true) return
		state.dataStore['inEscape'] = false
		return CharHandlerResult.StopProcessing
	}

	return {
		name: 'escape',
		char: {
			'\\': escapeChar,
			any: passthroughChar,
		},
	}
}
