const cp = require('child_process')
const fs = require('fs')
const path = require('path')

function runGit(argumentList) {
	const output = cp.execFileSync('git', argumentList)
	return output.toString().trim()
}

const pkgPath = path.join(__dirname, '../package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath))

const commitTime = runGit(['log', '-1', '--pretty=format:%ct', 'HEAD'])
const dateStr = new Date(parseInt(commitTime, 10) * 1000).toISOString()
const dateStrShort =
	dateStr.replace(/[-T:]/gi, '').substring(0, 8) + '-' + dateStr.replace(/[-T:]/gi, '').substring(8, 12)
const commitHash = runGit(['rev-parse', '--short', 'HEAD'])
const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'])

const isRelease = branch === 'main' || branch === 'master' // Support "main" for future-compat

if (isRelease) {
	pkg.versionExtended = `${pkg.version}+G${commitHash}-${dateStrShort}`
} else {
	pkg.versionExtended = `${pkg.version}+${branch}-G${commitHash}-${dateStrShort}`
}

console.log('Version:', pkg.versionExtended)

fs.writeFileSync(pkgPath, JSON.stringify(pkg, undefined, 2))
