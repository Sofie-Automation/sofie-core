import { toWebsocketUrl } from './urls.js'

import { StreamClientCommon } from './common.js'

export class ClientStream extends StreamClientCommon {
	// @param url {String} URL to Meteor app
	//   "http://subdomain.meteor.com/" or "/" or
	//   "ddp+sockjs://foo-**.meteor.com/sockjs"
	constructor(url, options) {
		super(options)

		this._initCommon(this.options)

		//// Constants

		// how long between hearing heartbeat from the server until we declare
		// the connection dead. heartbeats come every 45s (stream_server.js)
		//
		// NOTE: this is a older timeout mechanism. We now send heartbeats at
		// the DDP level (https://github.com/meteor/meteor/pull/1865), and
		// expect those timeouts to kill a non-responsive connection before
		// this timeout fires. This is kept around for compatibility (when
		// talking to a server that doesn't support DDP heartbeats) and can be
		// removed later.
		this.HEARTBEAT_TIMEOUT = 100 * 1000

		this.rawUrl = url
		this.socket = null
		this.lastError = null

		this.heartbeatTimer = null

		// Listen to global 'online' event if we are running in a browser.
		window.addEventListener('online', this._online.bind(this), false /* useCapture */)

		//// Kickoff!
		this._launchConnection()
	}

	// data is a utf8 string. Data sent while not connected is dropped on
	// the floor, and it is up the user of this API to retransmit lost
	// messages on 'reset'
	send(data) {
		if (this.currentStatus.connected) {
			this.socket.send(data)
		}
	}

	// Changes where this connection points
	_changeUrl(url) {
		this.rawUrl = url
	}

	_connected() {
		if (this.connectionTimer) {
			clearTimeout(this.connectionTimer)
			this.connectionTimer = null
		}

		if (this.currentStatus.connected) {
			// already connected. do nothing. this probably shouldn't happen.
			return
		}

		// update status
		this.currentStatus.status = 'connected'
		this.currentStatus.connected = true
		this.currentStatus.retryCount = 0
		this.statusChanged()

		// fire resets. This must come after status change so that clients
		// can call send from within a reset callback.
		this.forEachCallback('reset', (callback) => {
			callback()
		})
	}

	_cleanup(maybeError) {
		this._clearConnectionAndHeartbeatTimers()
		if (this.socket) {
			this.socket.onmessage = this.socket.onclose = this.socket.onerror = this.socket.onheartbeat = () => {}
			this.socket.close()
			this.socket = null
		}

		this.forEachCallback('disconnect', (callback) => {
			callback(maybeError)
		})
	}

	_clearConnectionAndHeartbeatTimers() {
		if (this.connectionTimer) {
			clearTimeout(this.connectionTimer)
			this.connectionTimer = null
		}
		if (this.heartbeatTimer) {
			clearTimeout(this.heartbeatTimer)
			this.heartbeatTimer = null
		}
	}

	_heartbeat_timeout() {
		console.log('Connection timeout. No sockjs heartbeat received.')
		this._lostConnection(new this.ConnectionError('Heartbeat timed out'))
	}

	_heartbeat_received() {
		// If we've already permanently shut down this stream, the timeout is
		// already cleared, and we don't need to set it again.
		if (this._forcedToDisconnect) return
		if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer)
		this.heartbeatTimer = setTimeout(this._heartbeat_timeout.bind(this), this.HEARTBEAT_TIMEOUT)
	}

	_launchConnection() {
		this._cleanup() // cleanup the old socket, if there was one.

		this.socket = new WebSocket(toWebsocketUrl(this.rawUrl))

		this.socket.onopen = (data) => {
			this.lastError = null
			this._connected()
		}

		this.socket.onmessage = (data) => {
			this.lastError = null
			this._heartbeat_received()
			if (this.currentStatus.connected) {
				this.forEachCallback('message', (callback) => {
					callback(data.data)
				})
			}
		}

		this.socket.onclose = () => {
			this._lostConnection()
		}

		this.socket.onerror = (error) => {
			const { lastError } = this
			this.lastError = error
			if (lastError) return
			console.error('stream error', error, new Date().toDateString())
		}

		this.socket.onheartbeat = () => {
			this.lastError = null
			this._heartbeat_received()
		}

		if (this.connectionTimer) clearTimeout(this.connectionTimer)
		this.connectionTimer = setTimeout(() => {
			this._lostConnection(new this.ConnectionError('DDP connection timed out'))
		}, this.CONNECT_TIMEOUT)
	}
}
