import { encodeMessage, decodeMessage } from '../wireCodec'
import { ServerMessage } from '@sofie-automation/shared-lib/dist/ddp/messageTypes'

describe('wireCodec', () => {
	test('encodes a server message to a JSON string and round-trips back', () => {
		const msg: ServerMessage = { msg: 'added', collection: 'C', id: 'x', fields: { a: 1, nested: { b: 2 } } }
		const encoded = encodeMessage(msg)
		expect(typeof encoded).toBe('string')
		expect(decodeMessage(encoded as any)).toEqual(msg)
	})

	test('EJSON preserves types JSON would lose (Date)', () => {
		const when = new Date('2020-01-02T03:04:05.000Z')
		const encoded = encodeMessage({ msg: 'changed', collection: 'C', id: 'x', fields: { when } } as any)
		const decoded = decodeMessage(encoded as any) as any
		expect(decoded.fields.when).toBeInstanceOf(Date)
		expect(decoded.fields.when.getTime()).toBe(when.getTime())
	})

	test('decodes string, Buffer and Buffer[] frames identically', () => {
		const json = encodeMessage({ msg: 'ready', subs: ['s1'] })
		const asString = decodeMessage(json as any)
		const asBuffer = decodeMessage(Buffer.from(json, 'utf8'))
		const asBufferArray = decodeMessage([Buffer.from(json.slice(0, 4)), Buffer.from(json.slice(4))])

		expect(asString).toEqual({ msg: 'ready', subs: ['s1'] })
		expect(asBuffer).toEqual(asString)
		expect(asBufferArray).toEqual(asString)
	})

	test('returns undefined (does not throw) on malformed input', () => {
		expect(decodeMessage('not json {' as any)).toBeUndefined()
		expect(decodeMessage(Buffer.from('also not json', 'utf8'))).toBeUndefined()
	})
})
