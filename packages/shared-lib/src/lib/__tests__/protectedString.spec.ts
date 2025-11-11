import {
	ProtectedString,
	protectString,
	protectStringArray,
	unprotectObject,
	unprotectString,
	unprotectStringArray,
} from '../protectedString.js'

describe('ProtectedString', () => {
	test('stringifies properly', async () => {
		const id = protectString('abc')

		expect(id).toEqual('abc')
		expect(`hello ${id}`).toEqual('hello abc')

		expect(unprotectString(id)).toEqual('abc')
	})
	test('protectStringObject', async () => {
		const protectedObj = {
			str: 'abc',
			protectedStr: protectString('def'),
			obj: {
				str: 'abc',
				protectedStr: protectString('def'),
			},
		}

		assertString(protectedObj.str)
		assertProtectedString(protectedObj.protectedStr)
		assertString(protectedObj.obj.str)
		assertProtectedString(protectedObj.obj.protectedStr)
		expect(protectedObj).toEqual({
			str: 'abc',
			protectedStr: 'def',
			obj: {
				str: 'abc',
				protectedStr: 'def',
			},
		})

		const stringObj = unprotectObject(protectedObj)

		assertString(stringObj.str)
		assertString(stringObj.protectedStr)
		assertString(stringObj.obj.str)
		assertString(stringObj.obj.protectedStr)
		expect(stringObj).toEqual({
			str: 'abc',
			protectedStr: 'def',
			obj: {
				str: 'abc',
				protectedStr: 'def',
			},
		})
	})
	test('protectStringArray', async () => {
		const protectedArray = protectStringArray(['abc', 'def'])
		assertProtectedString(protectedArray[0])
		assertProtectedString(protectedArray[1])
		expect(protectedArray).toEqual(['abc', 'def'])

		const stringArray = unprotectStringArray(protectedArray)

		assertString(stringArray[0])
		assertString(stringArray[1])
		expect(stringArray).toEqual(['abc', 'def'])
	})
})
function assertProtectedString(_value: ProtectedString<any>): void {
	// nothing, is a type guard
}
function assertString(_value: string): void {
	// nothing, is a type guard
}
