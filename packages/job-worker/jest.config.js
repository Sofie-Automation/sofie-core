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
						151002, // hybrid module kind (Node16/18/Next)
						2823, // Import attributes not supported in CJS mode (ts-jest forces CJS, emits require() anyway)
					],
				},
			},
		],
		'^.+\\.(js|jsx|mjs)$': path.resolve('./scripts/babel-jest.mjs'),
	},
	moduleNameMapper: {
		'^@sofie-automation/shared-lib/dist/(.+)\\.js$': '<rootDir>/../shared-lib/src/$1',
		'^@sofie-automation/shared-lib/dist/(.+)$': '<rootDir>/../shared-lib/src/$1',
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
