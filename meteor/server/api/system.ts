import _ from 'underscore'
import { Time } from '../lib/tempLib'
import { sleep, getCurrentTime } from '../lib/lib'
import { registerClassToMeteorMethods } from '../methods'
import { MethodContextAPI, MethodContext } from './methodContext'
import {
	SystemAPIMethods,
	CollectionCleanupResult,
	SystemAPI,
	BenchmarkResult,
	SystemBenchmarkResults,
} from '@sofie-automation/meteor-lib/dist/api/system'
import { CollectionIndexes, getTargetRegisteredIndexes } from '../collections/indices'
import { Meteor } from 'meteor/meteor'
import { logger } from '../logging'
import { check } from '../lib/check'
import { IndexSpecifier } from '@sofie-automation/meteor-lib/dist/collections/lib'
import { getBundle as getTranslationBundleInner } from './translationsBundles'
import { TranslationsBundle } from '@sofie-automation/meteor-lib/dist/collections/TranslationsBundles'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { cleanupOldDataInner } from './cleanup'
import { IndexSpecification } from 'mongodb'
import { nightlyCronjobInner } from '../cronjobs'
import { TranslationsBundleId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { createAsyncOnlyMongoCollection, AsyncOnlyMongoCollection } from '../collections/collection'
import { generateToken } from './singleUseTokens'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { assertConnectionHasOneOfPermissions } from '../security/auth'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'

const PERMISSIONS_FOR_SYSTEM_CLEANUP: Array<keyof UserPermissions> = ['configure']

async function setupIndexes(removeOldIndexes = false): Promise<Array<IndexSpecification>> {
	// Note: This function should NOT run on Meteor.startup, due to getCollectionIndexes failing if run before indexes have been created.
	const registeredIndexes = getTargetRegisteredIndexes()
	if (!Meteor.isServer) throw new Meteor.Error(500, `setupIndexes() can only be run server-side`)

	const removeIndexes: IndexSpecification[] = []
	await Promise.all(
		Object.entries<CollectionIndexes<any>>(registeredIndexes).map(async ([collectionName, targetInfo]) => {
			const rawCollection = targetInfo.collection.rawCollection()
			const existingIndexes = (await rawCollection.indexes()) as any[]

			const targetIndexes: IndexSpecifier<any>[] = [...targetInfo.indexes, { _id: 1 }]

			// don't touch the users collection, as Metoer adds a few indexes of it's own
			if (collectionName !== 'users') {
				// Check if there are old indexes in the database that should be removed:
				for (const existingIndex of existingIndexes) {
					if (!existingIndex.name) continue // ?

					// Check if the existing index should be kept:
					const found = targetIndexes.find((newIndex) => _.isEqual(newIndex, existingIndex.key))
					if (!found) {
						removeIndexes.push(existingIndex)
						// The existing index does not exist in our specified list of indexes, and should be removed.
						if (removeOldIndexes) {
							logger.info(`Removing index: ${JSON.stringify(existingIndex.key)}`)
							rawCollection.dropIndex(existingIndex.name).catch((e) => {
								logger.warn(
									`Failed to drop index: ${JSON.stringify(existingIndex.key)}: ${stringifyError(e)}`
								)
							})
						}
					}
				}
			}

			// Ensure new indexes (add if not existing):
			for (const index of targetInfo.indexes) {
				targetInfo.collection.createIndex(index)
			}
		})
	)
	return removeIndexes
}
function createIndexes(): void {
	const indexes = getTargetRegisteredIndexes()
	if (!Meteor.isServer) throw new Meteor.Error(500, `setupIndexes() can only be run server-side`)

	// Ensure new indexes:
	_.each(indexes, (i) => {
		_.each(i.indexes, (index) => {
			i.collection.createIndex(index)
		})
	})
}

Meteor.startup(() => {
	// Ensure indexes are created on startup:
	createIndexes()
})

async function cleanupIndexes(
	context: MethodContext,
	actuallyRemoveOldIndexes: boolean
): Promise<Array<IndexSpecification>> {
	check(actuallyRemoveOldIndexes, Boolean)
	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_SYSTEM_CLEANUP)

	return setupIndexes(actuallyRemoveOldIndexes)
}
async function cleanupOldData(
	context: MethodContext,
	actuallyRemoveOldData: boolean
): Promise<string | CollectionCleanupResult> {
	check(actuallyRemoveOldData, Boolean)

	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_SYSTEM_CLEANUP)

	return cleanupOldDataInner(actuallyRemoveOldData)
}
async function runCronjob(context: MethodContext): Promise<void> {
	assertConnectionHasOneOfPermissions(context.connection, ...PERMISSIONS_FOR_SYSTEM_CLEANUP)

	return nightlyCronjobInner()
}

