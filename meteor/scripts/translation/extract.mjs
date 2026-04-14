// @ts-check
/**
 * This script will extract keys from the source code (provided they are wrapped
 * in a call to the (mock) i18next translation function t()).
 * The extracted keys are written to .po files, one for each specified locale.
 *
 * Translations in already existing .po files will be preserved.
 */

import { writeFile, readFile } from 'node:fs/promises'
import { runExtractor } from 'i18next-cli'
import { i18nextToPo, gettextToI18next } from 'i18next-conv'

import { conversionOptions } from './config.mjs'

export async function extractTranslations() {
	const start = Date.now()
	console.info(`\nExtracting keys...`)
	// const entryPointRoot = parse(sourcePath).dir
	const locales = ['en', 'nb', 'nn', 'sv']
	const outputPattern = `i18n/{{language}}.json`

	const extractionStats = { keysExtracted: 0, locales: [] }

	await runExtractor({
		locales,
		extract: {
			input: [
				// `${entryPointRoot}/**/*.ts`,
				'./lib/**/*.+(ts|tsx)',
				'./server/**/*.+(ts|tsx)',
				'../packages/job-worker/src/**/*.+(ts|tsx)',
				'../packages/corelib/src/**/*.+(ts|tsx)',
				'../packages/webui/src/**/*.+(ts|tsx)',
			],
			output: outputPattern,
			sort: true,
			nsSeparator: false,
			keySeparator: false,
			defaultValue: '',
			removeUnusedKeys: true,
			mergeNamespaces: true,
			functions: ['t', 'generateTranslation', 'i18n.t'],
		},
		plugins: [jsonToPoPlugin('translation', extractionStats)],
	})

	const taskDuration = Date.now() - start
	const { keysExtracted } = extractionStats
	if (keysExtracted) {
		console.info(`=> OK, ${keysExtracted} keys extracted in ${taskDuration} ms`)
		for (const { language, keysMerged, keysRemoved } of extractionStats.locales) {
			console.info(
				`\t${language}: added ${keysExtracted - keysMerged} new keys, merged ${keysMerged} existing translations, removed ${keysRemoved} obsolete keys`
			)
		}
	} else {
		console.info(`=> No keys found in ${taskDuration}ms`)
	}
}

function jsonToPoPlugin(_translationNamespace, extractionStats) {
	return {
		name: 'json-to-po',
		async afterSync(results) {
			await Promise.all(
				results.map(async (result) => {
					const language = result.path.split(/[/\\]/).at(-2)
					const poPath = result.path.replace(/\.json$/, '.po')

					// Load existing translations from the .po file if it exists
					let existingTranslations = {}
					try {
						const existingPo = await readFile(poPath, 'utf-8')
						const fixedPo = existingPo.replaceAll('#~|', '#~') // Remove empty header to avoid parse issues
						const converted = await gettextToI18next(language, fixedPo, {
							...conversionOptions,
							language,
							skipUntranslated: true,
						})
						existingTranslations = JSON.parse(converted)
					} catch {
						// No existing .po file or parse error - start fresh
						console.log(`No existing/valid .po file found for ${language}, starting with empty translations.`)
					}

					// Merge: use existing translations for known keys, empty string for new keys
					const newTranslations = result.newTranslations
					const newKeys = Object.keys(newTranslations)
					const merged = {}
					let keysMerged = 0
					for (const key of newKeys) {
						const existing = existingTranslations[key]
						if (existing) {
							merged[key] = existing
							keysMerged++
						} else {
							merged[key] = ''
						}
					}
					const keysRemoved = Object.keys(existingTranslations).length - keysMerged

					extractionStats.keysExtracted = newKeys.length
					extractionStats.locales.push({ language, keysMerged, keysRemoved })

					const poContent = await i18nextToPo(language, JSON.stringify(merged), {
						...conversionOptions,
						language,
						skipUntranslated: false,
					})
					await writeFile(poPath, poContent)
				})
			)
		},
	}
}
