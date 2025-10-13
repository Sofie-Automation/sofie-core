// scripts/resolveProjectExamples.js
import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

const ROOT_DIR = './api/refactor/components'
const TEMP_DIR = './api/refactor/components'

// Helper to ensure directory exists
function ensureDir(dir) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// Recursively resolve $ref in a YAML object
function resolveRefs(obj, baseDir) {
	if (Array.isArray(obj)) return obj.map((v) => resolveRefs(v, baseDir))
	if (typeof obj === 'object' && obj !== null) {
		if (obj.$ref) {
			const refPath = path.resolve(baseDir, obj.$ref)
			if (!fs.existsSync(refPath)) {
				throw new Error(`Reference not found: ${refPath}`)
			}
			const content = YAML.parse(fs.readFileSync(refPath, 'utf-8'))
			return resolveRefs(content, path.dirname(refPath))
		}

		const res = {}
		for (const key in obj) {
			// If the property is named 'examples', treat its value as example(s)
			if (key.toLowerCase() === 'examples') {
				res[key] = resolveRefs(obj[key], baseDir)
			} else {
				res[key] = resolveRefs(obj[key], baseDir)
			}
		}
		return res
	}
	return obj
}

// Copy files and resolve examples based on filename or property
function copyAndResolve(src, dest) {
	const stats = fs.statSync(src)
	if (stats.isDirectory()) {
		ensureDir(dest)
		const entries = fs.readdirSync(src)
		for (const entry of entries) {
			copyAndResolve(path.join(src, entry), path.join(dest, entry))
		}
	} else if (stats.isFile()) {
		const fileName = path.basename(src)

		// Check if the file is an example file
		if (fileName.endsWith('-example.yaml')) {
			const content = YAML.parse(fs.readFileSync(src, 'utf-8'))
			const resolved = resolveRefs(content, path.dirname(src))
			fs.writeFileSync(dest, YAML.stringify(resolved), 'utf-8')
			console.log(`Resolved example file: ${path.relative(ROOT_DIR, src)}`)
		} else {
			// For normal files, still check top-level 'examples' property
			const contentRaw = fs.readFileSync(src, 'utf-8')
			try {
				const content = YAML.parse(contentRaw)
				if (content && typeof content === 'object' && 'examples' in content) {
					const resolved = resolveRefs(content, path.dirname(src))
					fs.writeFileSync(dest, YAML.stringify(resolved), 'utf-8')
					console.log(`Resolved 'examples' property: ${path.relative(ROOT_DIR, src)}`)
					return
				}
			} catch {
				// not YAML or parsing failed, copy as-is
			}
			fs.copyFileSync(src, dest)
		}
	}
}

// Main
function main() {
	if (fs.existsSync(TEMP_DIR)) {
		fs.rmSync(TEMP_DIR, { recursive: true, force: true })
	}
	ensureDir(TEMP_DIR)

	copyAndResolve(ROOT_DIR, TEMP_DIR)

	console.log(`Project fully copied with resolved examples to: ${TEMP_DIR}`)
}

main()
