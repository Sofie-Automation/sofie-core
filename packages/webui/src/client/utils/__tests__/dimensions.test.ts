import { getElementWidth, getElementHeight } from '../dimensions'
import { createSandbox, SinonStub } from 'sinon'

const sandbox = createSandbox()

describe('client/utils/dimensions', () => {
	type getComputedStyleType = (typeof window)['getComputedStyle']
	let getComputedStyle: SinonStub<Parameters<getComputedStyleType>, any> //ReturnType<getComputedStyleType>>

	beforeEach(() => {
		getComputedStyle = sandbox.stub(window, 'getComputedStyle')
	})

	afterEach(() => {
		sandbox.restore()
	})

	describe('getElementWidth', () => {
		test('returns width from getComputedStyle when it has a numeric value', () => {
			const expected = 20
			const element = document.createElement('div')
			getComputedStyle.withArgs(element).returns({ width: expected })

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
			getComputedStyle.withArgs(element).returns({ width: 'auto', paddingLeft, paddingRight })

			const actual = getElementWidth(element)

			expect(actual).toEqual(expected)
		})
	})

	describe('getElementHeight', () => {
		test('returns height from getComputedStyle when it has a numeric value', () => {
			const expected = 20
			const element = document.createElement('div')
			getComputedStyle.withArgs(element).returns({ height: expected })

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
			getComputedStyle.withArgs(element).returns({ height: 'auto', paddingTop, paddingBottom })

			const actual = getElementHeight(element)

			expect(actual).toEqual(expected)
		})
	})
})
