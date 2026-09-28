import fs from 'fs'
import net from 'net'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient } from 'mongodb'

// Use the same replica-set name Meteor uses for its dev mongod, so the same data dir works on both this
// branch (our dev-mongo) and an older branch (Meteor's bundled mongod)
const REPLSET_NAME = 'meteor'

/**
 * The mongod version we run everywhere: the dev instance (scripts/run.mjs) and the jest integration
 */
export const DEV_MONGO_VERSION = '7.0.16'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * How long to keep retrying the replica-set bring-up before giving up.
 *
 * This is generous because a stale stored config makes mongod unresponsive for a while at startup: when the
 * config on disk lists a host that isn't us (e.g. it was written by a run on a different port), mongod tries
 * to contact that host to work out whether it is itself. If nothing is listening there that fails instantly,
 * but if something unrelated has taken the port (a port-forwarding tool, an IDE, a proxy) the connection is
 * accepted and never answered, and mongod blocks on it for its full 30s socket timeout - during which it
 * answers no commands at all, so the driver drops our connection.
 */
const BRINGUP_TIMEOUT_MS = 120000

/**
 * An error whose message already says everything the developer needs, so callers can print it without a
 * stack trace (see the error handling in `scripts/run.mjs`).
 */
function explainedError(message, cause) {
	return Object.assign(new Error(message, cause ? { cause } : undefined), { explained: true })
}

/** Errors caused by mongod not answering (yet), as opposed to a command genuinely failing. */
function isTransientConnectionError(e) {
	return (
		e?.name === 'MongoNetworkError' ||
		e?.name === 'MongoServerSelectionError' ||
		e?.name === 'MongoNotConnectedError' ||
		e?.name === 'MongoTopologyClosedError' ||
		e?.code === 'ECONNREFUSED' ||
		e?.code === 'ECONNRESET'
	)
}

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
						explainedError(
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
async function ensureSingleNodePrimary(serverUri, host, log) {
	// A short server-selection timeout so an unresponsive mongod surfaces as a retryable error quickly,
	// instead of the driver sitting on it for its 30s default.
	const client = new MongoClient(serverUri, { directConnection: true, serverSelectionTimeoutMS: 5000 })
	await client.connect()
	try {
		const adb = client.db('admin')

		await withRetries(log, 'configuring the replica set', () => configureReplSet(adb, host, log))

		log('waiting for it to become primary')
		const deadline = Date.now() + BRINGUP_TIMEOUT_MS
		for (;;) {
			const hello = await withRetries(log, 'waiting for a primary', () => adb.command({ hello: 1 }))
			if (hello.isWritablePrimary) break
			if (Date.now() > deadline) throw new Error(`MongoDB did not become primary within ${BRINGUP_TIMEOUT_MS / 1000}s`)
			await sleep(200)
		}
	} finally {
		await client.close().catch(() => {})
	}
}

/**
 * One attempt at making the stored config name us as its sole member. Idempotent, so it is safe for
 * {@link withRetries} to run it again from the top.
 */
async function configureReplSet(adb, host, log) {
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
		try {
			await adb.command({ replSetInitiate: { _id: REPLSET_NAME, members: [{ _id: 0, host }] } })
			log(`initialised a new replica set on ${host}`)
			return
		} catch (e) {
			if (e.code !== 23) throw e // AlreadyInitialized
			// mongod reported NotYetInitialized above only because it hadn't finished loading the stored
			// config yet (it blocks on that while checking whether a stale member host is itself). There IS
			// existing data here, so start over and take the reconfig path rather than re-initiating it.
			throw Object.assign(new Error('replica set was already initialised'), { retryable: true })
		}
	}

	const cfg = (await adb.command({ replSetGetConfig: 1 })).config
	const currentHost = cfg.members?.[0]?.host
	if (currentHost !== host || state === 'notmember') {
		log(`stored replica set config points at ${currentHost}, reconfiguring it to ${host}`)
		cfg.members = [{ ...cfg.members[0], _id: 0, host }]
		cfg.version = (cfg.version || 0) + 1
		await adb.command({ replSetReconfig: cfg, force: true })
	}
}

/**
 * Run `fn`, retrying while mongod is merely unresponsive (see {@link BRINGUP_TIMEOUT_MS}), and annotating the
 * error with what we were doing if it ultimately fails - the raw driver error ("connection 1 to 127.0.0.1:3003
 * closed") says nothing about which step gave up.
 */
async function withRetries(log, what, fn) {
	const deadline = Date.now() + BRINGUP_TIMEOUT_MS
	let warned = false
	for (;;) {
		try {
			return await fn()
		} catch (e) {
			const transient = isTransientConnectionError(e)
			if ((!transient && !e.retryable) || Date.now() > deadline) {
				throw explainedError(`MongoDB failed while ${what}: ${e.message}`, e)
			}
			if (!warned) {
				warned = true
				log(`retrying while ${what}: ${e.message}`)
				if (transient) log('  (mongod stalls for ~30s at startup if a stale replica set host is unreachable)')
			}
			await sleep(500)
		}
	}
}

/**
 * Spawn a local MongoDB for development using mongodb-memory-server.
 *
 * It runs as a single-node replica set (change streams - which the backend relies on - require a
 * replica set), and stores its data in `dbPath`. The data is persistent: stop() does not delete
 * `dbPath`, and bring-up never clears or re-initiates user data.
 *
 * @param {{ dbPath: string, port: number, dbName: string, version: string, log?: (message: string) => void }} opts
 * @returns {Promise<{ uri: string, stop: () => Promise<void> }>}
 */
export async function startDevMongo({ dbPath, port, dbName, version, log = () => {} }) {
	// Fail loudly on a port conflict rather than letting mongodb-memory-server pick a random port.
	await assertPortFree(port)

	// mongodb-memory-server expects the data directory to exist.
	fs.mkdirSync(dbPath, { recursive: true })

	// Start mongod as a replica-set member but WITHOUT mongodb-memory-server's auto-initiation.
	// We drive initiate/reconfig ourselves so we can adopt an existing data dir non-destructively.
	log('launching mongod')
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
		await ensureSingleNodePrimary(server.getUri(), `127.0.0.1:${actualPort}`, log)
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
