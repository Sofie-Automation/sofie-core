import process from 'process'
import _ from 'underscore'
import fs from 'fs'
import path from 'path'
import { logger } from './logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { Meteor } from 'meteor/meteor'

/** Returns absolute path to programs/server directory of your compiled application, without trailing slash. */
export function getAbsolutePath(): string {
	const rootPath = path.resolve('.')
	return rootPath.split(`${path.sep}.meteor`)[0]
}
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function extractFunctionSignature(f: Function): string[] | undefined {
	if (f) {
		const str = f.toString() || ''

		const m = str.match(/\(([^)]*)\)/)
		if (m) {
			const params = m[1].split(',')
			return _.map(params, (p) => {
				return p.trim()
			})
		}
	}
}

export type Translations = Record<string, string>

// The /public directory in a Meteor app
export const public_dir = Meteor.isProduction
	? path.join(process.cwd(), '../web.browser/app')
	: // In development, find the webui package and use its public directory
		path.join(process.cwd(), '../../../../../../packages/webui/public')

export function getRootSubpath(): string {
	// @ts-expect-error Untyped meteor export
	const settings: any = __meteor_runtime_config__

	return settings.ROOT_URL_PATH_PREFIX || ''
}

/**
 * Get the i18next locale object for a given `languageCode`. If the translations file can not be found or it can't be
 * parsed, it will return an empty object.
 *
 *
 * @export
 * @param {string} languageCode
 * @return {*}  {Promise<Translations>}
 */
export async function getLocale(languageCode: string): Promise<Translations> {
	// Try the full language code
	const file = await getLocaleFile(languageCode)
	if (file) return file

	// Try just the part before the `-`
	const index = languageCode.indexOf('-')
	if (index > 0) {
		const languageShort = languageCode.slice(0, index)
		const file = await getLocaleFile(languageShort.toLowerCase())
		if (file) return file
	}

	logger.warn(`getLocale: Failed to find suitable locale file for "${languageCode}"`)
	return {}
}

async function getLocaleFile(languageCode: string): Promise<Translations | null> {
	const localePath = path.join(public_dir, 'locales', languageCode, 'translations.json')
	if (!localePath.startsWith(path.join(public_dir, 'locales'))) {
		logger.error(`getLocale: Attempted to escape the directory: ${localePath}`)
		return null
	}

	try {
		const file = await fs.promises.readFile(localePath, {
			encoding: 'utf-8',
		})
		return JSON.parse(file)
	} catch (e: any) {
		if (e?.code !== 'ENOENT') {
			logger.warn(`getLocale: Error when trying to read file "${localePath}": ${stringifyError(e)}`)
		}

		return null
	}
}
