/**
 * This script will read and bundle the translations in the project's .po files.
 */
/* eslint-disable */
import { readdir, readFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { gettextToI18next } from 'i18next-conv'

import { conversionOptions } from './config.mjs'

const reverseHack = !!process.env.GENERATE_REVERSE_ENGLISH

async function processPoFile(filePath, namespace) {
	const start = Date.now()
	// filePath is like i18n/nb.po — language is the filename without extension
	const language = basename(filePath, '.po')

	const poFile = await readFile(filePath, 'utf-8')

	const converted = await gettextToI18next(language, poFile, {
		...conversionOptions,
		language,
		skipUntranslated: !reverseHack || language !== 'en',
		ns: namespace,
	})

	const data = JSON.parse(converted)

	console.info(
		`Processed ${namespace} ${language} (${Object.keys(data).length} translated keys) (${Date.now() - start} ms)`
	)

	if (reverseHack && language === 'en') {
		for (const key of Object.keys(data)) {
			data[key] = key.split('').reverse().join('')
		}
	}

	return { language, data }
}

export async function getTranslations(i18nDir, namespace) {
	console.info('Bundling translations...')

	let entries
	try {
		entries = await readdir(i18nDir)
	} catch {
		throw new Error(`Failed to read directory: ${i18nDir}`)
	}

	const poFiles = entries.filter((f) => f.endsWith('.po')).map((f) => join(i18nDir, f))

	const translations = await Promise.all(poFiles.map((f) => processPoFile(f, namespace)))

	console.info('Translations bundling complete.')

	return translations
}
