import process from 'process'
import fs from 'fs'
import path from 'path'
import { logger } from './logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

/**
 * Whether we are running in unit tests.
 */
export function isInTestMode(): boolean {
	return !!process.env.JEST_WORKER_ID
}

/**
 * Whether we are running a production build.
 * Note: An unset `NODE_ENV` counts as development.
 */
export function isInProductionMode(): boolean {
	return process.env.NODE_ENV === 'production' && !isInTestMode()
}

export function isInDevelopmentMode(): boolean {
	return !isInProductionMode() && !isInTestMode()
}

/** A description of the mode we are running in, and what it was derived from, for the startup logging. */
export function describeRunMode(): string {
	const mode = isInTestMode() ? 'test' : isInProductionMode() ? 'production' : 'development'
	return `${mode} mode (NODE_ENV=${process.env.NODE_ENV ? `"${process.env.NODE_ENV}"` : '<unset>'})`
}

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
			return params.map((p) => p.trim())
		}
	}
	return undefined
}

export type Translations = Record<string, string>

/**
 * The directory containing the built webui, which is served as static files.
 * The deployment images set `SOFIE_WEBUI_DIR`. When unset the webui is not served at all, which is the
 * case for certain development setups.
 */
export const public_dir: string | undefined = process.env.SOFIE_WEBUI_DIR

/**
 * The path prefix the app is served under, derived from `ROOT_URL`. Empty when served from the root,
 * otherwise a leading-slash path with no trailing slash (eg `ROOT_URL=http://host:3000/sofie` -> `/sofie`).
 */
export function getRootSubpath(): string {
	const rootUrl = process.env.ROOT_URL
	if (!rootUrl) return ''

	let pathname: string
	try {
		pathname = new URL(rootUrl).pathname
	} catch {
		logger.warn(`Ignoring ROOT_URL, it is not a valid url: "${rootUrl}"`)
		return ''
	}

	// A url without a subpath has a pathname of '/', which is not a prefix worth prepending
	const trimmed = pathname.replace(/\/+$/, '')
	return trimmed === '' ? '' : trimmed
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
	// The locales are shipped as part of the webui, so there is nothing to read when it is not served
	if (!public_dir) return null

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
