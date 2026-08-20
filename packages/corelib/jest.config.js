module.exports = {
	globals: {},
	moduleFileExtensions: ['js', 'ts'],
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.json',
				diagnostics: {
					ignoreCodes: [
						151002, // hybrid module kind (Node16/18/Next)
						2823, // Import attributes not supported in CJS mode (ts-jest forces CJS, emits require() anyway)
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
