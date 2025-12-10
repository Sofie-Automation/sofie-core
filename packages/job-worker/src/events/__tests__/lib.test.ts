import { escapeHtml } from '../lib.js'

describe('lib', () => {
	test('escapeHtml', () => {
		expect(escapeHtml(`<div>Hello & goodbye! Please use '"'-signs!</div>`)).toBe(
			`&lt;div&gt;Hello &amp; goodbye! Please use &#039;&quot;&#039;-signs!&lt;/div&gt;`
		)
	})
})
