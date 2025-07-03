import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { Meteor } from 'meteor/meteor'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import _ from 'underscore'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'

// Include this file in to get access to the extended functions

expect.extend({
	toBeWithinRange(received, floor, ceiling) {
		const pass = received >= floor && received <= ceiling
		return {
			message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
			pass: pass,
		}
	},
	toBeFuzzy(received, target, fuzzyness) {
		const pass = received >= target - fuzzyness && received <= target + fuzzyness
		return {
			message: () => `expected ${received} to be within ${fuzzyness} to ${target}`,
			pass: pass,
		}
	},
	toThrowMeteor(received, error, ...args) {
		const expected = new Meteor.Error(error, ...args)
		const pass = expected.toString() === received.toString()
		return {
			message: () => `expected ${received} to be ${expected}`,
			pass: pass,
		}
	},
	toMatchToString(received, regexp) {
		const pass = !!received.toString().match(regexp)
		return {
			message: () => `expected ${received} to match ${regexp}`,
			pass: pass,
		}
	},
	toMatchUserError(received, msg, args) {
		if (ClientAPI.isClientResponseError(received)) {
			received = received.error
		}

		if (received instanceof UserError) {
			const expected = UserError.create(msg, args)
			const received2 = clone(received)

			// @ts-expect-error delee for test pretty printing
			delete received2.rawError
			// @ts-expect-error delee for test pretty printing
			delete expected.rawError

			const pass = _.isEqual(received2, expected)
			return {
				message: () => `expected ${UserError.toJSON(received2)} to match ${UserError.toJSON(expected)}`,
				pass: pass,
			}
		} else {
			return {
				message: () => `expected ${stringifyError(received)} to be a UserError`,
				pass: false,
			}
		}
	},
	toMatchUserRawError(received, regexp) {
		if (ClientAPI.isClientResponseError(received)) {
			received = received.error
		}

		if (UserError.isSerializedUserErrorObject(received)) {
			received = UserError.fromUnknown(received)
			const pass = !!received.toString().match(regexp)
			return {
				message: () => `expected ${stringifyError(received)} to match ${regexp}`,
				pass: pass,
			}
		} else {
			return {
				message: () => `expected ${stringifyError(received)} to be a UserError`,
				pass: false,
			}
		}
	},
})
declare global {
	namespace jest {
		interface Matchers<R> {
			toBeWithinRange(floor: number, ceiling: number): R
			toBeFuzzy(target: number, fuzzyness: number): R

			toThrowMeteor(...args: ConstructorParameters<typeof Meteor.Error>): R
			toMatchToString(reg: RegExp): R
			toMatchUserError(msg: UserErrorMessage, args?: { [key: string]: any }): R
			toMatchUserRawError(reg: RegExp): R
		}
	}
}
