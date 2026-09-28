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
	// The tests and mocks are not part of this package's own tsconfig, they are type-checked as part of the
	// shared test project over in `packages`. eslint needs to be told about both to cover every file.
	tsconfigName: ['tsconfig.json', '../packages/tsconfig.test.json'],
	ignores: ['.meteor', 'public', 'scripts', 'server/_force_restart.js', '/packages/', '_build', 'dist'],

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
extendedRules.push({
	files: ['server/worker/worker.ts'],
	rules: {
		// require('../_force_restart') only exists in dev, not in prod builds; can't use an
		// inline eslint-disable since it'd be "unused" (and stripped by --fix) locally
		'n/no-missing-require': 'off',
	},
})

export default extendedRules
