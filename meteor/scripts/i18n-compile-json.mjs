import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getTranslations } from './translation/bundle.mjs'

/*************************************************

This script goes through all of the languages (.po files)
and compiles the json-files (used in production).

**************************************************/

const translations = await getTranslations('i18n', 'translations')

const errors = []
for (const { language, data } of translations) {
	try {
		const outDir = join('..', 'packages', 'webui', 'public', 'locales', language)
		await mkdir(outDir, { recursive: true })
		const outPath = join(outDir, 'translations.json')
		await writeFile(outPath, JSON.stringify(data, null, '\t') + '\n', 'utf-8')
		console.log(`✅ Written ${outPath}`)
	} catch (e) {
		console.error(`💣 Failed: ${language}: ${e}`)
		errors.push(`${language}: ${e}`)
	}
}

if (errors.length) {
	for (const error of errors) {
		console.error(error)
	}
	console.log(`\n\n😓 Failed to compile: ${errors.map((e) => e.split(':')[0]).join(', ')}`)
	process.exit(1)
}

console.log(`\n\n🥳 Succesfully compiled all translations: ${translations.map((t) => t.language).join(', ')}`)
