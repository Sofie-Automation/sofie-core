/**
 * Jest globalTeardown for the `integration` project: stop the shared MongoDB replica set started in
 * {@link file://./integration-global-setup.js}.
 */
module.exports = async () => {
	const replSet = globalThis.__MONGO_REPLSET__
	if (replSet) {
		await replSet.stop()
		globalThis.__MONGO_REPLSET__ = undefined
	}
}
