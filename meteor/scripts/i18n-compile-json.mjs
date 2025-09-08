import { glob } from 'glob'
import { spawn } from 'child_process'

/*************************************************

This script goes through all of the languages (.po files)
and compiles the json-files (used in production).

**************************************************/

const errors = []
const failedLanguages = []
// List all po-files:
const poFiles = await glob('./i18n/*.po')

const languages = []
for (const poFile of poFiles) {
	const mLanguage = poFile.match(/\/(\w+)\.po/)
	if (mLanguage) languages.push(mLanguage[1])
}

console.log(`🔍 Found languages: ${languages.join(', ')}`)

for (const lng of languages) {
	try {
		console.log('\n')
		await runCmd(
			`i18next-conv -l ${lng} -s i18n/${lng}.po -t ../packages/webui/public/locales/${lng}/translations.json --skipUntranslated`
		)
	} catch (e) {
		console.error(`💣 Failed: ${lng}`)
		errors.push(`${lng}: ${e}`)
		failedLanguages.push(lng)
	}
}

if (errors.length) {
	for (const error of errors) {
		console.error(error)
	}
	console.log(`\n\n😓 Failed to compile: ${failedLanguages.join(', ')}`)
	process.exit(1)
}

console.log(`\n\n🥳 Succesfully compiled all translations: ${languages.join(', ')}`)

function runCmd(cmd) {
	console.log(cmd)
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, {
			shell: true,
			windowsHide: true,
		})
		child.stdout.on('data', (data) => {
			console.log(`${data}`.trim())
		})
		child.stderr.on('data', (data) => {
			console.error(`${data}`.trim())
		})
		child.on('close', (code) => {
			if (code === 0) resolve()
			else reject(new Error(`child process exited with code ${code}`))
		})
	})
}
