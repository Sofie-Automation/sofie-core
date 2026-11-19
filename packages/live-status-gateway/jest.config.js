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
		// Jest is not happy with esm modules, we need to point it to the source files instead
		'(.+)\\.js$': '$1',
	},
	testMatch: ['**/__tests__/**/*.(spec|test).(ts|js)'],
	testPathIgnorePatterns: ['integrationTests'],
	testEnvironment: 'node',
	testEnvironmentOptions: {
		// Resolve monorepo packages to their typescript source
		customExportConditions: ['sofie-source', 'node', 'node-addons'],
	},
	// coverageThreshold: {
	// 	global: {
	// 		branches: 100,
	// 		functions: 100,
	// 		lines: 100,
	// 		statements: 100,
	// 	},
	// },
	coverageDirectory: './coverage/',
	collectCoverage: true,
	preset: 'ts-jest',
}
