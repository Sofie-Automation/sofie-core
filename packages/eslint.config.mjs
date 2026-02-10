import { generateEslintConfig } from '@sofie-automation/code-standard-preset/eslint/main.mjs'
import pluginYaml from 'eslint-plugin-yml'
import pluginReact from 'eslint-plugin-react'
import globals from 'globals'

const extendedRules = await generateEslintConfig({
	ignores: [
		'openapi/client',
		'openapi/server',
		'live-status-gateway/server',
		'live-status-gateway-api/server',
		'documentation', // Temporary?
		'webui/public',
		'webui/dist',
		'webui/src/fonts',
		'webui/src/meteor',
		'webui/vite.config.mts', // This errors because of tsconfig structure
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
		files: ['openapi/**/*'],
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
		files: ['webui/src/**/*'],
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
		files: ['webui/src/**/*.ts', 'webui/src/**/*.tsx'],
		languageOptions: {
			parserOptions: {
				project: './webui/tsconfig.eslint.json',
			},
		},
		rules: {},
	},
	{
		files: ['webui/src/**/*'],
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

export default extendedRules
