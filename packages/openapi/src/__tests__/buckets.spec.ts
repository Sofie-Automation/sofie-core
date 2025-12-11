import { Configuration, BucketsApi } from '../../client/ts/index.js'
import { checkServer } from '../checkServer.js'
import Logging from '../httpLogging.js'

const httpLogging = false
let testServer = false
if (process.env.SERVER_TYPE === 'TEST') {
	testServer = true
}

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.SERVER_URL,
		middleware: [new Logging(httpLogging)],
	})

	beforeAll(async () => await checkServer(config))

	const bucketsApi = new BucketsApi(config)
	test('can request all buckets available in Sofie', async () => {
		const buckets = await bucketsApi.buckets()
		expect(buckets.status).toBe(200)
		expect(buckets).toHaveProperty('result')
		expect(buckets.result.length).toBeGreaterThanOrEqual(1)
		buckets.result.forEach((bucket) => {
			expect(typeof bucket).toBe('object')
			expect(typeof bucket.id).toBe('string')
			expect(typeof bucket.name).toBe('string')
			expect(typeof bucket.studioId).toBe('string')
		})
	})

	let bucketId = ''
	test('can create a bucket', async () => {
		const bucket = await bucketsApi.addBucket({
			bucketBase: {
				name: 'My Bucket',
				studioId: 'studio0',
			},
		})
		expect(bucket.status).toBe(200)
		expect(typeof bucket.result).toBe('string')
		bucketId = bucket.result
	})

	test('can get a bucket', async () => {
		const bucket = await bucketsApi.bucket({
			bucketId,
		})
		expect(bucket.status).toBe(200)
		expect(typeof bucket.result).toBe('object')
		expect(typeof bucket.result.id).toBe('string')
		expect(typeof bucket.result.name).toBe('string')
		expect(typeof bucket.result.studioId).toBe('string')
	})

	if (testServer) {
		test('can import bucket adLib', async () => {
			const execute = await bucketsApi.importBucketAdlib({
				bucketId,
				importAdlib: {
					externalId: 'my_adlib',
					name: 'My AdLib',
					payloadType: '',
					showStyleBaseId: '',
					payload: {},
				},
			})
			expect(execute.status).toBe(200)
		})
	} else {
		test.todo('import a bucket adLib - need blueprint to support it')
	}

	if (testServer) {
		test('can delete a bucket adlib', async () => {
			const deleted = await bucketsApi.deleteBucketAdlib({
				bucketId,
				externalId: 'my_adlib',
			})
			expect(deleted.status).toBe(200)
		})
	} else {
		test.todo('delete a bucket adLib - need to be able to create it')
	}

	test('can empty a bucket', async () => {
		const deleted = await bucketsApi.deleteBucketAdlibs({
			bucketId,
		})
		expect(deleted.status).toBe(200)
	})

	test('can delete a bucket', async () => {
		const deleted = await bucketsApi.deleteBucket({
			bucketId,
		})
		expect(deleted.status).toBe(200)
	})
})
