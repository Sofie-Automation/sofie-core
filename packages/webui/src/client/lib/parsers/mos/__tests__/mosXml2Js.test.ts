import { parseMosPluginMessageXml, generateMosPluginItemXml } from '../mosXml2Js.js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { MOS_DATA_IS_STRICT, MOS } from '@sofie-automation/meteor-lib/dist/mos'

describe('MOS XML to JavaScript object parser', () => {
	describe('mosXml2Js', () => {
		describe('Sample1', () => {
			const sample1XmlStr = readFileSync(join(__dirname, './mosSample1.xml'), 'utf-8')
			const sample1JsonStr = readFileSync(join(__dirname, './mosSample1.json'), 'utf-8')

			const jsonDoc = JSON.parse(sample1JsonStr)

			it('should match the json representation', () => {
				const actual = parseMosPluginMessageXml(sample1XmlStr)
				const actualJson = actual && actual.item && MOS.stringifyMosObject(actual.item, MOS_DATA_IS_STRICT) // Strip out any MosString etc

				expect(actualJson).toEqual(jsonDoc)
			})

			it('converting via xml should be lossless', () => {
				const generatedXml = generateMosPluginItemXml(jsonDoc)
				const actual = parseMosPluginMessageXml(generatedXml)
				const actualJson =
					actual && actual.item && actual.item && MOS.stringifyMosObject(actual.item, MOS_DATA_IS_STRICT) // Strip out any MosString etc

				expect(actualJson).toEqual(jsonDoc)
			})
		})

		describe('Sample2', () => {
			const sampleXmlStr = readFileSync(join(__dirname, './mosSample2.xml'), 'utf-8')
			const sampleJsonStr = readFileSync(join(__dirname, './mosSample2.json'), 'utf-8')

			const jsonDoc = JSON.parse(sampleJsonStr)

			it('should match the json representation', () => {
				const actual = parseMosPluginMessageXml(sampleXmlStr)
				const actualJson = actual && actual.item && MOS.stringifyMosObject(actual.item, MOS_DATA_IS_STRICT) // Strip out any MosString etc

				expect(actualJson).toEqual(jsonDoc)
			})

			it('converting via xml should be lossless', () => {
				const generatedXml = generateMosPluginItemXml(jsonDoc)
				const actual = parseMosPluginMessageXml(generatedXml)
				const actualJson = actual && actual.item && MOS.stringifyMosObject(actual.item, MOS_DATA_IS_STRICT) // Strip out any MosString etc

				expect(actualJson).toEqual(jsonDoc)
			})
		})
	})
})
