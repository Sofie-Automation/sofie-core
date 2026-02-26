import createParser, { Parser } from '../index'
import { RootNode, Node } from '../astNodes'

// The parser uses performance.mark which may not exist in jsdom
if (typeof performance.mark !== 'function') {
	performance.mark = (() => {}) as any
}

let parse: Parser

beforeEach(() => {
	parse = createParser()
})

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Shorthand to extract the first paragraph's children */
function firstParagraph(root: RootNode): Node[] {
	expect(root.children.length).toBeGreaterThanOrEqual(1)
	const p = root.children[0]
	expect(p).toHaveProperty('type', 'paragraph')
	return (p as any).children
}

// ─── Plain text ─────────────────────────────────────────────────────────────

describe('plain text', () => {
	test('simple text becomes a paragraph with a text node', () => {
		const result = parse('hello world')
		expect(result.type).toBe('root')
		expect(result.children).toHaveLength(1)

		const p = result.children[0]
		expect(p).toMatchObject({
			type: 'paragraph',
			children: [{ type: 'text', value: 'hello world' }],
		})
	})

	test('empty string produces no paragraphs', () => {
		const result = parse('')
		expect(result.type).toBe('root')
		expect(result.children).toHaveLength(0)
	})

	test('whitespace-only text produces a paragraph with whitespace', () => {
		const result = parse('   ')
		expect(result.children).toHaveLength(1)
		expect(result.children[0]).toMatchObject({
			type: 'paragraph',
			children: [{ type: 'text', value: '   ' }],
		})
	})
})

// ─── Paragraphs ─────────────────────────────────────────────────────────────

describe('paragraphs', () => {
	test('newline separates two paragraphs', () => {
		const result = parse('first\nsecond')
		expect(result.children).toHaveLength(2)
		expect(result.children[0]).toMatchObject({
			type: 'paragraph',
			children: [{ type: 'text', value: 'first' }],
		})
		expect(result.children[1]).toMatchObject({
			type: 'paragraph',
			children: [{ type: 'text', value: 'second' }],
		})
	})

	test('multiple newlines create separate paragraphs', () => {
		const result = parse('a\nb\nc')
		expect(result.children).toHaveLength(3)
		expect(result.children[0]).toMatchObject({
			type: 'paragraph',
			children: [{ type: 'text', value: 'a' }],
		})
		expect(result.children[1]).toMatchObject({
			type: 'paragraph',
			children: [{ type: 'text', value: 'b' }],
		})
		expect(result.children[2]).toMatchObject({
			type: 'paragraph',
			children: [{ type: 'text', value: 'c' }],
		})
	})

	test('trailing newline does not create an extra empty paragraph', () => {
		const result = parse('hello\n')
		expect(result.children).toHaveLength(1)
		expect(result.children[0]).toMatchObject({
			type: 'paragraph',
			children: [{ type: 'text', value: 'hello' }],
		})
	})

	test('consecutive newlines do not create empty paragraphs', () => {
		const result = parse('one\n\ntwo')
		expect(result.children).toHaveLength(2)
	})
})

// ─── Escape ─────────────────────────────────────────────────────────────────

describe('escape', () => {
	test('backslash escapes asterisk', () => {
		const result = parse('hello \\*world')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: 'hello *world' }])
	})

	test('backslash escapes backslash', () => {
		const result = parse('hello \\\\world')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: 'hello \\world' }])
	})

	test('backslash escapes tilde', () => {
		const result = parse('\\~not reverse')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: '~not reverse' }])
	})

	test('backslash escapes pipe', () => {
		const result = parse('\\|not hidden')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: '|not hidden' }])
	})

	test('backslash escapes bracket', () => {
		const result = parse('\\[not colour')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: '[not colour' }])
	})

	test('backslash escapes dollar sign', () => {
		const result = parse('\\$not hidden')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: '$not hidden' }])
	})

	test('backslash before regular character passes both through', () => {
		const result = parse('\\a')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: 'a' }])
	})

	test('trailing backslash is preserved as literal text', () => {
		const result = parse('hello\\')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: 'hello\\' }])
	})
})

