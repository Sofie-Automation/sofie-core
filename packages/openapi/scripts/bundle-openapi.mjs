import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import $RefParser from '@apidevtools/json-schema-ref-parser'

const ROOT_FILE = './api/actions.yaml'
const OUTPUT_FILE = './src/generated/openapi.yaml'

const BANNER =
	'# This file was automatically generated using @apidevtools/json-schema-ref-parser\n' +
	'# DO NOT MODIFY IT BY HAND. Instead, modify the source OpenAPI schema files,\n' +
	'# and run "yarn bundle" (in packages/openapi) to regenerate this file.\n'

async function main() {
	// Dereference all $refs so tools like Postman/Insomnia can import a single file.
	const resolved = await $RefParser.dereference(ROOT_FILE, {
		dereference: {
			// Some schemas are self-referential; most importers handle this fine,
			// but the dereferencer can choke if we don't ignore cycles.
			circular: 'ignore',
		},
	})

	fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })

	const yamlContent = BANNER + yaml.dump(resolved, { noRefs: true, lineWidth: 120 })
	fs.writeFileSync(OUTPUT_FILE, yamlContent, 'utf-8')

	console.log(`Fully resolved OpenAPI schema written to: ${OUTPUT_FILE}`)
}

main().catch((err) => {
	console.error('Failed to generate resolved OpenAPI schema:', err)
	process.exitCode = 1
})
