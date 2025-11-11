import { Configuration, SofieApi } from '../client/ts/index.js'

async function wait(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
}

export async function checkServer(config: Configuration): Promise<void> {
	const sofieApi = new SofieApi(config)
	for (let attempt = 0; attempt < 10; attempt++) {
		try {
			await sofieApi.index() // Throws an error if API is not available
			return
		} catch (_err) {
			// Ignore
		}
		await wait(1000)
	}

	throw new Error(`Failed to connect to server`)
}
