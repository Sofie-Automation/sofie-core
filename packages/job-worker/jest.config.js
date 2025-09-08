const path = require('path')

module.exports = {
	globals: {},
	moduleFileExtensions: ['js', 'ts', 'json'],
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.json',
				babelConfig: {
					plugins: ['@babel/plugin-transform-modules-commonjs'],
				},
				diagnostics: {
					// ignoreCodes: ['TS151001'],
					ignoreCodes: [
						6133, // Declared but not used
						6192, // All imports are unused
					],
				},
			},
		],
		'^.+\\.(js|jsx|mjs)$': path.resolve('./scripts/babel-jest.mjs'),
	},
	moduleNameMapper: {
		'(.+)\\.js$': '$1',
	},
	transformIgnorePatterns: ['node_modules/(?!(debounce-fn|p-queue|p-timeout)/)', '\\.pnp\\.[^\\/]+$'],
	globalSetup: './src/__mocks__/global-setup.js',
	setupFilesAfterEnv: ['./src/__mocks__/_setupMocks.ts'],
	testMatch: ['**/__tests__/**/*.(spec|test).(ts|js)'],
	testPathIgnorePatterns: ['integrationTests'],
	testEnvironment: 'node',
	// coverageThreshold: {
	// 	global: {
	// 		branches: 80,
	// 		functions: 100,
	// 		lines: 95,
	// 		statements: 90,
	// 	},
	// },
	coverageDirectory: './coverage/',
	coverageProvider: 'v8',
	collectCoverage: true,
	preset: 'ts-jest',
}
