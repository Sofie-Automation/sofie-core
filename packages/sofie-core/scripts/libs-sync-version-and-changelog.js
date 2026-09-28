const { exec } = require('child_process')

const PACKAGE_VERSION = require('../package.json').version

const cmd = `cd ../packages && yarn set-version-and-changelog ${PACKAGE_VERSION} && yarn stage-versions`
console.log(cmd)
const child = exec(cmd, (error, stdout, stderr) => {
	if (error) {
		console.log(`error: ${error.message}`)
		process.exit(1)
	} else {
		if (stdout) {
			console.log(`stdout: ${stdout}`)
		}
		if (stderr) {
			console.log(`stderr: ${stderr}`)
		}
		process.exit(child.exitCode)
	}
})
