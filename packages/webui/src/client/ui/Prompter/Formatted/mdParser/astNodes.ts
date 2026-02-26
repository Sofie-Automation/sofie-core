interface NodeBase {
	type: string
}

export interface ParentNodeBase extends NodeBase {
	children: Node[]
}

export interface RootNode extends ParentNodeBase {
	type: 'root'
}

export interface ParagraphNode extends ParentNodeBase {
	type: 'paragraph'
}

export interface TextNode extends NodeBase {
	type: 'text'
	value: string
}

export interface StrongNode extends ParentNodeBase {
	type: 'strong'
	code: string
}

export interface EmphasisNode extends ParentNodeBase {
	type: 'emphasis'
	code: string
}

export interface UnderlineNode extends ParentNodeBase {
	type: 'underline'
	code: string
}

export interface HiddenNode extends ParentNodeBase {
	type: 'hidden'
	code: string
}

export interface ReverseNode extends ParentNodeBase {
	type: 'reverse'
	code: string
}

export interface ColourNode extends ParentNodeBase {
	type: 'colour'
	code: string
	colour: string
}

export interface BackScreenMarkerNode extends NodeBase {
	type: 'screenMarker'
}

export type Node =
	| RootNode
	| ParagraphNode
	| TextNode
	| StrongNode
	| EmphasisNode
	| ReverseNode
	| UnderlineNode
	| HiddenNode
	| ColourNode
	| BackScreenMarkerNode