let mongoTest: AsyncOnlyMongoCollection<any> | undefined = undefined
/** Runs a set of system benchmarks, that are designed to test various aspects of the hardware-performance on the server */
async function doSystemBenchmarkInner() {
	if (!mongoTest) {
		mongoTest = createAsyncOnlyMongoCollection<any>('benchmark-test' as any, false)
		mongoTest.createIndex({
			indexedProp: 1,
		})
	}
	const cleanup = async () => {
		if (mongoTest) {
			// clean up
			await mongoTest.removeAsync({})
		}
	}

	const result: BenchmarkResult = {
		mongoWriteSmall: -1,
		mongoWriteBig: -1,
		mongoRead: -1,
		mongoIndexedRead: -1,
		cpuCalculations: -1,
		cpuStringifying: -1,
	}
	// Note: The tests "sizes" / iterations are chosen so that they should run somewhere around 100ms
	try {
		await sleep(10)
		{
			// MongoDB test: Do a number of small writes:
			const startTime = Date.now()
			const insertedIds: string[] = []
			for (let i = 0; i < 100; i++) {
				const objectToInsert = {
					_id: 'myObject' + i,
					prop0: {
						asdf: 'asdf',
						ghjk: 123456,
					},
				}
				insertedIds.push(await mongoTest.insertAsync(objectToInsert))
				await mongoTest.updateAsync(objectToInsert._id, {
					$set: {
						prop1: 'qwerty',
					},
				})
			}
			for (const id of insertedIds) {
				await mongoTest.removeAsync(id)
			}
			result.mongoWriteSmall = Date.now() - startTime
		}
		await sleep(10)
		{
			// MongoDB test: Do a number of large writes:
			const startTime = Date.now()
			const insertedIds: string[] = []
			for (let i = 0; i < 10; i++) {
				const objectToInsert = {
					_id: 'myObject' + i,
					objs: _.range(0, 1000).map((j) => {
						return {
							id: 'innerObj' + j,
							data0: 'asdfkawhbeckjawhefkjashvdfckasdf',
							data1: 'we4roivbnworeitgv398rvnw9384rvnf34',
							data2: '234f23f423f4',
							data3: Date.now(),
							data4: 'wvklwjnserolvjwn3erlkvjwnerlkvn',
							data5: '3oig23oi45ugnf2o3iu4nf2o3iu4nf',
							data6: '5g2987543hg9285hg3',
							data7: '20359gj2834hf2390874fh203874hf02387h4f02837h4f0238h028h428734f0273h4f08723h4tpo2n,mnbsdfljbvslfkvnkjgv',
						}
					}),
					prop0: 'asdf',
				}
				insertedIds.push(await mongoTest.insertAsync(objectToInsert))
				await mongoTest.updateAsync(objectToInsert._id, {
					$set: {
						prop1: 'qwerty',
					},
				})
			}
			for (const id of insertedIds) {
				await mongoTest.removeAsync(id)
			}
			result.mongoWriteBig = Date.now() - startTime
		}
		{
			// MongoDB test: read
			const DOC_COUNT = 100
			// Prepare data in db:
			for (let i = 0; i < DOC_COUNT; i++) {
				const objectToInsert = {
					_id: 'myObject' + i,
					objs: _.range(0, 100).map((j) => {
						return {
							id: 'innerObj' + j,
							data0: 'asdfkawhbeckjawhefkjashvdfckasdf9q37246fg2w9375fhg209485hf0238757h834h08273h50235h4gf+0237h5u7hg2475hg082475hgt',
						}
					}),
					prop0: i,
					indexedProp: i,
				}
				await mongoTest.insertAsync(objectToInsert)
				await mongoTest.updateAsync(objectToInsert._id, {
					$set: {
						prop1: 'qwerty',
					},
				})
			}
			await sleep(10)

			// Reads with no help from index:
			let startTime = Date.now()
			for (let i = 0; i < DOC_COUNT; i++) {
				const readData = await mongoTest.findFetchAsync({ prop0: i })
				if (readData.length !== 1) throw Error('Expected to have read 1 document')
			}
			result.mongoRead = Date.now() - startTime

			// Reads with help from index:
			startTime = Date.now()
			for (let i = 0; i < DOC_COUNT; i++) {
				const readData = await mongoTest.findFetchAsync({ indexedProp: i })
				if (readData.length !== 1) throw Error('Expected to have read 1 document')
			}
			result.mongoIndexedRead = Date.now() - startTime

			// cleanup:
			await mongoTest.removeAsync({})
		}
		await sleep(10)
		// CPU test: arithmetic calculations:
		{
			const startTime = Date.now()
			const map: any = {}
			let number = 0
			for (let i = 0; i < 6e4; i++) {
				number += i
				if (number > 10e5) number -= 10e5
				map[`v_${number}`] = `${number}`.slice(1)
			}
			_.values(map).sort((a, b) => {
				if (a < b) return 1
				if (a > b) return -1
				return 0
			})
			result.cpuCalculations = Date.now() - startTime
		}
		await sleep(10)
		// CPU test: JSON stringifying:
		{
			const objectsToStringify = _.range(0, 40e3).map((i) => {
				return {
					_id: 'myObject' + i,
					prop0: {
						asdf: 'asdf' + i,
						ghjk: 123456,
					},
				}
			})
			const startTime = Date.now()

			for (const o of objectsToStringify) {
				JSON.parse(JSON.stringify(o))
			}

			result.cpuStringifying = Date.now() - startTime
		}
		await sleep(10)

		await cleanup()
	} catch (error) {
		await cleanup()
		throw error
	}

	return result
}
async function doSystemBenchmark(context: MethodContext, runCount = 1): Promise<SystemBenchmarkResults> {
	assertConnectionHasOneOfPermissions(context.connection, 'developer')

	if (runCount < 1) throw new Error(`runCount must be >= 1`)

	const results: BenchmarkResult[] = []
	for (const _i of _.range(0, runCount)) {
		results.push(await doSystemBenchmarkInner())
		await sleep(50)
	}

	const keys: (keyof BenchmarkResult)[] = [
		'mongoWriteSmall',
		'mongoWriteBig',
		'mongoRead',
		'mongoIndexedRead',
		'cpuCalculations',
		'cpuStringifying',
	]

	const sum: BenchmarkResult = results.reduce(
		(prev, current) => {
			const o: any = {}
			keys.forEach((key) => {
				o[key] = current[key] + prev[key]
			})
			return o
		},
		{
			mongoWriteSmall: 0,
			mongoWriteBig: 0,
			mongoRead: 0,
			mongoIndexedRead: 0,
			cpuCalculations: 0,
			cpuStringifying: 0,
		}
	)
	const avg: SystemBenchmarkResults['results'] = {} as any
	keys.forEach((key) => {
		avg[key] = Math.floor(sum[key] / runCount)
	})
	// These numbers are the average performance of known systems
	const baseline = {
		mongoWriteSmall: 178,
		mongoWriteBig: 186,
		mongoRead: 120,
		mongoIndexedRead: 70,
		cpuStringifying: 110,
		cpuCalculations: 114,
	}

	const comparison: any = {}
	keys.forEach((key) => {
		comparison[key] = Math.floor((100 * avg[key]) / baseline[key])
	})

	return {
		description: `Benchmark results, averaged after ${runCount} runs:
MongoDB small writes:        ${avg.mongoWriteSmall} ms (${comparison.mongoWriteSmall}%)
MongoDB large writes:        ${avg.mongoWriteBig} ms (${comparison.mongoWriteBig}%)
MongoDB reads with no index: ${avg.mongoRead} ms (${comparison.mongoRead}%)
MongoDB reads with index:    ${avg.mongoIndexedRead} ms (${comparison.mongoIndexedRead}%)

CPU calculations:            ${avg.cpuCalculations} ms (${comparison.cpuCalculations}%)
CPU JSON stringifying:       ${avg.cpuStringifying} ms (${comparison.cpuStringifying}%)`,
		results: avg,
	}
}

