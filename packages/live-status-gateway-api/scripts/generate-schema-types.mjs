import { TypeScriptGenerator } from '@asyncapi/modelina'
import { fromFile, Parser } from '@asyncapi/parser'
import fs from 'fs/promises'
import cp from 'child_process'
import * as path from 'path'

const BANNER =
	'/* eslint-disable */\n/**\n * This file was automatically generated using and @asyncapi/parser @asyncapi/modelina.\n * DO NOT MODIFY IT BY HAND. Instead, modify the source AsyncAPI schema files,\n * and run "yarn generate-schema-types" to regenerate this file.\n */\n'

const renderDescription = ({ renderer, content, item }) => {
	const desc = item.originalInput.description?.trim()

	if (desc) {
		const doc = renderer.renderComments(`${desc || ''}`.trim())
		return `${doc}\n${content}`
	}
	return content
}
/**
 * Preset which adds descriptions
 * Modified from the original, to omit examples
 *
 * @type {import('@asyncapi/modelina').TypeScriptPreset}
 */
const CUSTOM_TS_DESCRIPTION_PRESET = {
	class: {
		self({ renderer, model, content }) {
			return renderDescription({ renderer, content, item: model })
		},
		getter({ renderer, property, content }) {
			return renderDescription({ renderer, content, item: property.property })
		},
	},
	interface: {
		self({ renderer, model, content }) {
			return renderDescription({ renderer, content, item: model })
		},
		property({ renderer, property, content }) {
			return renderDescription({ renderer, content, item: property.property })
		},
	},
	type: {
		self({ renderer, model, content }) {
			return renderDescription({ renderer, content, item: model })
		},
	},
	enum: {
		self({ renderer, model, content }) {
			return renderDescription({ renderer, content, item: model })
		},
	},
}

const generator = new TypeScriptGenerator({
	modelType: 'interface',
	enumType: 'enum',
	mapType: 'record',
	moduleSystem: 'ESM',
	presets: [CUSTOM_TS_DESCRIPTION_PRESET],
	rawPropertyNames: true,
})

const parser = new Parser()
const asyncApiDoc = await fromFile(parser, 'api/asyncapi.yaml').parse()
if (!asyncApiDoc.document) {
	console.error('No document was produced from the asyncapi parser')
	console.error(JSON.stringify(asyncApiDoc.diagnostics))

	// eslint-disable-next-line n/no-process-exit
	process.exit(5)
}

const models = await generator.generate(asyncApiDoc.document)
const allModelNames = []
const allmodelContent = []
for (const model of models) {
	allModelNames.push(model.modelName)
	allmodelContent.push(model.result)

	if (model.modelName.includes('Anonymous'))
		throw new Error(`Anonymous model found: ${model.modelName}\n\n${JSON.stringify(model.result, null, 2)}`)
}

const allModelsString =
	BANNER + '\n\n' + allmodelContent.join('\n\n') + '\n\n' + 'export {' + allModelNames.join(', ') + '};'

const fileName = path.resolve('src/generated/schema.ts')
await fs.writeFile(fileName, allModelsString)

// Prettier format the output file:
await runCmd(`npx prettier --write "${fileName}"`, {
	// Run from repo root, so that prettier picks up the config
	cwd: path.resolve('../..'),
})

console.log(`Schema types written to ${fileName}`)

async function runCmd(cmd, options) {
	await new Promise((resolve, reject) => {
		const child = cp.exec(cmd, options || {}, (err, stdout, stderr) => {
			if (err) {
				console.error('stderr', stderr)
				reject(err)
			} else {
				resolve(stdout)
			}
		})

		child.stdout.pipe(process.stdout)
		child.stderr.pipe(process.stderr)
	})
}
