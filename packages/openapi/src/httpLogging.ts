import { Middleware, ResponseContext, ErrorContext, RequestContext, FetchParams } from '../client/ts/index.js'

class TestError extends Error {
	override name: 'TestError' = 'TestError' as const
	constructor(msg: string) {
		super(msg)
	}
}

export default class Logging implements Middleware {
	private readonly _logging: boolean
	constructor(logging?: boolean) {
		this._logging = logging || false
	}

	async pre(context: RequestContext): Promise<void | FetchParams> {
		if (this._logging) {
			// parse body to help readability of logging
			const req = {
				...context.init,
				body: typeof context.init.body === 'string' ? JSON.parse(context.init.body.toString()) : undefined,
			}
			console.log(`Request ${context.url} - ${JSON.stringify(req, null, 2)}`)
		}
	}

	async onError(context: ErrorContext): Promise<void | Response> {
		console.log('Test error:', context.error as string)
		throw new TestError(context.error as string)
	}

	async post(context: ResponseContext): Promise<void | Response> {
		await this._logResponse(context.response)
	}

	async _logResponse(response: Response): Promise<void> {
		if (this._logging) {
			let message: string
			try {
				message = JSON.stringify(await response.json(), null, 2)
			} catch (e: any) {
				message = `Response body is not JSON! Error: "${e}"`
			}
			console.log(`Response ${response.url} ${response.status} ${response.statusText} - ${message}`)
		}
	}
}
