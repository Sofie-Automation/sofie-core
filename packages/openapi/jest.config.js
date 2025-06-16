module.exports = {
	globalSetup: './jest.setup.js',
	moduleFileExtensions: ['js', 'ts'],
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.json',
			},
		],
	},
	moduleNameMapper: {
		'(.+)\\.js$': '$1',
	},
	testMatch: ['**/__tests__/**/*.spec.(ts|js)'],
	testEnvironment: 'node',
	coverageThreshold: {
		global: {
			branches: 60,
			functions: 60,
			lines: 60,
			statements: 60,
		},
	},
	coveragePathIgnorePatterns: [
		'client/ts/index.ts',
		'client/ts/runtime.ts',
		'client/ts/models',
		'src/httpLogging',
		'src/checkServer',
	],
	coverageDirectory: './coverage/',
	collectCoverage: true,
	preset: 'ts-jest',
}
