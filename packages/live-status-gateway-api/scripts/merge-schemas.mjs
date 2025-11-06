import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import $RefParser from '@apidevtools/json-schema-ref-parser'

const ROOT_FILE = './api/asyncapi.yaml'
const OUTPUT_FILE = './src/generated/asyncapi.yaml'

const BANNER =
	'# This file was automatically generated using @apidevtools/json-schema-ref-parser\n' +
	'# DO NOT MODIFY IT BY HAND. Instead, modify the source AsyncAPI schema files,\n' +
	'# and run "yarn merge-schemas" to regenerate this file.\n'

async function main() {
	try {
		// Use @apidevtools/json-schema-ref-parser to dereference all $refs
		const resolved = await $RefParser.dereference(ROOT_FILE, {
			dereference: {
				circular: 'ignore',
			},
		})

		fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })

		// Prepend banner to YAML output
		const yamlContent = BANNER + YAML.stringify(resolved)
		fs.writeFileSync(OUTPUT_FILE, yamlContent, 'utf-8')

		console.log(`Fully resolved AsyncAPI schema written to: ${OUTPUT_FILE}`)
	} catch (err) {
		console.error('Failed to generate resolved AsyncAPI schema:', err)
		throw err
	}
}

main()
