import fs from 'fs'
import net from 'net'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient } from 'mongodb'

// Use the same replica-set name Meteor uses for its dev mongod, so the same data dir works on both this
// branch (our dev-mongo) and an older branch (Meteor's bundled mongod)
const REPLSET_NAME = 'meteor'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Throw a clear error if `port` is already in use, so a conflict fails loudly instead of
 * mongodb-memory-server silently falling back to a random port.
 */
function assertPortFree(port) {
	return new Promise((resolve, reject) => {
		const tester = net
			.createServer()
			.once('error', (err) => {
				if (err.code === 'EADDRINUSE') {
					reject(
						new Error(
							`MongoDB dev port ${port} is already in use. Free that port, or set MONGO_PORT in .env to a free one.`
						)
					)
				} else {
					reject(err)
				}
			})
			.once('listening', () => tester.close(() => resolve()))
			.listen(port, '127.0.0.1')
	})
}

/**
 * Bring up a single-node replica set on an already-running mongod (started with --replSet but NOT
 * initiated), and make it PRIMARY with the given `host`. Non-destructive to existing data:
 *
 *  - Fresh data dir (no config)            -> replSetInitiate with our host.
 *  - Existing config that lists our host   -> nothing; mongod becomes primary on its own.
 *  - Existing config with a stale host     -> replSetReconfig({force:true}) to our host.
 *
 * The stale-host case is normal: both our dev-mongo and Meteor's mongod reconfigure the member host to
 * their own port on startup. We do this via reconfig (not by clearing the config), which never
 * re-initiates the oplog and so never risks the data.
 */
async function ensureSingleNodePrimary(serverUri, host) {
	const client = new MongoClient(serverUri, { directConnection: true })
	await client.connect()
	try {
		const adb = client.db('admin')

		let state = 'ok'
		try {
			await adb.command({ replSetGetStatus: 1 })
		} catch (e) {
			if (e.code === 94)
				state = 'uninitialized' // NotYetInitialized
			else if (e.code === 93)
				state = 'notmember' // InvalidReplicaSetConfig (we're not in the stored config)
			else throw e
		}

		if (state === 'uninitialized') {
			await adb.command({ replSetInitiate: { _id: REPLSET_NAME, members: [{ _id: 0, host }] } })
		} else {
			const cfg = (await adb.command({ replSetGetConfig: 1 })).config
			const currentHost = cfg.members?.[0]?.host
			if (currentHost !== host || state === 'notmember') {
				cfg.members = [{ ...cfg.members[0], _id: 0, host }]
				cfg.version = (cfg.version || 0) + 1
				await adb.command({ replSetReconfig: cfg, force: true })
			}
		}

		const deadline = Date.now() + 30000
		for (;;) {
			const hello = await adb.command({ hello: 1 })
			if (hello.isWritablePrimary) break
			if (Date.now() > deadline) throw new Error('MongoDB did not become primary within 30s')
			await sleep(200)
		}
	} finally {
		await client.close().catch(() => {})
	}
}

/**
 * Spawn a local MongoDB for development using mongodb-memory-server.
 *
 * It runs as a single-node replica set (change streams - which the backend relies on - require a
 * replica set), and stores its data in `dbPath`. The data is persistent: stop() does not delete
 * `dbPath`, and bring-up never clears or re-initiates user data.
 *
 * @param {{ dbPath: string, port: number, dbName: string, version: string }} opts
 * @returns {Promise<{ uri: string, stop: () => Promise<void> }>}
 */
export async function startDevMongo({ dbPath, port, dbName, version }) {
	// Fail loudly on a port conflict rather than letting mongodb-memory-server pick a random port.
	await assertPortFree(port)

	// mongodb-memory-server expects the data directory to exist.
	fs.mkdirSync(dbPath, { recursive: true })

	// Start mongod as a replica-set member but WITHOUT mongodb-memory-server's auto-initiation.
	// We drive initiate/reconfig ourselves so we can adopt an existing data dir non-destructively.
	const server = await MongoMemoryServer.create({
		binary: { version },
		instance: { dbPath, port, storageEngine: 'wiredTiger', args: ['--replSet', REPLSET_NAME] },
	})

	try {
		// Assert the requested port BEFORE bringing up the replica set, and derive the member host from the
		// actual bound port - so a reconfig can never install a host that doesn't match this node.
		const actualPort = Number(new URL(server.getUri()).port)
		if (actualPort !== port) {
			throw new Error(`MongoDB started on unexpected port ${actualPort} (requested ${port}).`)
		}
		await ensureSingleNodePrimary(server.getUri(), `127.0.0.1:${actualPort}`)
	} catch (e) {
		await server.stop({ doCleanup: false }).catch(() => {})
		throw e
	}

	const uri = `mongodb://127.0.0.1:${port}/${dbName}?replicaSet=${REPLSET_NAME}`
	const stop = async () => {
		// doCleanup: false keeps the on-disk data dir so dev data persists between runs.
		await server.stop({ doCleanup: false })
	}

	return { uri, stop }
}