async function getTranslationBundle(_context: MethodContext, bundleId: TranslationsBundleId) {
	check(bundleId, String)

	triggerWriteAccessBecauseNoCheckNecessary()

	return ClientAPI.responseSuccess(await getTranslationBundleInner(bundleId))
}

let lastTokenTimestamp: Time | undefined = undefined
const TOKEN_ISSUE_TIME_LIMIT = 1000 // ms

async function generateSingleUseToken() {
	triggerWriteAccessBecauseNoCheckNecessary()

	const eventTime = getCurrentTime()

	if (lastTokenTimestamp !== undefined && eventTime <= lastTokenTimestamp + TOKEN_ISSUE_TIME_LIMIT) {
		throw new Meteor.Error(503, `Tokens can only be issued every ${TOKEN_ISSUE_TIME_LIMIT / 1000}s.`)
	}

	lastTokenTimestamp = eventTime
	const newToken = generateToken()
	return ClientAPI.responseSuccess(newToken)
}

class SystemAPIClass extends MethodContextAPI implements SystemAPI {
	async cleanupIndexes(actuallyRemoveOldIndexes: boolean) {
		return cleanupIndexes(this, actuallyRemoveOldIndexes)
	}
	async cleanupOldData(actuallyRemoveOldData: boolean) {
		return cleanupOldData(this, actuallyRemoveOldData)
	}
	async runCronjob() {
		return runCronjob(this)
	}
	async doSystemBenchmark(runCount = 1) {
		return doSystemBenchmark(this, runCount)
	}
	async getTranslationBundle(bundleId: TranslationsBundleId): Promise<ClientAPI.ClientResponse<TranslationsBundle>> {
		return getTranslationBundle(this, bundleId)
	}
	async generateSingleUseToken(): Promise<ClientAPI.ClientResponse<string>> {
		return generateSingleUseToken()
	}
}
registerClassToMeteorMethods(SystemAPIMethods, SystemAPIClass, false)
