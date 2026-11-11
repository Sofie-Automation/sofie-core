import {
	type UnknownProtectedString,
	type ProtectedString,
	protectString,
	protectStringArray,
	unprotectObject,
	unprotectString,
	unprotectStringArray,
	type ValueOfProtectedString,
} from '../protectedString.js'

/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

describe('ProtectedString', () => {
	test('stringifies properly', async () => {
		function testTypes<T extends UnknownProtectedString>(_v: T): void {
			{
				// Simple ProtectedString:

				type A = ProtectedString<'A'>
				const id = protectString<A>('abc')
				expect(id).toEqual('abc')
				expect(`hello ${id}`).toEqual('hello abc')
				expect(unprotectString(id)).toEqual('abc')
			}
			{
				// ProtectedString with template literal_

				type A = ProtectedString<'A', `a/${string}`>

				// @ts-expect-error: wrong template literal:
				protectString<A>('abc')

				// matching template literal:
				protectString<A>('a/hello')
			}
		}
		testTypes(protectString('a'))
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
		const assertString = testAssertType<string>
		const assertProtectedString = testAssertType<UnknownProtectedString>

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
		const assertString = testAssertType<string>
		const assertProtectedString = testAssertType<UnknownProtectedString>

		const protectedArray = protectStringArray(['abc', 'def'])
		assertProtectedString(protectedArray[0])
		assertProtectedString(protectedArray[1])
		expect(protectedArray).toEqual(['abc', 'def'])

		const stringArray = unprotectStringArray(protectedArray)

		assertString(stringArray[0])
		assertString(stringArray[1])
		expect(stringArray).toEqual(['abc', 'def'])
	})
	test('type tests', () => {
		expect(1).toBe(1)

		const x: unknown = ''

		// string:
		{
			const test = testAssertType<string>

			// Assign any:
			test(x as any)

			// @ts-expect-error: Assign unknown:
			test(x as unknown)

			// @ts-expect-error: Assign number:
			test(x as number)

			// Assign string:
			test(x as string)

			// Assign UnknownProtectedString:
			test(x as UnknownProtectedString)

			// Assign a ProtectedString:
			test(x as ProtectedString<'a'>)

			// Assign a ProtectedString-template-literal:
			test(x as ProtectedString<'c', `a/${string}`>)

			// Convert a ProtectedString-template-literal into a string
			test(unprotectString(x as ProtectedString<'a'>))
			test(unprotectString(x as ProtectedString<'a', `a/${string}`>))
			test(x as ValueOfProtectedString<ProtectedString<'a'>>)
			test(x as ValueOfProtectedString<ProtectedString<'a', `a/${string}`>>)
		}

		// UnknownProtectedString:
		{
			const assertType = testAssertType<UnknownProtectedString>

			// Assign any:
			assertType(x as any)

			// @ts-expect-error: Assign unknown:
			assertType(x as unknown)

			// @ts-expect-error: Assign number:
			assertType(x as number)

			//  @ts-expect-error: Assign string:
			assertType(x as string)

			// Assign UnknownProtectedString:
			assertType(x as UnknownProtectedString)

			// Assign a ProtectedString:
			assertType(x as ProtectedString<'a'>)

			// Assign a ProtectedString-template-literal:
			assertType(x as ProtectedString<'a', `a/${string}`>)
		}

		// ProtectedString:
		{
			const test = testAssertType<ProtectedString<'a'>>

			// Assign any:
			test(x as any)

			// @ts-expect-error: Assign unknown:
			test(x as unknown)

			// @ts-expect-error: Assign number:
			test(x as number)

			//  @ts-expect-error: Assign string:
			test(x as string)

			// @ts-expect-error: Assign string:
			test(x as string)

			// @ts-expect-error: Assign UnknownProtectedString:
			test(x as UnknownProtectedString)

			// Assign a ProtectedString:
			test(x as ProtectedString<'a'>)

			// Assign a ProtectedString-template-literal of same base type:
			test(x as ProtectedString<'a', `a/${string}`>)

			// @ts-expect-error: Assign a ProtectedString-template-literal of another base type:
			test(x as ProtectedString<'b', `a/${string}`>)
		}

		// ProtectedString Template literals:
		{
			type TYPE = ProtectedString<'a', `a/${string}`>
			const test = testAssertType<TYPE>

			// Assign any:
			test(x as any)

			// @ts-expect-error: Assign unknown:
			test(x as unknown)

			// @ts-expect-error: Assign number:
			test(x as number)

			//  @ts-expect-error: Assign string:
			test(x as string)

			// @ts-expect-error: Assign string:
			test(x as string)

			// @ts-expect-error: Assign UnknownProtectedString:
			test(x as UnknownProtectedString)

			// @ts-expect-error: Assign a ProtectedString:
			test(x as ProtectedString<'a'>)

			// Assign a ProtectedString-template-literal of same base type:
			test(x as ProtectedString<'a', `a/${string}`>)

			// Assign other (but compatible) template literal:
			test(x as ProtectedString<'a', `a/my/${string}`>)

			// @ts-expect-error: Assign a ProtectedString-template-literal of another base type:
			test(x as ProtectedString<'b', `a/${string}`>)
		}
		// Template literals:
		{
			type TYPE = `a/${string}`
			const test = testAssertType<TYPE>

			// Assign any:
			test(x as any)

			// @ts-expect-error: Assign unknown:
			test(x as unknown)

			// @ts-expect-error: Assign number:
			test(x as number)

			//  @ts-expect-error: Assign string:
			test(x as string)

			// @ts-expect-error: Assign string:
			test(x as string)

			// @ts-expect-error: Assign UnknownProtectedString:
			test(x as UnknownProtectedString)

			// @ts-expect-error: Assign a ProtectedString:
			test(x as ProtectedString<'a'>)

			// @ts-expect-error: Assign a ProtectedString-template-literal of same base type:
			test(x as ProtectedString<'a', `a/${string}`>)

			// @ts-expect-error: Assign other (but compatible) template literal:
			test(x as ProtectedString<'a', `a/my/${string}`>)

			// @ts-expect-error: Assign a ProtectedString-template-literal of another base type:
			test(x as ProtectedString<'b', `a/${string}`>)

			// @ts-expect-error: unprotect incompatible ProtectedString:
			test(unprotectString(x as ProtectedString<'a'>))
			// @ts-expect-error: incompatible ProtectedString:
			test(x as ValueOfProtectedString<ProtectedString<'a'>>)

			// unprotect incompatible ProtectedString:
			test(unprotectString(x as ProtectedString<'a', `a/${string}`>))
			// incompatible ProtectedString:
			test(x as ValueOfProtectedString<ProtectedString<'a', `a/${string}`>>)
		}
	})
})

function testAssertType<T>(_: T): void {
	// nothing, type check only
}
