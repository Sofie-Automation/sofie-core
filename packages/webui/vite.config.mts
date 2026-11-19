import { defineConfig, defaultClientConditions } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

const basePath = process.env.DEV_SOFIE_BASE_PATH || ''

// The sofie server the dev server proxies the api and websocket to. Must match the server's own
// default, and its SOFIE_PORT override (see .env.example).
const serverPort = process.env.SOFIE_PORT || '3000'
const serverUrl = `http://127.0.0.1:${serverPort}`

// Address the vite dev server binds to. Loopback only by default, so it is not exposed to the
// network. Falls back to the sofie server's own bind address, as exposing one without the other is
// rarely useful (see .env.example).
const devServerHost = process.env.SOFIE_VITE_BIND_ADDRESS || process.env.SOFIE_BIND_ADDRESS || '127.0.0.1'
const devServerPort = parseInt(process.env.SOFIE_VITE_PORT || '') || 3005

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
	plugins: [react(), tsconfigPaths(), nodePolyfills()],

	// In production, build relative so that paths inside the scss files are correct. This makes a mess in the html, but we can fix that on the fly
	// In dev, use the specified base path
	base: command === 'build' ? '' : basePath || '/',

	optimizeDeps: {
		include: [
			// Node builtins used by the monorepo packages, which the dependency scan doesn't find up front.
			// Without these, the first load after clearing the cache triggers a reload
			'events',
			'crypto',
			'vite-plugin-node-polyfills/shims/buffer',
			'vite-plugin-node-polyfills/shims/global',
			'vite-plugin-node-polyfills/shims/process',
		],
	},
	build: {
		chunkSizeWarningLimit: 10000,
	},

	resolve: {
		mainFields: [], // the presence of this is a weird fix for react-moment
		// Resolve the monorepo packages to their typescript source
		conditions: ['sofie-source', ...defaultClientConditions],
		alias: {
			'~bootstrap': path.resolve(__dirname, '../../node_modules/bootstrap'),
		},
	},

	css: {
		preprocessorOptions: {
			scss: {
				// Silence deprecation warnings from Bootstrap and other dependencies
				// This hides warnings from dependencies but still shows warnings from our own code
				// Bootstrap 5.x not yet fully supporting Dart Sass 2.x causes many warnings
				quietDeps: true,
			},
		},
	},

	define: {
		__APP_VERSION__: JSON.stringify(process.env.npm_package_version),
	},

	server: {
		allowedHosts: true,
		host: devServerHost,
		port: devServerPort,
		proxy: {
			[basePath + '/api']: serverUrl,
			[basePath + '/site.webmanifest']: serverUrl,
			[basePath + '/meteor-runtime-config.js']: serverUrl,
			[basePath + '/images/sofie-logo.svg']: serverUrl,
			[basePath + '/websocket']: {
				target: `ws://127.0.0.1:${serverPort}`,
				ws: true,
			},
		},
	},
}))
