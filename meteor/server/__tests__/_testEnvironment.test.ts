import { RandomMock } from '../../__mocks__/random'
import { MongoMock } from '../../__mocks__/mongo'
import { protectString, getRandomString } from '../lib/tempLib'
import { sleep } from '../lib/lib'
import {
	AdLibPieces,
	Blueprints,
	CoreSystem,
	Evaluations,
	ExternalMessageQueue,
	NrcsIngestDataCache,
	MediaObjects,
	Parts,
	PeripheralDeviceCommands,
	PeripheralDevices,
	Pieces,
	RundownBaselineAdLibPieces,
	RundownBaselineObjs,
	Rundowns,
	Segments,
	ShowStyleBases,
	ShowStyleVariants,
	Snapshots,
	Studios,
	Timeline,
	UserActionsLog,
} from '../collections'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { Mongo } from 'meteor/mongo'
import { defaultStudio } from '../../__mocks__/defaultCollectionObjects'
import { MinimalMeteorMongoCollection } from '../collections/implementations/asyncCollection'

describe('Basic test of test environment', () => {
	test('Meteor Random mock', () => {
		RandomMock.mockIds = ['superRandom']
		expect(tempTestRandom()).toEqual('superRandom')
	})
	test('Verify Mock collections', () => {
		// @ts-ignore
		expect(AdLibPieces._isMock).toBeTruthy()
		// @ts-ignore
		expect(Blueprints._isMock).toBeTruthy()
		// @ts-ignore
		expect(CoreSystem._isMock).toBeTruthy()
		// @ts-ignore
		expect(Evaluations._isMock).toBeTruthy()
		// @ts-ignore
		expect(ExternalMessageQueue._isMock).toBeTruthy()
		// @ts-ignore
		expect(NrcsIngestDataCache._isMock).toBeTruthy()
		// @ts-ignore
		expect(MediaObjects._isMock).toBeTruthy()
		// @ts-ignore
		expect(Parts._isMock).toBeTruthy()
		// @ts-ignore
		expect(PeripheralDeviceCommands._isMock).toBeTruthy()
		// @ts-ignore
		expect(PeripheralDevices._isMock).toBeTruthy()
		// @ts-ignore
		expect(Pieces._isMock).toBeTruthy()
		// @ts-ignore
		expect(RundownBaselineAdLibPieces._isMock).toBeTruthy()
		// @ts-ignore
		expect(RundownBaselineObjs._isMock).toBeTruthy()
		// @ts-ignore
		expect(Rundowns._isMock).toBeTruthy()
		// @ts-ignore
		expect(Segments._isMock).toBeTruthy()
		// @ts-ignore
		expect(ShowStyleBases._isMock).toBeTruthy()
		// @ts-ignore
		expect(ShowStyleVariants._isMock).toBeTruthy()
		// @ts-ignore
		expect(Snapshots._isMock).toBeTruthy()
		// @ts-ignore
		expect(Studios._isMock).toBeTruthy()
		// @ts-ignore
		expect(Timeline._isMock).toBeTruthy()
		// @ts-ignore
		expect(UserActionsLog._isMock).toBeTruthy()
	})
	test('Mock collection data', async () => {
		expect(await Studios.findFetchAsync({})).toHaveLength(0)

		MongoMock.mockSetData<DBStudio>(Studios, [
			{
				...defaultStudio(protectString('abc')),
				name: 'abc',
				_rundownVersionHash: 'abc',
			},
			{
				...defaultStudio(protectString('def')),
				name: 'def',
				_rundownVersionHash: 'def',
			},
		])

		expect(await Studios.findFetchAsync({})).toHaveLength(2)

		expect(
			await Studios.findOneAsync({
				_id: protectString('def'),
			})
		).toMatchObject({
			_id: 'def',
		})
		await Studios.updateAsync(protectString('abc'), {
			$set: {
				_rundownVersionHash: 'myHash',
			},
		})

		expect(
			await Studios.findOneAsync({
				name: 'abc',
			})
		).toMatchObject({
			_rundownVersionHash: 'myHash',
		})

		await Studios.removeAsync(protectString('def'))
		const studios = await Studios.findFetchAsync({})
		expect(studios).toHaveLength(1)

		const observer = await Studios.observeChanges({ _id: protectString('abc') }, {})
		expect(observer).toBeTruthy()

		await Studios.insertAsync({
			...defaultStudio(protectString('xyz')),
			name: 'xyz',
			_rundownVersionHash: 'xyz',
		})
		expect(await Studios.findFetchAsync({})).toHaveLength(2)

		observer.stop()

		MongoMock.mockSetData(Studios, null)
		expect(await Studios.findFetchAsync({})).toHaveLength(0)
	})
	test('Mongo mock', async () => {
		const mockAdded = jest.fn()
		const mockChanged = jest.fn()
		const mockRemoved = jest.fn()

		const collection = new Mongo.Collection<any>('testmock') as any as MinimalMeteorMongoCollection<any>

		await collection
			.find({
				prop: 'b',
			})
			.observeChangesAsync({
				added: mockAdded,
				changed: mockChanged,
				removed: mockRemoved,
			})

		expect(await collection.find({}).fetchAsync()).toHaveLength(0)

		const id = await collection.insertAsync({ prop: 'a' })
		expect(id).toBeTruthy()
		expect(await collection.find({}).fetchAsync()).toHaveLength(1)
		// expect(collection.findOne(id)).toMatchObject({
		// 	prop: 'a',
		// })
		expect(await collection.removeAsync(id)).toEqual(1)
		expect(await collection.find({}).fetchAsync()).toHaveLength(0)

		expect(mockAdded).toHaveBeenCalledTimes(0)
		expect(mockChanged).toHaveBeenCalledTimes(0)
		expect(mockRemoved).toHaveBeenCalledTimes(0)

		const id2 = await collection.insertAsync({ prop: 'b' })
		await sleep(10)
		expect(mockAdded).toHaveBeenCalledTimes(1)
		expect(mockChanged).toHaveBeenCalledTimes(0)
		expect(mockRemoved).toHaveBeenCalledTimes(0)
		mockAdded.mockClear()

		await collection.updateAsync(id2, { $set: { name: 'test' } })
		await sleep(10)
		expect(mockAdded).toHaveBeenCalledTimes(0)
		expect(mockChanged).toHaveBeenCalledTimes(1)
		expect(mockRemoved).toHaveBeenCalledTimes(0)
		mockChanged.mockClear()

		await collection.removeAsync(id2)
		await sleep(10)
		expect(mockAdded).toHaveBeenCalledTimes(0)
		expect(mockChanged).toHaveBeenCalledTimes(0)
		expect(mockRemoved).toHaveBeenCalledTimes(1)
	})
})

function tempTestRandom() {
	return getRandomString()
}
