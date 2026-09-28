import { generateEslintConfig } from '@sofie-automation/code-standard-preset/eslint/main.mjs'
import pluginYaml from 'eslint-plugin-yml'
import pluginReact from 'eslint-plugin-react'
import globals from 'globals'

const extendedRules = await generateEslintConfig({
	ignores: [
		'packages/openapi/client',
		'packages/openapi/server',
		'packages/live-status-gateway/server',
		'packages/live-status-gateway-api/server',
		'packages/documentation', // Temporary?
		'packages/webui/public',
		'packages/webui/dist',
		'packages/webui/src/fonts',
		'packages/webui/src/meteor',
		'packages/webui/vite.config.mts', // This errors because of tsconfig structure
		'packages/sofie-core/scripts',
		'packages/sofie-core/src/_force_restart.js',
		'packages/sofie-core/dist',
		'scripts',
		// Repo-level config, not part of any package
		'.github',
		'*.yml',
		'*.yaml',
	],
})
extendedRules.push(
	...pluginYaml.configs['flat/recommended'],
	{
		files: ['**/*.yaml'],

		rules: {
			'yml/quotes': ['error', { prefer: 'single' }],
			'yml/spaced-comment': ['error'],
			'spaced-comment': ['off'],
		},
	},
	{
		files: ['packages/openapi/**/*'],
		rules: {
			'n/no-missing-import': 'off', // erroring on every single import
		},
	}
)

const tmpWebuiRules = {
	// Temporary rules to be removed over time
	'@typescript-eslint/ban-types': 'off',
	'@typescript-eslint/no-namespace': 'off',
	'@typescript-eslint/no-var-requires': 'off',
	'@typescript-eslint/no-non-null-assertion': 'off',
	'@typescript-eslint/unbound-method': 'off',
	'@typescript-eslint/no-misused-promises': 'off',
	'@typescript-eslint/no-unnecessary-type-assertion': 'off',

	'n/file-extension-in-import': 'off', // many issues currently
}
extendedRules.push(
	{
		settings: {
			react: {
				version: 'detect',
			},
		},
	},
	pluginReact.configs.flat.recommended,
	pluginReact.configs.flat['jsx-runtime'],
	{
		files: ['packages/webui/src/**/*', 'packages/shared-lib/src/**/*', 'packages/server-core-integration/src/**/*'],
		rules: {
			// Override default behaviour for ESM and verbatimModuleSyntax
			'n/no-missing-import': [
				'error',
				{
					ignoreTypeImport: true,
					resolverConfig: {
						// The default aliases drop the js version, breaking the /dist imports
						extensionAlias: {
							'.js': ['.ts', '.tsx', '.js'],
							'.cjs': ['.cts', '.cjs'],
							'.mjs': ['.mts', '.mjs'],
						},
					},
				},
			],
			'no-duplicate-imports': 'error',
			'@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
			'@typescript-eslint/no-import-type-side-effects': 'error',
		},
	},
	{
		files: ['packages/webui/src/**/*'],
		languageOptions: {
			globals: {
				...globals.browser,
				JSX: true,
			},
		},
		rules: {},
	},
	{
		// For some reason, the tsconfig has to be specified here explicitly
		files: ['packages/webui/src/**/*.ts', 'packages/webui/src/**/*.tsx'],
		languageOptions: {
			parserOptions: {
				project: './packages/webui/tsconfig.eslint.json',
			},
		},
		rules: {},
	},
	{
		files: ['packages/webui/src/**/*'],
		rules: {
			// custom
			'no-inner-declarations': 'off', // some functions are unexported and placed inside a namespace next to related ones
			'n/no-unsupported-features/node-builtins': 'off', // webui code is not run in node.js
			'n/no-extraneous-import': 'off', // because there are a lot of them as dev-dependencies
			'n/no-missing-import': 'off', // erroring on every single import
			'react/prop-types': 'off', // we don't use this
			'@typescript-eslint/no-empty-interface': 'off', // many prop/state types are {}
			'@typescript-eslint/no-empty-object-type': 'off', // many prop/state types are {}
			'@typescript-eslint/promise-function-async': 'off', // event handlers can't be async

			...tmpWebuiRules,
		},
	}
)

// The server (packages/sofie-core)
const tmpServerRules = {
	// Temporary rules to be removed over time
	'@typescript-eslint/ban-types': 'off',
	'@typescript-eslint/no-namespace': 'off',
	'@typescript-eslint/no-var-requires': 'off',
	'@typescript-eslint/no-non-null-assertion': 'off',
	'@typescript-eslint/unbound-method': 'off',
	'@typescript-eslint/no-misused-promises': 'off',
	'@typescript-eslint/no-unnecessary-type-assertion': 'off',
	'@typescript-eslint/no-require-imports': 'off',
}
extendedRules.push(
	{
		// The tests and mocks are not part of the server's own tsconfig, they are type-checked as part of the shared test
		// project. eslint needs to be told about both to cover every file.
		files: ['packages/sofie-core/**/*.ts'],
		languageOptions: {
			parserOptions: {
				project: ['./packages/sofie-core/tsconfig.json', './tsconfig.test.json'],
			},
		},
	},
	{
		files: ['packages/sofie-core/**/*'],
		rules: {
			// custom
			'no-inner-declarations': 'off', // some functions are unexported and placed inside a namespace next to related ones

			'n/no-extraneous-import': 'off', // because there are a lot of them as dev-dependencies
			'n/no-missing-import': 'off', // erroring on every single import
			'react/prop-types': 'off', // we don't use this
			'@typescript-eslint/no-empty-interface': 'off', // many prop/state types are {}
			'@typescript-eslint/promise-function-async': 'off', // event handlers can't be async

			'n/file-extension-in-import': ['error', 'never'], // Imports of ts files must not carry a js extension

			...tmpServerRules,
		},
	},
	{
		files: ['packages/sofie-core/src/worker/worker.ts'],
		rules: {
			// require('../_force_restart') only exists in dev, not in prod builds; can't use an
			// inline eslint-disable since it'd be "unused" (and stripped by --fix) locally
			'n/no-missing-require': 'off',
		},
	}
)

export default extendedRules
