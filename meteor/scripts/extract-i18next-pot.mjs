/**
 * The following code is based on i18next-extract-gettext, taken under license
 * from an abandoned repository:
 * https://github.com/queicherius/i18next-extract-gettext/
 *
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 David Reeß
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import fs from 'fs'
import yargs from 'yargs'
import { Parser } from 'i18next-scanner'
import converter from 'i18next-conv'
import { glob } from 'glob'

const args = yargs(process.argv)
	.option('files', {
		description: 'files to process, specified as a glob pattern',
		alias: 'f',
		type: 'string',
		required: true,
	})
	.option('output', {
		description: 'the output template file name',
		alias: 'o',
		type: 'string',
		required: true,
	})
	.option('key-separator', {
		description: 'key separator to use within the POT file',
		type: 'string',
	})
	.option('ns-separator', {
		description: 'name space separator to use within the POT file',
		type: 'string',
	})
	.option('plural-separator', {
		description: 'plural separator to use within the POT file',
		type: 'string',
	})
	.option('context-separator', {
		description: 'context separator to use within the POT file',
		type: 'string',
	})
	.help()
	.alias('help', 'h').argv

const parserOptions = {
	// Include react helpers into parsing
	attr: {
		list: ['data-i18n', 'i18nKey'],
	},
	func: {
		list: ['i18next.t', 'i18n.t', 't', 'generateTranslation'],
	},
	// Make sure common separators don't break the string
	keySeparator: args.keySeparator || '°°°°°°.°°°°°°',
	nsSeparator: args.nsSeparator || '°°°°°°:°°°°°°',
	pluralSeparator: args.pluralSeparator || '°°°°°°_°°°°°°',
	contextSeparator: args.contextSeparator || '°°°°°°_°°°°°°',
	// Interpolate correctly
	interpolation: {
		prefix: '{{',
		suffix: '}}',
	},
	acorn: {
		ecmaVersion: 11,
		sourceType: 'module',
	},
}

const parser = new Parser(parserOptions)

const fileGlob = args.files
const outputFile = args.output

console.log('Extracting translatable strings...')
console.log('This process may print out some error messages, but the translation template should work fine.')
console.log('──────\n')

const files = await glob(fileGlob)

// console.debug('Loading content of ' + files.length + ' files')

// console.debug('Parsing translation keys out of content')
files.map(function (file) {
	const content = fs.readFileSync(file, 'utf-8')
	parser.parseFuncFromString(content, parserOptions)
	parser.parseAttrFromString(content, parserOptions)
})

const json = parser.get().en.translation

// console.debug('Converting ' + Object.keys(json).length + ' translation keys into gettext')
const data = await converter.i18nextToPot('en', JSON.stringify(json), { quiet: true })
// console.debug('Writing into output file')
fs.writeFileSync(outputFile, data, 'utf-8')
console.log('\n──────')
console.log(`✅ Successfully written ${Object.keys(json).length} strings to template "${outputFile}".`)
