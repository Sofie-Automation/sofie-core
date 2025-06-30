import { Meteor } from 'meteor/meteor'
import { AllMeteorMethods, suppressExtraErrorLogging } from '../methods'
import { disableChecks, enableChecks as restoreChecks } from '../lib/check'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

/** These function are used to verify that all methods defined are using security functions */

let writeAccess = false
let writeAccessTest = false
export function testWriteAccess(): void {
	writeAccessTest = true
}
export function isInTestWrite(): boolean {
	return writeAccessTest
}
/** Called inside access control function, to indicate that a check was made */
export function triggerWriteAccess(): void {
	if (writeAccessTest) {
		writeAccess = true
		throw new Meteor.Error(200, 'triggerWriteAccess') // to be ignored in verifyMethod
	}
}
export function verifyWriteAccess(): string {
	if (!writeAccessTest) {
		return 'writeAccessTest not set!'
	}
	writeAccessTest = false
	if (!writeAccess) {
		return 'triggerWriteAccess() not called'
	}
	writeAccess = false
	return ''
}
/** Used in methods that needs no access control */
export function triggerWriteAccessBecauseNoCheckNecessary(): void {
	triggerWriteAccess()
}

Meteor.startup(() => {
	if (!Meteor.isProduction && !Meteor.isTest) {
		Meteor.setTimeout(() => {
			console.log('Security check: Verifying methods...')
			verifyAllMethods()
				// .then(() => {
				// })
				.then((ok) => {
					if (ok) {
						console.log('Security check: ok!')
					} else {
						console.log('There are security issues that needs fixing, see above!')
					}
				})
				.catch((e) => {
					console.log('Error')
					console.log(e)
				})
		}, 1000)
	}
})

export async function verifyAllMethods(): Promise<boolean> {
	// Verify all Meteor methods
	let ok = true
	for (const methodName of AllMeteorMethods) {
		ok = ok && (await verifyMethod(methodName))

		if (!ok) return false // Bail on first error

		// waitTime(100)
	}
	return ok
}
async function verifyMethod(methodName: string) {
	let ok = true
	suppressExtraErrorLogging(true)
	try {
		disableChecks()
		testWriteAccess()
		// Pass some fake args, to ensure that any trying to do a `arg.val` don't throw
		const fakeArgs = [{}, {}, {}, {}, {}]
		await Meteor.callAsync(methodName, ...fakeArgs)
	} catch (e) {
		const errStr = stringifyError(e)
		if (errStr.match(/triggerWriteAccess/i)) {
			// silently ignore this one
		} else {
			console.log(`Unknown error when testing method "${methodName}"`, e)
			ok = false
		}
	}
	suppressExtraErrorLogging(false)
	restoreChecks()
	const verifyError = verifyWriteAccess()
	if (ok && verifyError) {
		console.log(`Error when testing method "${methodName}"`, verifyError)
		ok = false
	} else {
		// ok
	}
	return ok
}
