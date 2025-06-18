import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'
import fs from 'fs/promises'

const commonJsPaths: string[] = []

async function findCommonJsPathsForLibrary(prefix: string, rootPath: string) {
	const filenames = await fs.readdir(rootPath)
	for (const name of filenames) {
		const stat = await fs.stat(path.join(rootPath, name))
		if (stat.isDirectory()) {
			await findCommonJsPathsForLibrary(path.join(prefix, name), path.join(rootPath, name))
		} else if (name.endsWith('.js')) {
			commonJsPaths.push(path.join(prefix, name.slice(0, -3)))
		}
	}
}

// Hack: vite doesn't like commonjs dependencies unless the import paths are named explicitly
await Promise.all([
	findCommonJsPathsForLibrary('@sofie-automation/corelib/dist', '../corelib/dist'),
	findCommonJsPathsForLibrary('@sofie-automation/shared-lib/dist', '../shared-lib/dist'),
	findCommonJsPathsForLibrary('@sofie-automation/meteor-lib/dist', '../meteor-lib/dist'),
])

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react(), tsconfigPaths(), nodePolyfills()],

	optimizeDeps: {
		include: [
			// Add all sofie paths, ensuring they use unix path syntax
			...commonJsPaths.map((p) => p.replaceAll('\\', '/')),

			// Commonjs monorepo dependencies
			'@sofie-automation/blueprints-integration',
		],
	},
	build: {
		commonjsOptions: {
			include: [/shared-lib/, /meteor-lib/, /corelib/, /blueprints-integration/, /node_modules/],
		},
		chunkSizeWarningLimit: 10000,
	},

	resolve: {
		mainFields: [], // the presence of this is a weird fix for react-moment
	},

	define: {
		__APP_VERSION__: JSON.stringify(process.env.npm_package_version),
	},

	server: {
		proxy: {
			'/api': 'http://127.0.0.1:3000',
			'/site.webmanifest': 'http://127.0.0.1:3000',
			'/meteor-runtime-config.js': 'http://127.0.0.1:3000',
			'/images/sofie-logo.svg': 'http://127.0.0.1:3000',
			'/websocket': {
				target: `ws://127.0.0.1:3000`,
				ws: true,
			},
		},
	},

	// TODO: old meteor recompile instructions?
	// "nodeModules": {
	// 	"recompile": {
	// 		"@mos-connection/helper": "legacy",
	// 		"@mos-connection/model": "legacy",
	// 		"@sofie-automation/corelib": "legacy",
	// 		"@sofie-automation/shared-lib": "legacy"
	// 	}
	// }
})
