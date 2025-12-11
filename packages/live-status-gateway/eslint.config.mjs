import { generateEslintConfig } from '@sofie-automation/code-standard-preset/eslint/main.mjs'
import pluginYaml from 'eslint-plugin-yml'

const extendedRules = await generateEslintConfig({})
extendedRules.push(...pluginYaml.configs['flat/recommended'], {
	files: ['**/*.yaml'],

	rules: {
		'yml/quotes': ['error', { prefer: 'single' }],
		'yml/spaced-comment': ['error'],
		'spaced-comment': ['off'],
	},
})

export default extendedRules
