module.exports = {
	setupFilesAfterEnv: [
		'./src/__mocks__/_setupMocks.ts',
		'<rootDir>/src/client/__tests__/jest-setup.cjs',
		'@testing-library/jest-dom',
	],
	globals: {},
	moduleFileExtensions: ['js', 'ts', 'tsx'],
	moduleNameMapper: {
		'sha.js': 'sha.js',
		'meteor/(.*)': '<rootDir>/src/meteor/$1',
		'(.+)\\.js$': '$1',
	},
	transform: {
		'^.+\\.(ts|tsx)$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.jest.json',
			},
		],
		'^.+\\.(js|jsx)$': ['babel-jest', { presets: ['@babel/preset-env'] }],
	},
	transformIgnorePatterns: ['node_modules/(?!(nanoid)/)', '\\.pnp\\.[^\\/]+$'],
	testMatch: ['**/__tests__/**/*.(spec|test).(ts|tsx|js)'],
	testPathIgnorePatterns: ['integrationTests'],
	testEnvironment: 'jsdom',
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