// ─── Emphasis & Strong ─────────────────────────────────────────────────────

describe('emphasis and strong', () => {
	test('*text* produces emphasis', () => {
		const result = parse('*hello*')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'emphasis',
				code: '*',
				children: [{ type: 'text', value: 'hello' }],
			},
		])
	})

	test('_text_ produces emphasis', () => {
		const result = parse('_hello_')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'emphasis',
				code: '_',
				children: [{ type: 'text', value: 'hello' }],
			},
		])
	})

	test('**text** produces strong', () => {
		const result = parse('**hello**')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'strong',
				code: '**',
				children: [{ type: 'text', value: 'hello' }],
			},
		])
	})

	test('__text__ produces strong', () => {
		const result = parse('__hello__')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'strong',
				code: '__',
				children: [{ type: 'text', value: 'hello' }],
			},
		])
	})

	test('emphasis with surrounding text', () => {
		const result = parse('before *middle* after')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{ type: 'text', value: 'before ' },
			{
				type: 'emphasis',
				code: '*',
				children: [{ type: 'text', value: 'middle' }],
			},
			{ type: 'text', value: ' after' },
		])
	})

	test('strong with surrounding text', () => {
		const result = parse('before **middle** after')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{ type: 'text', value: 'before ' },
			{
				type: 'strong',
				code: '**',
				children: [{ type: 'text', value: 'middle' }],
			},
			{ type: 'text', value: ' after' },
		])
	})

	test('single * does not close ** strong', () => {
		const result = parse('**bold*rest')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'strong',
				code: '**',
				children: [
					{ type: 'text', value: 'bold' },
					{
						type: 'emphasis',
						code: '*',
						children: [{ type: 'text', value: 'rest' }],
					},
				],
			},
		])
	})

	test('strong nested inside emphasis: *italic **bold** italic*', () => {
		const result = parse('*italic **bold** italic*')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'emphasis',
				code: '*',
				children: [
					{ type: 'text', value: 'italic ' },
					{
						type: 'strong',
						code: '**',
						children: [{ type: 'text', value: 'bold' }],
					},
					{ type: 'text', value: ' italic' },
				],
			},
		])
	})

	test('emphasis nested inside strong: **bold *italic* bold**', () => {
		const result = parse('**bold *italic* bold**')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'strong',
				code: '**',
				children: [
					{ type: 'text', value: 'bold ' },
					{
						type: 'emphasis',
						code: '*',
						children: [{ type: 'text', value: 'italic' }],
					},
					{ type: 'text', value: ' bold' },
				],
			},
		])
	})

	test('mismatched markers are independent: *text_ does not close', () => {
		const result = parse('*hello_')
		const kids = firstParagraph(result)
		expect(kids[0]).toHaveProperty('type', 'emphasis')
		expect((kids[0] as any).code).toBe('*')
		const emphasisChildren = (kids[0] as any).children
		expect(emphasisChildren).toEqual(
			expect.arrayContaining([expect.objectContaining({ type: 'text', value: 'hello' })])
		)
	})

	test('multiple sequential emphasis nodes', () => {
		const result = parse('*a* *b* *c*')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{ type: 'emphasis', code: '*', children: [{ type: 'text', value: 'a' }] },
			{ type: 'text', value: ' ' },
			{ type: 'emphasis', code: '*', children: [{ type: 'text', value: 'b' }] },
			{ type: 'text', value: ' ' },
			{ type: 'emphasis', code: '*', children: [{ type: 'text', value: 'c' }] },
		])
	})
})

// ─── Reverse ────────────────────────────────────────────────────────────────

describe('reverse', () => {
	test('~text~ produces reverse node', () => {
		const result = parse('~hello~')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'reverse',
				code: '~',
				children: [{ type: 'text', value: 'hello' }],
			},
		])
	})

	test('reverse with surrounding text', () => {
		const result = parse('before ~middle~ after')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{ type: 'text', value: 'before ' },
			{
				type: 'reverse',
				code: '~',
				children: [{ type: 'text', value: 'middle' }],
			},
			{ type: 'text', value: ' after' },
		])
	})

	test('unclosed reverse collects text to end of paragraph', () => {
		const result = parse('~unclosed')
		const kids = firstParagraph(result)
		expect(kids[0]).toHaveProperty('type', 'reverse')
		expect((kids[0] as any).children).toEqual([{ type: 'text', value: 'unclosed' }])
	})
})

