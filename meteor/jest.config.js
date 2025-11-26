const path = require('path')

const commonConfig = {
	modulePaths: ['<rootDir>/node_modules/'],
	moduleNameMapper: {
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
				tsconfig: 'tsconfig.json',
				diagnostics: {
					ignoreCodes: ['TS151001'],
				},
			},
		],
		'^.+\\.(js|jsx|mjs)$': path.resolve('./scripts/babel-jest.js'),
	},
	transformIgnorePatterns: ['node_modules/(?!(debounce-fn|p-queue|p-timeout|mimic-fn)/)', '\\.pnp\\.[^\\/]+$'],
	globalSetup: './__mocks__/global-setup.js',
	setupFilesAfterEnv: ['./__mocks__/_setupMocks.ts'],
	watchPathIgnorePatterns: ['/.meteor/'],
}

module.exports = {
	projects: [
		Object.assign({}, commonConfig, {
			testMatch: [
				'<rootDir>/server/__tests__/**/*.(spec|test).(ts|js)',
				'<rootDir>/server/**/__tests__/**/*.(spec|test).(ts|js)',
				'!.meteor/*.*',
			],
			testEnvironment: 'node',
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
		'server/**/*.{js,ts}',
		'lib/**/*.{js,ts}',
		'!**/*.{tsx}',
		'!.meteor/**/*.*',
		'!**/__tests__/**',
		'!**/__mocks__/**',
		'!**/node_modules/**',
	],
	collectCoverage: false,
}
