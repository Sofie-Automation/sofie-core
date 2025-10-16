import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

const ROOT_DIR = './api'
const RESOLVED_DIST_DIR = './dist/api/'

/**
 * Ensures that a directory exists, creating it and all necessary parent directories
 * if it does not.
 * @param {string} dir - The path to the directory to ensure.
 */
function ensureDir(dir) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

/**
 * Merges two objects, prioritizing properties from the right (overlay) object.
 * This is a shallow merge, used primarily to combine resolved content with the
 * original object's metadata (e.g., segmentId) while discarding the '$ref' key.
 *
 * @param {object} base - The base object (resolved content).
 * @param {object} overlay - The object containing the $ref and other properties.
 * @returns {object} The merged object.
 */
function shallowMerge(base, overlay) {
	const result = { ...base }
	// Iterate over the overlay's keys, skipping $ref, and merge them into the result.
	for (const key in overlay) {
		if (key !== '$ref') {
			result[key] = overlay[key]
		}
	}
	return result
}

/**
 * Recursively resolves all $ref instances within a YAML object. This function is
 * designed for full, deep resolution of component references.
 *
 * @param {(object|Array)} obj - The YAML object or array being processed.
 * @param {string} baseDir - The directory path from which relative $ref paths should be resolved.
 * @returns {(object|Array)} The object or array with all $ref dependencies resolved and inlined.
 */
function resolveRefs(obj, baseDir) {
	// Base case: Handle arrays by mapping over elements.
	if (Array.isArray(obj)) return obj.map((v) => resolveRefs(v, baseDir))

	// Base case: Handle objects.
	if (typeof obj === 'object' && obj !== null) {
		if (obj.$ref) {
			const originalObj = obj // Keep original object to merge extra props later.
			let [refPath, pointer] = originalObj.$ref.split('#')
			// Resolve the reference path relative to the current file's directory.
			const absoluteRef = path.resolve(baseDir, refPath)

			if (!fs.existsSync(absoluteRef)) {
				throw new Error(`Reference not found: ${absoluteRef}`)
			}

			// Load and parse the YAML content from the referenced file.
			let content = YAML.parse(fs.readFileSync(absoluteRef, 'utf-8'))

			// Resolve JSON Pointer if present (e.g., #/components/schemas/adLib)
			if (pointer) {
				const parts = pointer.replace(/^\//, '').split('/')
				content = parts.reduce((acc, key) => {
					if (acc[key] === undefined) throw new Error(`Invalid JSON Pointer: ${originalObj.$ref}`)
					return acc[key]
				}, content)
			}

			// Recursively resolve any further $refs within the resolved content.
			const resolvedContent = resolveRefs(content, path.dirname(absoluteRef))

			// Merge the resolved content with the original object's properties.
			if (typeof resolvedContent === 'object' && resolvedContent !== null) {
				const merged = shallowMerge(resolvedContent, originalObj)
				return resolveRefs(merged, path.dirname(absoluteRef))
			}

			// If resolved content is a primitive (string, number, etc.), just return it.
			return resolvedContent
		}

		// Continue recursion for properties that are not $ref.
		const res = {}
		for (const key in obj) {
			res[key] = resolveRefs(obj[key], baseDir)
		}
		return res
	}
	// Return primitives as-is.
	return obj
}

/**
 * Recursively traverses a YAML object but applies $ref resolution ONLY
 * to properties named 'examples' (case-insensitive). This is used for
 * AsyncAPI specs where only example data should be inlined, not schemas.
 *
 * @param {(object|Array)} obj - The YAML object or array being processed.
 * @param {string} baseDir - The directory path for resolving relative $ref paths.
 * @returns {(object|Array)} The object with only example references resolved.
 */
function resolveExamplesOnly(obj, baseDir) {
	if (Array.isArray(obj)) return obj.map((v) => resolveExamplesOnly(v, baseDir))
	if (typeof obj === 'object' && obj !== null) {
		const res = {}
		for (const key in obj) {
			if (key.toLowerCase() === 'examples') {
				// Apply full resolution only inside 'examples' blocks.
				res[key] = resolveRefs(obj[key], baseDir)
			} else {
				// Continue recursive traversal for all other properties.
				res[key] = resolveExamplesOnly(obj[key], baseDir)
			}
		}
		return res
	}
	return obj
}

/**
 * Traverses the source directory, copies files to the destination, and applies
 * the appropriate $ref resolution based on file naming conventions.
 *
 * @param {string} src - The source file or directory path.
 * @param {string} dest - The destination file or directory path.
 */
function copyAndResolve(src, dest) {
	const stats = fs.statSync(src)

	if (stats.isDirectory()) {
		// Handle directories: create destination and recurse.
		ensureDir(dest)
		const entries = fs.readdirSync(src)
		for (const entry of entries) {
			copyAndResolve(path.join(src, entry), path.join(dest, entry))
		}
	} else if (stats.isFile()) {
		const fileName = path.basename(src)

		// 1. Fully resolve files ending with '-example.yaml'.
		if (fileName.endsWith('-example.yaml')) {
			const content = YAML.parse(fs.readFileSync(src, 'utf-8'))
			// Use full, deep resolution for dedicated example files.
			const resolved = resolveRefs(content, path.dirname(src))
			fs.writeFileSync(dest, YAML.stringify(resolved), 'utf-8')
		} else {
			// 2. Resolve only under 'examples:' property for all other files.
			const contentRaw = fs.readFileSync(src, 'utf-8')
			try {
				const content = YAML.parse(contentRaw)
				if (content && typeof content === 'object') {
					// Use selective resolution for API spec files.
					const resolved = resolveExamplesOnly(content, path.dirname(src))
					fs.writeFileSync(dest, YAML.stringify(resolved), 'utf-8')
					return
				}
			} catch {
				// Not YAML or parsing failed, falls through to simple copy.
				console.error(`Parsing examples failed for: ${path.relative(ROOT_DIR, src)} falling back to simple copy.`)
			}
			// 3. Simple copy for non-YAML files or files that failed to parse.
			fs.copyFileSync(src, dest)
		}
	}
}

/**
 * Main execution function. Cleans the target directory and starts the
 * file traversal and resolution process.
 */
function main() {
	// Clean up the temporary directory before starting.
	if (fs.existsSync(RESOLVED_DIST_DIR)) fs.rmSync(RESOLVED_DIST_DIR, { recursive: true, force: true })
	ensureDir(RESOLVED_DIST_DIR)

	// Start the copy and resolution process.
	copyAndResolve(ROOT_DIR, RESOLVED_DIST_DIR)

	console.log(`Project copied with resolved examples to: ${RESOLVED_DIST_DIR}`)
}

main()
