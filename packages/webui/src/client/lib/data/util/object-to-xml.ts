export function objectToXML(obj: object, rootName: string): Document {
	const doc = new Document()
	const root = doc.createElement(rootName)

	addNodes(obj, root)

	doc.appendChild(root)
	return doc
}

function addNodes(obj: object, rootNode: Node): void {
	const doc = rootNode.ownerDocument
	if (!doc) {
		// this should never happen, given that this is an internal function
		// and that the rootNode is explicitly created from a document in
		// both objectToXML() and createNode(), who are the only callers of
		// this function
		throw new Error('Root node has no owner document.')
	}

	for (const name of Object.keys(obj)) {
		const value = (obj as any)[name]

		if (typeof value === 'object' && name === '_attributes') {
			// only Elements can have attributes
			if (rootNode instanceof Element) {
				for (const attrName of Object.keys(value)) {
					rootNode.setAttribute(attrName, value[attrName])
				}
			}
		} else if (Array.isArray(value)) {
			value.forEach((element) => {
				rootNode.appendChild(createNode(name, element, doc))
			})
		} else if (value !== undefined) {
			rootNode.appendChild(createNode(name, value, doc))
		}
	}
}

function createNode(name: string, value: any, doc: Document) {
	const node = doc.createElement(name)

	if (typeof value === 'object' && value !== null) {
		addNodes(value, node)
	} else {
		node.textContent = value
	}

	return node
}
