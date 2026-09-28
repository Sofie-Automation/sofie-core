import cp from 'child_process'
import process from 'process'
import concurrently from 'concurrently'

function hr() {
	// write regular dashes if this is a "simple" output stream ()
	if (!process.stdout.hasColors || !process.stdout.hasColors()) return '-'.repeat(process.stdout.columns ?? 40)
	return '─'.repeat(process.stdout.columns ?? 40)
}
function exec(cmd) {
	return new Promise((resolve, reject) => {
		cp.exec(cmd, (err, stdout, stderr) => {
			if (err) reject(err)
			resolve({ stdout, stderr })
		})
	})
}
const yarnVersion = await exec('yarn -v')

// Require yarn > 1:
if (yarnVersion.stdout.startsWith('0.') || yarnVersion.stdout.startsWith('1.')) {
	console.error("It seems like you're using an old version of yarn. Please upgrade to yarn 2 or later")
	console.error(`Detected yarn version: ${yarnVersion.stdout.trim()}`)
	console.error(`--`)
	console.error(`Tip:`)
	console.error(`To uninstall yarn classic, you can find where it's installed by running 'which yarn' or 'where yarn'`)
	console.error(`After you have uninstalled it, run 'corepack enable'`)

	process.exit(1)
}

try {
	console.log(hr())
	console.log(' 📦  Installing dependencies...')
	console.log(hr())

	await concurrently(
		[
			{
				command: 'yarn install',
				name: 'INSTALL',
				prefixColor: 'yellow',
			},
		],
		{
			prefix: 'name',
			killOthers: ['failure', 'success'],
			restartTries: 1,
		}
	).result

	console.log(hr())
	console.log(' 🪛  Building packages...')
	console.log(hr())

	await concurrently(
		[
			{
				command: `yarn build`,
				name: 'BUILD',
				prefixColor: 'yellow',
			},
		],
		{
			prefix: 'name',
			killOthers: ['failure', 'success'],
			restartTries: 1,
		}
	).result
} catch (e) {
	console.error(e.message)
	process.exit(1)
}

function signalHandler(signal) {
	process.exit()
}

// Make sure to exit on interrupt
process.on('SIGINT', signalHandler)
process.on('SIGTERM', signalHandler)
process.on('SIGQUIT', signalHandler)
