/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { EventEmitter } from 'events'
import { AnyMessage } from '../lib/ddpClient.js'
import * as EJSON from 'ejson'
// import * as util from 'util'

const literal = <T>(t: T) => t

export class Client extends EventEmitter {
	private cachedId = ''
	private initialized = true

	constructor(_url: string, _protcols?: Array<string> | null, _options?: { [name: string]: unknown }) {
		super()
		setTimeout(() => {
			this.emit('open')
		}, 1)
	}

	send(data: string): void {
		const message = EJSON.parse(data) as AnyMessage
		// console.log(util.inspect(message, { depth: 10 }))
		if (message.msg === 'connect') {
			this.emit('message', {
				data: EJSON.stringify(
					literal<AnyMessage>({
						msg: 'connected',
						session: 'wibble',
					})
				),
			})
			return
		}
		if (message.msg === 'method') {
			if (message.method === 'peripheralDevice.initialize') {
				this.initialized = true
				this.emit('message', {
					data: EJSON.stringify(
						literal<AnyMessage>({
							msg: 'result',
							id: message.id,
							result: message.params![0],
						})
					),
				})
				return
			}
			if (message.method === 'systemTime.getTimeDiff') {
				this.emit('message', {
					data: EJSON.stringify(
						literal<AnyMessage>({
							msg: 'result',
							id: message.id,
							result: { currentTime: Date.now() },
						})
					),
				})
				return
			}
			if (message.method === 'peripheralDevice.status') {
				if (this.initialized) {
					this.emit('message', {
						data: EJSON.stringify(
							literal<AnyMessage>({
								msg: 'result',
								id: message.id,
								result: {
									statusCode: (message.params![2] as any).statusCode,
								},
							})
						),
					})
					if ((message.params![2] as any).messages[0].indexOf('Jest ') >= 0) {
						this.emit('message', {
							data: EJSON.stringify(
								literal<AnyMessage>({
									msg: 'changed',
									collection: 'peripheralDeviceForDevice',
									id: 'JestTest',
								})
							),
						})
					}
				} else {
					this.emit('message', {
						data: EJSON.stringify(
							literal<AnyMessage>({
								msg: 'result',
								id: message.id,
								error: {
									error: 404,
									errorType: 'Meteor.Error',
								},
							})
						),
					})
				}
				return
			}
			if (message.method === 'peripheralDevice.testMethod') {
				this.emit('message', {
					data: EJSON.stringify(
						literal<AnyMessage>({
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
					),
				})
				return
			}
			if (message.method === 'peripheralDevice.unInitialize') {
				this.initialized = false
				this.emit('message', {
					data: EJSON.stringify(
						literal<AnyMessage>({
							msg: 'result',
							id: message.id,
							result: message.params![0],
						})
					),
				})
				return
			}
			this.emit('message', {
				data: EJSON.stringify(
					literal<AnyMessage>({
						msg: 'result',
						id: message.id,
						error: {
							error: 404,
							reason: 'Where have you gone error',
							errorType: 'Meteor.Error',
						},
					})
				),
			})
			return
		}
		if (message.msg === 'sub') {
			this.cachedId = message.params![0] as any
			setTimeout(() => {
				this.emit('message', {
					data: EJSON.stringify(
						literal<AnyMessage>({
							msg: 'added',
							collection: message.name,
							id: this.cachedId,
						})
					),
				})
			}, 1)
			setTimeout(() => {
				this.emit('message', {
					data: EJSON.stringify(
						literal<AnyMessage>({
							msg: 'ready',
							subs: [message.id],
						})
					),
				})
			}, 100)
			return
		}
		if (message.msg === 'unsub') {
			this.emit('message', {
				data: JSON.stringify(
					literal<AnyMessage>({
						msg: 'removed',
						collection: 'peripheralDeviceForDevice',
						id: this.cachedId,
					})
				),
			})
			this.emit('message', {
				data: JSON.stringify(
					literal<AnyMessage>({
						msg: 'nosub',
						id: message.id,
					})
				),
			})
		}
	}
	close(): void {
		this.emit('close', {
			code: 200,
			reason: 'I had a great time!',
			wasClean: true,
		})
	}
}
