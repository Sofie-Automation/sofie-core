import { createMosAppInfoXmlString } from '../plugin-support.js'
import { parseStringPromise } from 'xml2js'

describe('createMosAppInfoXmlString', () => {
	const xmlString = createMosAppInfoXmlString()

	it('should return a string that is a valid XML document', async () => {
		expect(typeof xmlString).toEqual('string')
		await parseStringPromise(xmlString) // will throw if invalid
	})

	describe('XML document', () => {
		let doc: any
		beforeAll(async () => {
			doc = await parseStringPromise(xmlString)
		})

		it('the root node should be named mos', () => {
			const nodeNames = Object.keys(doc)

			expect(nodeNames.length).toEqual(1)
			expect(nodeNames[0]).toEqual('mos')
		})

		describe('mos node contents', () => {
			let mos: any
			beforeAll(async () => {
				mos = doc.mos
			})

			//TODO: this should either be the official Sofie name or possibly the instance name?
			it('node ncsID should be sofie-core', () => {
				const expected = ['sofie-core']

				const actual = doc.mos.ncsID

				expect(actual).toEqual(expected)
			})

			//TODO: this is completely bogus. The Nora plugin doesn't actually check the values
			describe('node ncsAppInfo', () => {
				let ncsAppInfo: any
				beforeAll(async () => {
					ncsAppInfo = mos.ncsAppInfo
					// eslint-disable-next-line jest/no-standalone-expect
					expect(ncsAppInfo).toHaveLength(1)
					ncsAppInfo = ncsAppInfo[0]
				})
				describe('node ncsInformation', () => {
					let ncsInformation: any
					beforeAll(async () => {
						ncsInformation = ncsAppInfo.ncsInformation
						// eslint-disable-next-line jest/no-standalone-expect
						expect(ncsInformation).toHaveLength(1)
						ncsInformation = ncsInformation[0]
					})

					it('node userID should contain something', () => {
						const actual = ncsInformation.userID

						expect(actual).toEqual(expect.anything())
					})

					it('node software should contain something', () => {
						const actual = ncsInformation.software

						expect(actual).toEqual(expect.anything())
					})
				})
			})
		})
	})
})
