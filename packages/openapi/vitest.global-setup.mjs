import yaml from 'js-yaml'
import fs from 'node:fs'

export default async function () {
	// Read the required URL from the API yaml file
	const doc = yaml.load(fs.readFileSync('./api/actions.yaml', 'utf8'))

	// Test whether the current server is a test server
	if (!process.env.SERVER_TYPE) {
		process.env.SERVER_TYPE = 'TEST'
	}

	const defaultPort = !isNaN(process.env.SERVER_PORT) ? Number(process.env.SERVER_PORT) : 3000

	if (!process.env.SERVER_URL) {
		process.env.SERVER_URL = `http://localhost:${defaultPort}/api/v1.0`
	}

	await fetch(`${process.env.SERVER_URL}/`).catch(() => {
		console.log('Connecting to Sofie Actions server')
		process.env.SERVER_TYPE = 'SOFIE'
		process.env.SERVER_URL = doc.servers[0].url
	})
}
