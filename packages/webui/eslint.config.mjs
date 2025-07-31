import { generateEslintConfig } from '@sofie-automation/code-standard-preset/eslint/main.mjs'
import pluginReact from 'eslint-plugin-react'
import globals from 'globals'

const tmpRules = {
	// Temporary rules to be removed over time
	'@typescript-eslint/ban-types': 'off',
	'@typescript-eslint/no-namespace': 'off',
	'@typescript-eslint/no-var-requires': 'off',
	'@typescript-eslint/no-non-null-assertion': 'off',
	'@typescript-eslint/unbound-method': 'off',
	'@typescript-eslint/no-misused-promises': 'off',
	'@typescript-eslint/no-unnecessary-type-assertion': 'off',
}

const extendedRules = await generateEslintConfig({
	tsconfigName: 'tsconfig.eslint.json',
	ignores: ['public', 'dist', 'src/fonts', 'src/meteor', 'vite.config.mts'],
	disableNodeRules: true,
})
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
		files: ['src/**/*'],
		languageOptions: {
			globals: {
				...globals.browser,
				JSX: true,
			},
		},
		rules: {},
	},
	{
		files: ['src/**/*'],
		rules: {
			// custom
			'no-inner-declarations': 'off', // some functions are unexported and placed inside a namespace next to related ones
			// 'n/no-missing-import': [
			// 	'error',
			// 	{
			// 		allowModules: ['meteor', 'mongodb'],
			// 		tryExtensions: ['.js', '.json', '.node', '.ts', '.tsx', '.d.ts'],
			// 	},
			// ],
			// 'n/no-extraneous-import': [
			// 	'error',
			// 	{
			// 		allowModules: ['meteor', 'mongodb'],
			// 	},
			// ],

			'n/no-extraneous-import': 'off', // because there are a lot of them as dev-dependencies
			'n/no-missing-import': 'off', // erroring on every single import
			'react/prop-types': 'off', // we don't use this
			'@typescript-eslint/no-empty-interface': 'off', // many prop/state types are {}
			'@typescript-eslint/no-empty-object-type': 'off', // many prop/state types are {}
			'@typescript-eslint/promise-function-async': 'off', // event handlers can't be async

			...tmpRules,
		},
	}
)

export default extendedRules
