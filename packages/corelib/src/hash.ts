import * as crypto from 'crypto'

export function getHash(str: string): string {
	const hash = crypto.createHash('sha1')
	return hash.update(str).digest('base64').replace(/[+/=]/g, '_') // remove +/= from strings, because they cause troubles
}

/** Creates a hash based on the object properties (excluding ordering of properties) */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function hashObj(obj: any): string {
	if (obj === null) return 'null'
	if (obj === undefined) return 'undefined'

	if (Array.isArray(obj)) {
		// For arrays, we care about the order, and should preserve undefined
		const strs = obj.map((val, i) => hashObj(`${i}:${hashObj(val)}`))

		return getHash(strs.join('|'))
	} else if (typeof obj === 'object') {
		const keys = Object.keys(obj).sort((a, b) => {
			if (a > b) return 1
			if (a < b) return -1
			return 0
		})

		const strs: string[] = []
		for (const key of keys) {
			const val = obj[key]
			// Skip undefined values to make {a: undefined} hash the same as {}, matching how JSON/mongo serialization will behave
			if (val !== undefined) {
				strs.push(`${key}:${hashObj(val)}`)
			}
		}
		return getHash(strs.join('|'))
	}
	return obj + ''
}
