import React, { useMemo } from 'react'
import createParser from './mdParser'
import { Node, ParentNodeBase } from './mdParser/astNodes'
import { assertNever } from '@sofie-automation/shared-lib/dist/lib/lib'

const mdParser = createParser()

export function MdDisplay({ source }: { source: string }): React.ReactNode {
	const rootNode = useMemo(() => mdParser(source), [source])

	return <MdNode content={rootNode} />
}

function MdNode({ content }: { content: Node }): React.ReactNode {
	switch (content.type) {
		case 'paragraph':
			if (content.children.length === 0) return <p>&nbsp;</p>
			return <p>{renderChildren(content)}</p>
		case 'root':
			return <>{renderChildren(content)}</>
		case 'emphasis':
			return <i>{renderChildren(content)}</i>
		case 'strong':
			return <b>{renderChildren(content)}</b>
		case 'reverse':
			return React.createElement('span', { className: 'reverse' }, renderChildren(content))
		case 'underline':
			return React.createElement('u', {}, renderChildren(content))
		case 'colour':
			return React.createElement(
				'span',
				{
					style: {
						'--foreground-color': content.colour,
					},
				},
				renderChildren(content)
			)
		case 'text':
			return content.value
		case 'hidden':
			return null
		case 'screenMarker':
			return React.createElement('span', { className: 'screen-marker' }, '❤️')
		default:
			assertNever(content)
			return null
	}
}

function renderChildren(content: ParentNodeBase): React.ReactNode {
	return (
		<>
			{content.children.map((node, index) => (
				<MdNode key={index + '_' + node.type} content={node} />
			))}
		</>
	)
}
