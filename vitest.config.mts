import path from 'node:path'
import { defineConfig, type TestProjectInlineConfiguration } from 'vitest/config'

const packagesDir = path.join(import.meta.dirname, 'packages')

/** Integration tests need external services (eg a running Core), so are only included when explicitly requested */
const includeIntegrationTests = !!process.env.SOFIE_INTEGRATION_TESTS
/** The openapi tests need a server to test against, so are only included when run via `openapi/run_server_tests.mjs` (or `unit:no-server`) */
const includeOpenApiTests = !!process.env.SOFIE_OPENAPI_TESTS
/**
 * Comma separated list of the projects to run (eg `server-core-integration,shared-lib`), for when only some packages
 * need testing, such as the published libraries on newer node versions in CI. Runs every project when unset.
 */
const onlyProjects = (process.env.SOFIE_TEST_PROJECTS ?? '')
	.split(',')
	.map((name) => name.trim())
	.filter(Boolean)

/** Point imports of server-core-integration at its sources, so tests don't need it to be built first */
const serverCoreIntegrationSrcAlias = {
	find: /^@sofie-automation\/server-core-integration$/,
	replacement: path.join(packagesDir, 'server-core-integration/src/index.ts'),
}

/**
 * Point imports of corelib's built output at its sources. This is needed for vi.mock to affect modules that corelib imports
 * (such as nanoid), as the built commonjs output is loaded natively rather than through vitest
 */
const corelibSrcAlias = {
	find: /^@sofie-automation\/corelib\/dist\/(.+?)(\.js)?$/,
	replacement: path.join(packagesDir, 'corelib/src/$1'),
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

/** Apply SOFIE_TEST_PROJECTS. Unknown names are an error, so that a typo doesn't quietly run nothing */
function selectProjects(projects: TestProjectInlineConfiguration[]): TestProjectInlineConfiguration[] {
	if (onlyProjects.length === 0) return projects

	const knownNames = projects.map((project) => project.test?.name)
	const unknownNames = onlyProjects.filter((name) => !knownNames.includes(name))
	if (unknownNames.length > 0) {
		throw new Error(
			`SOFIE_TEST_PROJECTS contains unknown projects: ${unknownNames.join(', ')}. Known projects: ${knownNames.join(', ')}`
		)
	}

	return projects.filter((project) => onlyProjects.includes(project.test?.name as string))
}

export default defineConfig({
	test: {
		root: packagesDir,
		projects: selectProjects([
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
			packageProject('webui', {
				include: ['src/**/__tests__/**/*.{spec,test}.{ts,tsx,js}'],
				alias: [
					corelibSrcAlias,
					{ find: /^meteor\/(.*)$/, replacement: path.join(packagesDir, 'webui/src/meteor/$1') },
				],
				test: {
					environment: 'jsdom',
					setupFiles: ['./src/__mocks__/_setupMocks.ts', './src/client/__tests__/vitest-setup.ts'],
				},
			}),
			packageProject('job-worker', {
				alias: [corelibSrcAlias],
				test: {
					globalSetup: './src/__mocks__/global-setup.mjs',
					setupFiles: ['./src/__mocks__/_setupMocks.ts'],
				},
			}),

			packageProject('sofie-core', {
				alias: [corelibSrcAlias],
				test: {
					// The integration tests need a real MongoDB, so run in their own project
					exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.{ts,js}'],
					globalSetup: './src/__mocks__/global-setup.mjs',
					setupFiles: ['./src/__mocks__/_setupMocks.ts'],
				},
			}),
			packageProject('sofie-core-integration', {
				dir: 'sofie-core',
				include: ['src/**/*.integration.test.{ts,js}'],
				alias: [corelibSrcAlias],
				test: {
					// A single in-memory MongoDB replica set is booted for the whole project, and reused by every file
					globalSetup: './src/__mocks__/integration-global-setup.mjs',
					setupFiles: ['./src/__mocks__/_setupMocks.ts'],
					// These tests wait on real change-stream / replica-set I/O, which is slower than the 5s default under load.
					// The polling helpers (see `waitFor`) use a lower ceiling, so that they report a genuine hang
					testTimeout: 30000,
				},
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
		]),
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