// ─── Underline & Hidden ────────────────────────────────────────────────────

describe('underline and hidden', () => {
	test('||text|| produces underline with pipe', () => {
		const result = parse('||hello||')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'underline',
				code: '||',
				children: [{ type: 'text', value: 'hello' }],
			},
		])
	})

	test('$$text$$ produces underline with dollar', () => {
		const result = parse('$$hello$$')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'underline',
				code: '$$',
				children: [{ type: 'text', value: 'hello' }],
			},
		])
	})

	test('|text| produces hidden with pipe', () => {
		const result = parse('|hello|')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'hidden',
				code: '|',
				children: [{ type: 'text', value: 'hello' }],
			},
		])
	})

	test('$text$ produces hidden with dollar', () => {
		const result = parse('$hello$')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'hidden',
				code: '$',
				children: [{ type: 'text', value: 'hello' }],
			},
		])
	})

	test('underline with surrounding text', () => {
		const result = parse('before ||middle|| after')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{ type: 'text', value: 'before ' },
			{
				type: 'underline',
				code: '||',
				children: [{ type: 'text', value: 'middle' }],
			},
			{ type: 'text', value: ' after' },
		])
	})

	test('hidden with surrounding text', () => {
		const result = parse('before |middle| after')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{ type: 'text', value: 'before ' },
			{
				type: 'hidden',
				code: '|',
				children: [{ type: 'text', value: 'middle' }],
			},
			{ type: 'text', value: ' after' },
		])
	})

	test('unclosed hidden collects text to end', () => {
		const result = parse('|unclosed')
		const kids = firstParagraph(result)
		expect(kids[0]).toHaveProperty('type', 'hidden')
		expect((kids[0] as any).children).toEqual([{ type: 'text', value: 'unclosed' }])
	})

	test('unclosed underline collects text to end', () => {
		const result = parse('||unclosed rest')
		const kids = firstParagraph(result)
		expect(kids[0]).toHaveProperty('type', 'underline')
		expect((kids[0] as any).children).toEqual([{ type: 'text', value: 'unclosed rest' }])
	})
})

// ─── Colour ─────────────────────────────────────────────────────────────────

describe('colour', () => {
	test('[colour=#ff0000]text[/colour] produces colour node', () => {
		const result = parse('[colour=#ff0000]red text[/colour]')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'colour',
				code: '[',
				colour: '#ff0000',
				children: [{ type: 'text', value: 'red text' }],
			},
		])
	})

	test('colour with yellow hex', () => {
		const result = parse('[colour=#ffff00]yellow[/colour]')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'colour',
				code: '[',
				colour: '#ffff00',
				children: [{ type: 'text', value: 'yellow' }],
			},
		])
	})

	test('colour with surrounding text', () => {
		const result = parse('before [colour=#00ff00]green[/colour] after')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{ type: 'text', value: 'before ' },
			{
				type: 'colour',
				code: '[',
				colour: '#00ff00',
				children: [{ type: 'text', value: 'green' }],
			},
			{ type: 'text', value: ' after' },
		])
	})

	test('unmatched [ is treated as literal text', () => {
		const result = parse('hello [world')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: 'hello [world' }])
	})

	test('incomplete colour tag is treated as literal text', () => {
		const result = parse('[colour=oops]')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: '[colour=oops]' }])
	})

	test('[/colour] without opening is not consumed as a closer', () => {
		const result = parse('[/colour] text')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: '[/colour] text' }])
	})
})

// ─── Screen Marker ──────────────────────────────────────────────────────────

