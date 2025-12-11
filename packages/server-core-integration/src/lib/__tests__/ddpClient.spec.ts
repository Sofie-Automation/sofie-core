import { DDPClient, DDPConnectorOptions } from '../../index.js'
jest.mock('faye-websocket')

const wait = async (t: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, t)
	})

it('Creates a DDP client without options', () => {
	const ddp = new DDPClient()
	expect(ddp).toBeTruthy()
})

it('Creates a DDP Client with options', () => {
	const ddp = new DDPClient({
		host: '127.0.0.99',
		port: 3210,
	} as DDPConnectorOptions)
	expect(ddp).toBeTruthy()
	expect(ddp.port).toBe(3210)
	expect(ddp.host).toBe('127.0.0.99')
})

it('Connects to mock server', async () => {
	const connected = jest.fn()
	const ddp = new DDPClient()
	ddp.on('connected', connected)
	ddp.connect()

	await wait(10)
	expect(connected).toHaveBeenCalled()
	ddp.close()
})
