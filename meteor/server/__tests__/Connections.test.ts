jest.mock('../api/integration/influx')

import { trackConnectionClose } from '../Connections'
import { PeripheralDevices } from '../collections'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { waitUntil } from '../../__mocks__/helpers/jest'

describe('Connections.trackConnectionClose', () => {
	beforeEach(async () => {
		await PeripheralDevices.removeAsync({})
	})

	test('marks the device and its parentDeviceId children offline for the closed connection', async () => {
		const parentId = protectString<PeripheralDeviceId>('parent1')
		const childId = protectString<PeripheralDeviceId>('child1')
		const otherId = protectString<PeripheralDeviceId>('other1')
		await PeripheralDevices.insertAsync({
			_id: parentId,
			connectionId: 'conn1',
			connected: true,
			lastSeen: 1,
		} as any)
		await PeripheralDevices.insertAsync({
			_id: childId,
			parentDeviceId: parentId,
			connected: true,
			lastSeen: 1,
		} as any)
		await PeripheralDevices.insertAsync({
			_id: otherId,
			connectionId: 'conn2',
			connected: true,
			lastSeen: 1,
		} as any)

		trackConnectionClose('conn1', '127.0.0.1')

		await waitUntil(async () => {
			expect((await PeripheralDevices.findOneAsync(parentId))?.connected).toBe(false)
			expect((await PeripheralDevices.findOneAsync(childId))?.connected).toBe(false)
		}, 1000)

		// A device on a different connection is untouched.
		expect((await PeripheralDevices.findOneAsync(otherId))?.connected).toBe(true)
	})

	test('does nothing when no connectionId is given', async () => {
		const id = protectString<PeripheralDeviceId>('d1')
		await PeripheralDevices.insertAsync({ _id: id, connectionId: 'conn1', connected: true, lastSeen: 1 } as any)

		trackConnectionClose('', '127.0.0.1')
		await new Promise((r) => setTimeout(r, 50)) // give any (incorrect) deferred work a chance to run

		expect((await PeripheralDevices.findOneAsync(id))?.connected).toBe(true)
	})
})
