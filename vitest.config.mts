import path from 'node:path'
import { defineConfig, type TestProjectInlineConfiguration } from 'vitest/config'

const packagesDir = path.join(import.meta.dirname, 'packages')

/** Integration tests need external services (eg a running Core), so are only included when explicitly requested */
const includeIntegrationTests = !!process.env.SOFIE_INTEGRATION_TESTS
/** The openapi tests need a server to test against, so are only included when run via `openapi/run_server_tests.mjs` (or `unit:no-server`) */
const includeOpenApiTests = !!process.env.SOFIE_OPENAPI_TESTS

/** Point imports of server-core-integration at its sources, so tests don't need it to be built first */
const serverCoreIntegrationSrcAlias = {
	find: /^@sofie-automation\/server-core-integration$/,
	replacement: path.join(packagesDir, 'server-core-integration/src/index.ts'),
}

/** Point imports of shared-lib's built output at its sources, so tests don't need it to be built first */
const sharedLibSrcAlias = {
	find: /^@sofie-automation\/shared-lib\/dist\/(.+?)(\.js)?$/,
	replacement: path.join(packagesDir, 'shared-lib/src/$1'),
}

interface ProjectOptions {
	/** Directory of the package, if different to the name of the project */
	dir?: string
	/** Glob patterns (relative to the package) of the test files. Defaults to both `spec` and `test` files in `__tests__` */
	include?: string[]
	alias?: { find: string | RegExp; replacement: string }[]
	test?: TestProjectInlineConfiguration['test']
}

function packageProject(name: string, options: ProjectOptions = {}): TestProjectInlineConfiguration {
	return {
		extends: false,
		resolve: {
			alias: [sharedLibSrcAlias, ...(options.alias ?? [])],
		},
		test: {
			name,
			root: path.join(packagesDir, options.dir ?? name),
			include: options.include ?? ['src/**/__tests__/**/*.{spec,test}.{ts,js}'],
			exclude: ['**/node_modules/**', '**/dist/**', '**/integrationTests/**'],
			environment: 'node',
			...options.test,
		},
	}
}

export default defineConfig({
	test: {
		root: packagesDir,
		projects: [
			packageProject('blueprints-integration', {
				include: ['src/**/__tests__/**/*.spec.{ts,js}'],
			}),
			packageProject('shared-lib'),
			packageProject('meteor-lib'),
			packageProject('mos-gateway', {
				alias: [serverCoreIntegrationSrcAlias],
			}),
			packageProject('playout-gateway', {
				include: ['src/**/__tests__/**/*.spec.{ts,js}'],
			}),
			packageProject('live-status-gateway-api'),
			packageProject('corelib'),
			packageProject('server-core-integration', {
				include: ['src/**/__tests__/**/*.spec.{ts,js}'],
			}),
			packageProject('live-status-gateway', {
				alias: [serverCoreIntegrationSrcAlias],
			}),

			...(includeOpenApiTests
				? [
						packageProject('openapi', {
							include: ['src/**/__tests__/**/*.spec.{ts,js}'],
							test: { globalSetup: './vitest.global-setup.mjs' },
						}),
					]
				: []),

			...(includeIntegrationTests
				? [
						packageProject('mos-gateway-integration', {
							dir: 'mos-gateway',
							include: ['src/integrationTests/**/*.spec.{ts,js}'],
							test: { exclude: ['**/node_modules/**', '**/dist/**'] },
						}),
						packageProject('server-core-integration-integration', {
							dir: 'server-core-integration',
							include: ['src/integrationTests/**/*.spec.{ts,js}'],
							test: { exclude: ['**/node_modules/**', '**/dist/**'] },
						}),
					]
				: []),
		],
		coverage: {
			// Match jest's previous collectCoverage: true. Disable with --coverage=false
			enabled: true,
			provider: 'v8',
			reportsDirectory: './coverage',
			reporter: ['text', 'lcov'],
			exclude: [
				'**/__tests__/**',
				'**/__mocks__/**',
				'**/node_modules/**',
				'**/dist/**',
				// These are relative to the project root when using `--project`, so match both forms
				'{openapi/,}client/ts/index.ts',
				'{openapi/,}client/ts/runtime.ts',
				'{openapi/,}client/ts/models/**',
				'{openapi/,}src/httpLogging*',
				'{openapi/,}src/checkServer*',
			],
			thresholds: {
				'blueprints-integration/src/**': {
					branches: 80,
					functions: 100,
					lines: 95,
					statements: 90,
				},
				'openapi/**': {
					branches: 60,
					functions: 60,
					lines: 60,
					statements: 60,
				},
				'playout-gateway/src/**': {
					branches: 100,
					functions: 100,
					lines: 100,
					statements: 100,
				},
			},
		},
	},
})
