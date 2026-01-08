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

const basePath = process.env.SOFIE_BASE_PATH || ''

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
	plugins: [react(), tsconfigPaths(), nodePolyfills()],

	// In production, build relative so that paths inside the scss files are correct. This makes a mess in the html, but we can fix that on the fly
	// In dev, use the specified base path
	base: command === 'build' ? '' : basePath || '/',

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
		alias: {
			'~bootstrap': path.resolve(__dirname, '../node_modules/bootstrap'),
		},
	},

	css: {
		preprocessorOptions: {
			scss: {
				// Silence deprecation warnings from Bootstrap and other libraries
				// These are caused by Bootstrap 5.x not yet fully supporting Dart Sass 2.x
				silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'mixed-decls'],
			},
		},
	},

	define: {
		__APP_VERSION__: JSON.stringify(process.env.npm_package_version),
	},

	server: {
		allowedHosts: true,
		proxy: {
			[basePath + '/api']: 'http://127.0.0.1:3000',
			[basePath + '/site.webmanifest']: 'http://127.0.0.1:3000',
			[basePath + '/meteor-runtime-config.js']: 'http://127.0.0.1:3000',
			[basePath + '/images/sofie-logo.svg']: 'http://127.0.0.1:3000',
			[basePath + '/websocket']: {
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
}))
