/*
This script is used to do manual tests of the logging.
It intended to be copied to various places in the code.

For a thorough test, it should be run:

* In the Client
* In the Server
* In a worker (/ threads)

* Both when running in production-mode and not

*/

import { Meteor } from 'meteor/meteor'
import { logger } from './logging'
import { EventEmitter } from 'events'
import { SofieError } from '@sofie-automation/corelib/dist/error'

/* eslint @typescript-eslint/no-floating-promises: 0 */
/* eslint @typescript-eslint/no-unused-vars: 0 */
Meteor.startup(() => {
	// Test logging

	console.log('============================================================')
	console.log('=======================  Testing logging  ==================')
	console.log('============================================================')

	logger.error('Here comes an error:', new Error('This is an error'))
	logger.error(new Error('Single error'))

	logger.error('Here comes a Meteor.error:', new SofieError(500, 'This is an error'))
	logger.error(new SofieError(500, 'Single error'))

	logger.error('Here comes an object', { a: 1, b: { c: 2 } })
	logger.error({ a: 1, b: { c: 2 } })

	const recursiveObject = { a: { b: {} } }
	recursiveObject['a']['b'] = { recursive: recursiveObject }

	logger.info('Here is a recursive object', recursiveObject)
	logger.info(recursiveObject)

	// Test uncaught errors:

	// Uncaught promises:
	new Promise((_resolve, reject) => {
		reject('Rejecting with string')
	})
	new Promise((_resolve, reject) => {
		reject(new Error('Rejecting with error'))
	})

	// Uncaught error event:
	const a = new MyClass('Emitted a string')
	const b = new MyClass(new Error('Emitted an error'))
	const c = new MyClass(new SofieError(500, 'Emitted a Meteor.error'))

	setTimeout(() => {
		console.log('============================================================')
		console.log('=======================  End testing  ======================')
		console.log('============================================================')
	}, 1)
})
class MyClass extends EventEmitter {
	constructor(theThingToEmit: any) {
		super()
		setTimeout(() => {
			this.emit('error', theThingToEmit)
		}, 1)
	}
}
