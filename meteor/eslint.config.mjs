import { generateEslintConfig } from '@sofie-automation/code-standard-preset/eslint/main.mjs'

const tmpRules = {
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

const extendedRules = await generateEslintConfig({
	// tsconfigName: 'tsconfig.eslint.json',
	ignores: ['.meteor', 'public', 'scripts', 'server/_force_restart.js', '/packages/'],

	// disableNodeRules: true,
})
extendedRules.push({
	files: ['**/*'],
	rules: {
		// custom
		'no-inner-declarations': 'off', // some functions are unexported and placed inside a namespace next to related ones

		'n/no-extraneous-import': 'off', // because there are a lot of them as dev-dependencies
		'n/no-missing-import': 'off', // erroring on every single import
		'react/prop-types': 'off', // we don't use this
		'@typescript-eslint/no-empty-interface': 'off', // many prop/state types are {}
		'@typescript-eslint/promise-function-async': 'off', // event handlers can't be async

		'n/file-extension-in-import': ['error', 'never'], // Meteor breaks on importing ts files with a js extension

		...tmpRules,
	},
})

export default extendedRules
