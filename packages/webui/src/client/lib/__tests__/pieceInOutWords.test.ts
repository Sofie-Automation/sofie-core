import { getPieceInOutWords } from '../pieceInOutWords.js'

describe('getPieceInOutWords', () => {
	test('uses content firstWords and lastWords when present', () => {
		expect(
			getPieceInOutWords({
				name: 'legacy begin||legacy end',
				content: {
					firstWords: 'Hello',
					lastWords: 'world',
				},
			})
		).toEqual({
			begin: 'Hello',
			end: 'world',
		})
	})

	test('falls back to piece name when content has no in/out words', () => {
		expect(
			getPieceInOutWords({
				name: 'First words…||…last words',
				content: {
					fileName: 'clip.mxf',
					path: '/media/clip.mxf',
				},
			})
		).toEqual({
			begin: 'First words…',
			end: '…last words',
		})
	})

	test('falls back to piece name when content is missing', () => {
		expect(
			getPieceInOutWords({
				name: 'Only begin',
			})
		).toEqual({
			begin: 'Only begin',
			end: '',
		})
	})

	test('uses empty strings from content when keys are present', () => {
		expect(
			getPieceInOutWords({
				name: 'ignored||ignored',
				content: {
					firstWords: '',
					lastWords: '',
				},
			})
		).toEqual({
			begin: '',
			end: '',
		})
	})

	test('handles partial content fields', () => {
		expect(
			getPieceInOutWords({
				name: 'clip.mxf',
				content: {
					lastWords: '…goodbye',
				},
			})
		).toEqual({
			begin: '',
			end: '…goodbye',
		})
	})
})
