import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import { fromFile, Parser } from '@asyncapi/parser'

const ROOT_FILE = './temp/api/asyncapi.yaml'
const OUTPUT_FILE = './src/generated/asyncapi.yaml'

async function main() {
	try {
		const parser = new Parser()
		const { document } = await fromFile(parser, ROOT_FILE).parse()

		if (!document) {
			throw new Error('Failed to parse the AsyncAPI document.')
		}

		// Convert the resolved document to JS object
		const resolved = document.json()

		// Ensure output directory exists
		fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })

		// Write out single YAML file
		fs.writeFileSync(OUTPUT_FILE, YAML.stringify(resolved), 'utf-8')

		console.log(`Fully resolved AsyncAPI schema written to: ${OUTPUT_FILE}`)
	} catch (err) {
		console.error('Failed to generate resolved AsyncAPI schema:', err)
		throw err
	}
}

main()
