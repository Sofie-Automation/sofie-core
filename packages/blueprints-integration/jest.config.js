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
					],
				},
			},
		],
	},
	moduleNameMapper: {
		'(.+)\\.js$': '$1',
	},
	testMatch: ['**/__tests__/**/*.spec.(ts|js)'],
	testPathIgnorePatterns: ['integrationTests'],
	testEnvironment: 'node',
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 100,
			lines: 95,
			statements: 90,
		},
	},
	coverageDirectory: './coverage/',
	coverageProvider: 'v8',
	collectCoverage: true,
	preset: 'ts-jest',
}
