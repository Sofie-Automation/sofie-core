const path = require('path')

const commonConfig = {
	moduleNameMapper: {
		'^@sofie-automation/shared-lib/dist/(.+)\\.js$': '<rootDir>/../shared-lib/src/$1',
		'^@sofie-automation/shared-lib/dist/(.+)$': '<rootDir>/../shared-lib/src/$1',
		// Ensure libraries that would match the extension rule are still resolved
		'bignumber.js': 'bignumber.js',
		// Drop file extensions in imports
		'(.+)\\.js$': '$1',
	},
	unmockedModulePathPatterns: ['/^imports\\/.*\\.jsx?$/', '/^node_modules/'],
	globals: {},
	moduleFileExtensions: ['ts', 'js', 'json'],
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
				isolatedModules: true, // Skip type check to reduce memory impact, as we are already do a yarn check-types
				tsconfig: 'tsconfig.jest.json',
				diagnostics: {
					ignoreCodes: ['TS151001'],
				},
			},
		],
		'^.+\\.(js|jsx|mjs)$': path.join(__dirname, 'scripts/babel-jest.js'),
	},
	transformIgnorePatterns: ['node_modules/(?!(debounce-fn|p-queue|p-timeout|mimic-fn)/)', '\\.pnp\\.[^\\/]+$'],
	globalSetup: './src/__mocks__/global-setup.js',
	setupFilesAfterEnv: ['./src/__mocks__/_setupMocks.ts'],
}

module.exports = {
	projects: [
		// Fast unit tests (the default inner loop). Integration tests (`*.integration.test.ts`, which spin up a
		// real MongoDB) are excluded here and live in the `integration` project below.
		Object.assign({}, commonConfig, {
			displayName: 'unit',
			testMatch: [
				'<rootDir>/src/__tests__/**/*.(spec|test).(ts|js)',
				'<rootDir>/src/**/__tests__/**/*.(spec|test).(ts|js)',
			],
			testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.(ts|js)$'],
			testEnvironment: 'node',
		}),
		// Real-MongoDB integration tests. A single in-memory replica set is booted once for the whole project
		// (see src/__mocks__/integration-global-setup.js) and reused across every file. Run on its own with
		// `jest --selectProjects integration`; `yarn unit` runs it alongside the `unit` project.
		Object.assign({}, commonConfig, {
			displayName: 'integration',
			testMatch: ['<rootDir>/src/**/*.integration.test.(ts|js)'],
			testEnvironment: 'node',
			globalSetup: './src/__mocks__/integration-global-setup.js',
			globalTeardown: './src/__mocks__/integration-global-teardown.js',
			// These tests wait on real change-stream / replica-set I/O, which is slower under CI load than the
			// 5s jest default. The timeout is raised via `jest.setTimeout` in a setup file rather than the
			// `testTimeout` option, because jest only reads `testTimeout` from the global config - setting it
			// on a project is silently ignored. Tests needing longer still override inline.
			setupFilesAfterEnv: [...commonConfig.setupFilesAfterEnv, './src/__mocks__/_setupIntegrationTimeout.ts'],
		}),
	],
	coverageProvider: 'v8',
	coverageThreshold: {
		global: {
			branches: 0,
			functions: 0,
			lines: 0,
			statements: 0,
		},
	},
	coverageDirectory: './.coverage/',
	collectCoverageFrom: [
		'src/**/*.{js,ts}',
		'!**/*.{tsx}',
		'!**/__tests__/**',
		'!**/__mocks__/**',
		'!**/node_modules/**',
	],
	collectCoverage: false,
}
