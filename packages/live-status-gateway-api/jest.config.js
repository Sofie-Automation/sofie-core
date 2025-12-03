module.exports = {
	globals: {},
	moduleFileExtensions: ['js', 'ts'],
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.json',
			},
		],
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
