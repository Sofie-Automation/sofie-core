import { ParentNodeBase, RootNode, Node } from './astNodes'
import { colour } from './constructs/colour'
import { emphasisAndStrong } from './constructs/emphasisAndStrong'
import { escape } from './constructs/escape'
import { paragraph } from './constructs/paragraph'
import { reverse } from './constructs/reverse'
import { screenMarker } from './constructs/screenMarker'
import { underlineOrHide } from './constructs/underlineOrHide'
import { CharHandler, CharHandlerResult, NodeConstruct, ParserState } from './parserState'

export class ParserStateImpl implements ParserState {
	readonly nodeStack: ParentNodeBase[] = []
	nodeCursor: ParentNodeBase | null = null
	buffer: string = ''
	charCursor: number = 0
	readonly dataStore: Record<string, unknown> = {}

	constructor(
		private document: RootNode,
		private text: string
	) {}

	flushBuffer = (): void => {
		if (this.buffer === '') return
		if (this.nodeCursor === null) throw new Error('No node available to flush buffer.')

		this.nodeCursor.children.push({
			type: 'text',
			value: this.buffer,
		})
		this.buffer = ''
	}
	setMarker = (): void => {
		if (this.nodeCursor === null) throw new Error('No node available to set marker.')

		this.nodeCursor.children.push({
			type: 'screenMarker',
		})
	}
	pushNode = (node: ParentNodeBase): void => {
		if (this.nodeCursor !== null) {
			this.nodeCursor.children.push(node as Node)
		}
		this.nodeStack.push(node)
		this.nodeCursor = node
	}
	popNode = (): void => {
		this.nodeStack.pop()
		this.nodeCursor = this.nodeStack[this.nodeStack.length - 1] ?? null
	}
	replaceStack = (node: ParentNodeBase): void => {
		this.document.children.push(node as Node)
		this.nodeCursor = node
		this.nodeStack.length = 0
		this.nodeStack.push(this.nodeCursor)
	}
	peek = (n = 1): string => {
		return this.text.slice(this.charCursor + 1, this.charCursor + n + 1)
	}
	consume = (): string => {
		if (this.text[this.charCursor + 1] === undefined) throw new Error('No more text available to parse')
		this.charCursor++
		return this.text[this.charCursor]
	}
}

export type Parser = (text: string) => RootNode

export default function createParser(): Parser {
	const nodeConstructs: NodeConstruct[] = [
		paragraph(),
		escape(),
		emphasisAndStrong(),
		reverse(),
		underlineOrHide(),
		colour(),
		screenMarker(),
	]

	const charHandlers: Record<string, CharHandler[]> = {}

	for (const construct of nodeConstructs) {
		for (const [char, handler] of Object.entries<CharHandler>(construct.char)) {
			if (!charHandlers[char]) charHandlers[char] = []
			charHandlers[char].push(handler)
		}
	}

	function runAll(handlers: CharHandler[], char: string, state: ParserState): void | undefined | CharHandlerResult {
		for (const handler of handlers) {
			const result = handler(char, state)
			if (typeof result === 'number') return result
		}
	}

	return function astFromMarkdownish(text: string): RootNode {
		performance.mark('astFromMarkdownishBegin')

		const document: RootNode = {
			type: 'root',
			children: [],
		}

		const state = new ParserStateImpl(document, text)

		for (state.charCursor = 0; state.charCursor < text.length; state.charCursor++) {
			const char = text[state.charCursor]
			let preventOthers = false
			if (!preventOthers && charHandlers['any']) {
				const result = runAll(charHandlers['any'], char, state)
				if (result === CharHandlerResult.StopProcessingNoBuffer) continue
				if (result === CharHandlerResult.StopProcessing) preventOthers = true
			}
			if (!preventOthers && charHandlers[char]) {
				const result = runAll(charHandlers[char], char, state)
				if (result === CharHandlerResult.StopProcessingNoBuffer) continue
				if (result === CharHandlerResult.StopProcessing) preventOthers = true
			}
			state.buffer += char
		}

		if (charHandlers['end']) runAll(charHandlers['end'], 'end', state)

		performance.mark('astFromMarkdownishEnd')

		return document
	}
}
