import { objectToXML } from '../object-to-xml'

describe('objectToXML', () => {
	describe('basic canary tests', () => {
		const rootName = 'dre'
		const xmlDoc = objectToXML({}, rootName)

		it('should return a valid XML document', () => {
			expect(xmlDoc).toBeInstanceOf(Document)
		})

		it('should use the given name for its root node', () => {
			expect(xmlDoc.documentElement.nodeName).toEqual(rootName)
		})
	})

	describe('Node creation', () => {
		it('should create a text node for a property with a string value', () => {
			const nodeName = 'hehe'
			const nodevalue = 'lol'
			const input: any = {}
			input[nodeName] = nodevalue

			const xmlDoc = objectToXML(input, 'root')

			expect(xmlDoc.documentElement.querySelector(nodeName)?.textContent).toEqual(nodevalue)
		})
	})

	describe('Attribute creation', () => {
		it('should create an attribute node for a property in property named _attributes', () => {
			const attributeName = 'data-lol'
			const attributeValue = 'hehe'
			const _attributes: any = {}
			_attributes[attributeName] = attributeValue
			const input = {
				_attributes,
			}

			const xmlDoc = objectToXML(input, 'root')

			expect(xmlDoc.documentElement.getAttribute(attributeName)).toEqual(attributeValue)
		})
	})
})
