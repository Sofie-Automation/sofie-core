import { ParentNodeBase } from './astNodes'

export interface ParserState {
	/** The current stack of nodes as set up leading to the current character */
	readonly nodeStack: ParentNodeBase[]
	/** The top of the nodeStack */
	nodeCursor: ParentNodeBase | null
	/** A buffer to collect characters that don't create or mutate nodes (text) */
	buffer: string
	/** The position of the current character */
	charCursor: number
	/** An dataStore that can be read and written to by NodeConstruct Handlers. */
	readonly dataStore: Record<string, unknown>
	/** Create a new text node and append as a child to the node under nodeCursor */
	flushBuffer(): void
	/** Create a new backscreen marker node and append as a child to the node under nodeCursor */
	setMarker(): void
	/** Append a new child node to the node at the top of the nodeStack, and push it onto the nodeStack */
	pushNode(node: ParentNodeBase): void
	/** Pop a ParentNode from the nodeStack */
	popNode(): void
	/** Append a new child node to the root node and clear the stack */
	replaceStack(node: ParentNodeBase): void
	/** Get the specified number of characters immediately after the current one (default = 1) */
	peek(n?: number): string | undefined
	/** Move the charCursor to the next character */
	consume(): string | undefined
}

export enum CharHandlerResult {
	/** Stop all processing of this character and append it to the text buffer */
	StopProcessing = 1,
	/** Stop all processing of this character and don't append it to the text buffer */
	StopProcessingNoBuffer = 2,
}

export type CharHandler = (char: string, state: ParserState) => void | undefined | CharHandlerResult

/** A NodeConstruct is a set of character handlers that process a type of a node */
export interface NodeConstruct {
	name?: string
	char: Record<string, CharHandler>
}
