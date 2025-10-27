import * as fs from 'fs'
import * as path from 'path'

export * from './time.js'

const pkgInfoBuffer = fs.readFileSync(path.join(__dirname, '../../package.json'))
const pkgInfo = JSON.parse(pkgInfoBuffer.toString())

export function getSystemVersion(): string {
	// Note: This would be useful to have some git hashes in it
	return pkgInfo.version || '0.0.0'
}
