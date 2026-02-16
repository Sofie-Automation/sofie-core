import { getElementWidth, getElementHeight } from '../dimensions.js'

describe('client/utils/dimensions', () => {
	let getComputedStyle: jest.SpyInstance

	beforeEach(() => {
		getComputedStyle = jest.spyOn(window, 'getComputedStyle')
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	describe('getElementWidth', () => {
		test('returns width from getComputedStyle when it has a numeric value', () => {
			const expected = 20
			const element = document.createElement('div')
			getComputedStyle.mockImplementation((el: Element) =>
				el === element ? ({ width: expected } as any) : ({} as any)
			)

			const actual = getElementWidth(element)

			expect(actual).toEqual(expected)
		})

		test('returns element.offsetWidth - computed horizontal padding when computed width is auto', () => {
			const paddingLeft = 10
			const paddingRight = 15
			const offsetWidth = 63
			const expected = offsetWidth - paddingLeft - paddingRight

			const element = document.createElement('div')
			Object.defineProperty(element, 'offsetWidth', { value: offsetWidth })
			getComputedStyle.mockImplementation((el: Element) =>
				el === element ? ({ width: 'auto', paddingLeft, paddingRight } as any) : ({} as any)
			)

			const actual = getElementWidth(element)

			expect(actual).toEqual(expected)
		})
	})

	describe('getElementHeight', () => {
		test('returns height from getComputedStyle when it has a numeric value', () => {
			const expected = 20
			const element = document.createElement('div')
			getComputedStyle.mockImplementation((el: Element) =>
				el === element ? ({ height: expected } as any) : ({} as any)
			)

			const actual = getElementHeight(element)

			expect(actual).toEqual(expected)
		})

		test('returns element.scrollHeight - computed vertical padding when computed height is auto', () => {
			const paddingTop = 8
			const paddingBottom = 9
			const scrollHeight = 37
			const expected = scrollHeight - paddingTop - paddingBottom

			const element = document.createElement('div')
			Object.defineProperty(element, 'scrollHeight', { value: scrollHeight })
			getComputedStyle.mockImplementation((el: Element) =>
				el === element ? ({ height: 'auto', paddingTop, paddingBottom } as any) : ({} as any)
			)

			const actual = getElementHeight(element)

			expect(actual).toEqual(expected)
		})
	})
})
