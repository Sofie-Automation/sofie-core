import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { MeteorPubSub } from '../pubsub'
import { PeripheralDevicePubSub } from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'

describe('Pubsub', () => {
	it('Ensures that PubSub values are unique', () => {
		const values = new Set<string>()
		const runForEnum = (enumType: any) => {
			for (const key in enumType) {
				if (values.has(key))
					// Throw a meaningful error
					throw new Error(`Key "${key}" is already defined`)

				values.add(key)
			}
		}

		runForEnum(MeteorPubSub)
		runForEnum(CorelibPubSub)
		runForEnum(PeripheralDevicePubSub)

		expect(values.size).toBeGreaterThan(10)
	})
})
