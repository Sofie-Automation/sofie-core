import { JSONBlobParse, JSONBlobStringify } from '../lib/JSONBlob.js'

test('JSONBlob', () => {
	// Unit test:
	interface A {
		a: number
	}
	const a: A = {
		a: 1,
	}
	const checkTypeIsA = (_o: A) => {
		// nothing
	}
	interface B {
		b: number
	}
	const b: B = {
		b: 1,
	}

	try {
		// Note: This part is not intended to actually be executed, just to check types

		// @ts-expect-error JSONBlobParse should only accept a JSONBlob
		JSONBlobParse(a)
		// @ts-expect-error JSONBlobParse should only accept a JSONBlob
		JSONBlobParse(str)
		// @ts-expect-error JSON.parse should not accept a JSONBlob
		JSON.parse(a)
	} catch (_err) {
		// ignore execution errors
	}

	const str = 'string'

	const aBlob = JSONBlobStringify(a)
	const a2 = JSONBlobParse(aBlob)

	checkTypeIsA(a2)

	const bBlob = JSONBlobStringify(b)
	const b2 = JSONBlobParse(bBlob)

	// @ts-expect-error verify that A !== B
	checkTypeIsA(b2)

	expect(a2).toMatchObject(a)
	expect(b2).toMatchObject(b)
})
