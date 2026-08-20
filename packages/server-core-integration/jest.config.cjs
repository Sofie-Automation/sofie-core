module.exports = {
	globals: {},
	moduleFileExtensions: ['ts', 'js'],
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.json',
				diagnostics: {
					ignoreCodes: [
						151002, // hybrid module kind (Node16/18/Next)
						2823, // Import attributes not supported in CJS mode (ts-jest forces CJS, emits require() anyway)
						7006, // Parameter implicitly has an 'any' type
						7016, // Some import errors with underscore
					],
				},
			},
		],
	},
	moduleNameMapper: {
		'^@sofie-automation/shared-lib/dist/(.+)\\.js$': '<rootDir>/../shared-lib/src/$1',
		'^@sofie-automation/shared-lib/dist/(.+)$': '<rootDir>/../shared-lib/src/$1',
		'(.+)\\.js$': '$1',
	},
	testMatch: ['**/__tests__/**/*.spec.(ts|js)'],
	testPathIgnorePatterns: ['integrationTests'],
	testEnvironment: 'node',
	coverageThreshold: {
		global: {
			branches: 0,
			functions: 0,
			lines: 0,
			statements: 0,
		},
	},
	coverageDirectory: './coverage/',
	coverageProvider: 'v8',
	collectCoverage: true,
	coveragePathIgnorePatterns: ['/node_modules/', 'd.ts'],
	preset: 'ts-jest',
}
