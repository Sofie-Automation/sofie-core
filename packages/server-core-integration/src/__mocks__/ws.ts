/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { EventEmitter } from 'events'
import * as EJSON from 'ejson'
import type { ClientMessage, ServerMessage } from '@sofie-automation/shared-lib/dist/ddp/messageTypes.js'
// import * as util from 'util'

const literal = <T>(t: T) => t

class MockWebSocket extends EventEmitter {
	private cachedId = ''
	private initialized = true

	constructor(url: string, _options?: { [name: string]: unknown }) {
		super()
		const isValidHost = url.includes('127.0.0.1')
		setTimeout(() => {
			if (isValidHost) {
				this.emit('open')
			} else {
				this.emit('error', new Error('Network error'))
				this.emit('close', 1006, Buffer.from('Network error'))
			}
		}, 1)
	}

	send(data: string): void {
		const message = EJSON.parse(data) as ClientMessage
		// console.log(util.inspect(message, { depth: 10 }))
		if (message.msg === 'connect') {
			this.emit(
				'message',
				EJSON.stringify(
					literal<ServerMessage>({
						msg: 'connected',
						session: 'wibble',
					})
				)
			)
			return
		}
		if (message.msg === 'method') {
			if (message.method === 'peripheralDevice.initialize') {
				this.initialized = true
				this.emit(
					'message',
					EJSON.stringify(
						literal<ServerMessage>({
							msg: 'result',
							id: message.id,
							result: message.params![0],
						})
					)
				)
				return
			}
			if (message.method === 'systemTime.getTimeDiff') {
				this.emit(
					'message',
					EJSON.stringify(
						literal<ServerMessage>({
							msg: 'result',
							id: message.id,
							result: { currentTime: Date.now() },
						})
					)
				)
				return
			}
			if (message.method === 'peripheralDevice.status') {
				if (this.initialized) {
					this.emit(
						'message',
						EJSON.stringify(
							literal<ServerMessage>({
								msg: 'result',
								id: message.id,
								result: {
									statusCode: (message.params![2] as any).statusCode,
								},
							})
						)
					)
					if ((message.params![2] as any).statusDetails?.[0]?.message?.indexOf('Jest ') >= 0) {
						this.emit(
							'message',
							EJSON.stringify(
								literal<ServerMessage>({
									msg: 'changed',
									collection: 'peripheralDeviceForDevice',
									id: 'JestTest',
								})
							)
						)
					}
				} else {
					this.emit(
						'message',
						EJSON.stringify(
							literal<ServerMessage>({
								msg: 'result',
								id: message.id,
								error: {
									error: 404,
									errorType: 'Meteor.Error',
								},
							})
						)
					)
				}
				return
			}
			if (message.method === 'peripheralDevice.testMethod') {
				this.emit(
					'message',
					EJSON.stringify(
						literal<ServerMessage>({
							msg: 'result',
							id: message.id,
							result: message.params![3] ? undefined : message.params![2],
							error: message.params![3]
								? {
										error: 418,
										reason: 'Bad Wolf error',
										errorType: 'Meteor.Error',
									}
								: undefined,
						})
					)
				)
				return
			}
			if (message.method === 'peripheralDevice.unInitialize') {
				this.initialized = false
				this.emit(
					'message',
					EJSON.stringify(
						literal<ServerMessage>({
							msg: 'result',
							id: message.id,
							result: message.params![0],
						})
					)
				)
				return
			}
			this.emit(
				'message',
				EJSON.stringify(
					literal<ServerMessage>({
						msg: 'result',
						id: message.id,
						error: {
							error: 404,
							reason: 'Where have you gone error',
							errorType: 'Meteor.Error',
						},
					})
				)
			)
			return
		}
		if (message.msg === 'sub') {
			this.cachedId = message.params![0] as any
			setTimeout(() => {
				this.emit(
					'message',
					EJSON.stringify(
						literal<ServerMessage>({
							msg: 'added',
							collection: message.name,
							id: this.cachedId,
						})
					)
				)
			}, 1)
			setTimeout(() => {
				this.emit(
					'message',
					EJSON.stringify(
						literal<ServerMessage>({
							msg: 'ready',
							subs: [message.id],
						})
					)
				)
			}, 100)
			return
		}
		if (message.msg === 'unsub') {
			this.emit(
				'message',
				JSON.stringify(
					literal<ServerMessage>({
						msg: 'removed',
						collection: 'peripheralDeviceForDevice',
						id: this.cachedId,
					})
				)
			)
			this.emit(
				'message',
				JSON.stringify(
					literal<ServerMessage>({
						msg: 'nosub',
						id: message.id,
					})
				)
			)
		}
	}
	close(): void {
		this.emit('close', 1200, Buffer.from('I had a great time!'))
	}
}

export default MockWebSocket
