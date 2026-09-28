import path from 'node:path'
import { defineConfig, type TestProjectInlineConfiguration } from 'vitest/config'

const packagesDir = path.join(import.meta.dirname, 'packages')

/** Point imports of shared-lib's built output at its sources, so tests don't need it to be built first */
const sharedLibSrcAlias = {
	find: /^@sofie-automation\/shared-lib\/dist\/(.+?)(\.js)?$/,
	replacement: path.join(packagesDir, 'shared-lib/src/$1'),
}

interface ProjectOptions {
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
			root: path.join(packagesDir, name),
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
		],
		coverage: {
			// Match jest's previous collectCoverage: true. Disable with --coverage=false
			enabled: true,
			provider: 'v8',
			reportsDirectory: './coverage',
			reporter: ['text', 'lcov'],
			exclude: ['**/__tests__/**', '**/__mocks__/**', '**/node_modules/**', '**/dist/**'],
			thresholds: {
				'blueprints-integration/src/**': {
					branches: 80,
					functions: 100,
					lines: 95,
					statements: 90,
				},
			},
		},
	},
})