describe('screenMarker', () => {
	test('(X) produces a screenMarker node', () => {
		const result = parse('before (X) after')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{ type: 'text', value: 'before ' },
			{ type: 'screenMarker' },
			{ type: 'text', value: ' after' },
		])
	})

	test('(X) at start of text', () => {
		const result = parse('(X)hello')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'screenMarker' }, { type: 'text', value: 'hello' }])
	})

	test('(X) at end of text', () => {
		const result = parse('hello(X)')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: 'hello' }, { type: 'screenMarker' }])
	})

	test('( not followed by X) is literal text', () => {
		const result = parse('(hello)')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: '(hello)' }])
	})

	test('(x) lowercase is literal text', () => {
		const result = parse('(x)')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'text', value: '(x)' }])
	})

	test('multiple screen markers', () => {
		const result = parse('(X) middle (X)')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'screenMarker' }, { type: 'text', value: ' middle ' }, { type: 'screenMarker' }])
	})
})

// ─── Nesting & combinations ────────────────────────────────────────────────

describe('nesting and combinations', () => {
	test('emphasis inside reverse', () => {
		const result = parse('~reverse *emphasis* reverse~')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'reverse',
				code: '~',
				children: [
					{ type: 'text', value: 'reverse ' },
					{
						type: 'emphasis',
						code: '*',
						children: [{ type: 'text', value: 'emphasis' }],
					},
					{ type: 'text', value: ' reverse' },
				],
			},
		])
	})

	test('hidden inside emphasis', () => {
		const result = parse('*visible |hidden| visible*')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'emphasis',
				code: '*',
				children: [
					{ type: 'text', value: 'visible ' },
					{
						type: 'hidden',
						code: '|',
						children: [{ type: 'text', value: 'hidden' }],
					},
					{ type: 'text', value: ' visible' },
				],
			},
		])
	})

	test('colour inside emphasis', () => {
		const result = parse('*text [colour=#ff0000]red[/colour] text*')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'emphasis',
				code: '*',
				children: [
					{ type: 'text', value: 'text ' },
					{
						type: 'colour',
						code: '[',
						colour: '#ff0000',
						children: [{ type: 'text', value: 'red' }],
					},
					{ type: 'text', value: ' text' },
				],
			},
		])
	})

	test('screen marker inside emphasis', () => {
		const result = parse('*before (X) after*')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'emphasis',
				code: '*',
				children: [
					{ type: 'text', value: 'before ' },
					{ type: 'screenMarker' },
					{ type: 'text', value: ' after' },
				],
			},
		])
	})

	test('formatting across paragraphs does not leak', () => {
		const result = parse('*italic*\n**bold**')
		expect(result.children).toHaveLength(2)
		expect(result.children[0]).toMatchObject({
			type: 'paragraph',
			children: [{ type: 'emphasis', code: '*', children: [{ type: 'text', value: 'italic' }] }],
		})
		expect(result.children[1]).toMatchObject({
			type: 'paragraph',
			children: [{ type: 'strong', code: '**', children: [{ type: 'text', value: 'bold' }] }],
		})
	})

	test('escaped special char inside emphasis', () => {
		const result = parse('*hello \\* world*')
		const kids = firstParagraph(result)
		expect(kids).toEqual([
			{
				type: 'emphasis',
				code: '*',
				children: [{ type: 'text', value: 'hello * world' }],
			},
		])
	})
})

// ─── ParserStateImpl edge cases ─────────────────────────────────────────────

describe('ParserStateImpl edge cases', () => {
	test('peek returns empty string at end of text', () => {
		const result = parse('*a*')
		const kids = firstParagraph(result)
		expect(kids).toEqual([{ type: 'emphasis', code: '*', children: [{ type: 'text', value: 'a' }] }])
	})

	test('parser can be reused for multiple inputs', () => {
		const r1 = parse('first')
		const r2 = parse('second')
		expect(r1.children[0]).toMatchObject({
			type: 'paragraph',
			children: [{ type: 'text', value: 'first' }],
		})
		expect(r2.children[0]).toMatchObject({
			type: 'paragraph',
			children: [{ type: 'text', value: 'second' }],
		})
	})
})
