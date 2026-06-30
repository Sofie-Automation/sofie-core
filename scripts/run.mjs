import process from "process";
import fs from "fs";
import path from "path";
import concurrently from "concurrently";
import { config } from "./lib.js";
import { startDevMongo, DEV_MONGO_VERSION } from "../meteor/scripts/dev-mongo.mjs";

// Defaults for the dev MongoDB we spawn. Overridable via env (typically a root .env file, loaded by
// the `dev` script with `node --env-file-if-exists=.env`).
const MONGO_DEFAULTS = {
	version: DEV_MONGO_VERSION, // shared with the jest integration replset (see dev-mongo.mjs)
	port: "3001", // a stable, predictable port so external tooling (Compass, mongosh) can connect
	dbName: "meteor", // matches Meteor's dev default database name
};

// The running dev MongoDB instance, so signal handlers can stop it gracefully. stop() is idempotent.
let activeMongo = null;

function joinCommand(...parts) {
	return parts.filter((part) => !!part).join(" ");
}

// Format a config value for logging, noting the default when it has been overridden via env.
function describeMongoValue(value, envVar, defaultValue) {
	return process.env[envVar] ? `${value} (overridden; default ${defaultValue})` : `${value} (default)`;
}

/**
 * Start the dev MongoDB (single-node replica set) and point MONGO_URL at it, so Meteor uses it instead
 * of spawning its own bundled mongod. If MONGO_URL is already set (e.g. via .env), use that external
 * server and don't spawn anything. Returns an object with an idempotent stop().
 */
async function startMongoIfNeeded() {
	if (process.env.MONGO_URL) {
		console.log(`MongoDB (dev): using external MONGO_URL, not spawning a local instance`);
		return { stop: async () => {} };
	}

	const version = process.env.MONGO_VERSION || MONGO_DEFAULTS.version;
	const port = parseInt(process.env.MONGO_PORT || MONGO_DEFAULTS.port, 10);
	const dbName = process.env.MONGO_DEV_DB || MONGO_DEFAULTS.dbName;
	const dbPath = path.resolve("meteor", ".meteor", "local", "db");

	console.log("MongoDB (dev):");
	console.log(`  version: ${describeMongoValue(version, "MONGO_VERSION", MONGO_DEFAULTS.version)}`);
	console.log(`  port:    ${describeMongoValue(String(port), "MONGO_PORT", MONGO_DEFAULTS.port)}`);
	console.log(`  db:      ${describeMongoValue(dbName, "MONGO_DEV_DB", MONGO_DEFAULTS.dbName)}`);
	console.log(`  path:    ${dbPath}`);
	console.log("  starting... (the first run downloads the mongod binary, which can take a moment)");

	const { uri, stop } = await startDevMongo({ dbPath, port, dbName, version });
	process.env.MONGO_URL = uri;
	console.log(`  ready at ${uri}`);

	let stopped = false;
	return {
		stop: async () => {
			if (stopped) return;
			stopped = true;
			await stop();
		},
	};
}

function watchPackages() {
	return [
		{
			command: 'yarn watch --preserveWatchOutput',
			cwd: "packages",
			name: "TSC",
			prefixColor: "red",
		},
	];
}

function watchWorker() {
	return [
		{
			command: "yarn watch-for-worker-changes",
			cwd: "packages",
			name: "WORKER-RESTART",
			prefixColor: "green",
		},
	];
}

function watchMeteor() {
	const settingsFileExists = fs.existsSync("meteor-settings.json");
	if (settingsFileExists) {
		console.log('Found meteor-settings.json')
	} else {
		console.log('No meteor-settings.json')
	}

	// If a ROOT_URL is defined, meteor will serve under that. We should use the same for vite, to get the correct proxying
	const rootUrl = process.env.ROOT_URL ? new URL(process.env.ROOT_URL) : null

	return [
		{
			command: joinCommand(
				'yarn debug',
				config.inspectMeteor ? " --inspect" : "",
				config.verbose ? " --verbose" : "",
				settingsFileExists ? " --settings ../meteor-settings.json" : ""
			),
			cwd: "meteor",
			name: "METEOR",
			prefixColor: "cyan",
			// Point Meteor at the MongoDB we spawned (see startMongoIfNeeded). With MONGO_URL set,
			// Meteor uses it instead of spawning its own bundled mongod.
			env: {
				MONGO_URL: process.env.MONGO_URL,
			},
		},
		{
			command: `yarn dev`,
			cwd: "packages/webui",
			name: "VITE",
			prefixColor: "yellow",
			env: {
				SOFIE_BASE_PATH: rootUrl && rootUrl.pathname.length > 1 ? rootUrl.pathname : '',
			},
		},
	];
}

function hr() {
	// write regular dashes if this is a "simple" output stream ()
	if (!process.stdout.hasColors || !process.stdout.hasColors())
		return "-".repeat(process.stdout.columns ?? 40);
	return "─".repeat(process.stdout.columns ?? 40);
}

function listDatabases() {
	const meteorLocalDir = path.join('meteor', '.meteor', 'local');
	const dbLink = path.join(meteorLocalDir, 'db');

	if (!fs.existsSync(meteorLocalDir)) {
		console.log('No databases found (meteor/.meteor/local does not exist yet)');
		return;
	}

	// Get current database
	let currentDb = null;
	if (fs.existsSync(dbLink)) {
		const stats = fs.lstatSync(dbLink);
		if (stats.isSymbolicLink()) {
			const target = fs.readlinkSync(dbLink);
			const match = target.match(/^db\.(.+)$/);
			if (match) {
				currentDb = match[1];
			}
		} else {
			currentDb = '(unnamed - real directory)';
		}
	}

	// List all db.* directories
	const files = fs.readdirSync(meteorLocalDir);
	const dbDirs = files
		.filter(file => file.startsWith('db.') && fs.lstatSync(path.join(meteorLocalDir, file)).isDirectory())
		.map(file => file.substring(3));

	console.log('\nAvailable databases:');
	if (dbDirs.length === 0) {
		console.log('  (none found)');
	} else {
		dbDirs.sort().forEach(db => {
			const marker = db === currentDb ? ' ← current' : '';
			console.log(`  ${db}${marker}`);
		});
	}

	if (currentDb && !dbDirs.includes(currentDb)) {
		console.log(`\nCurrent: ${currentDb}`);
	}
	console.log('');
}

function switchDatabase(dbName) {
	const meteorLocalDir = path.join('meteor', '.meteor', 'local');
	const dbLink = path.join(meteorLocalDir, 'db');
	const dbTarget = path.join(meteorLocalDir, `db.${dbName}`);

	// Check if we're already using this database
	if (fs.existsSync(dbLink)) {
		const stats = fs.lstatSync(dbLink);
		if (stats.isSymbolicLink()) {
			const currentTarget = fs.readlinkSync(dbLink);
			if (currentTarget === `db.${dbName}`) {
				console.log(`✓ Already using database: ${dbName}`);
				return;
			}
		}
	}

	// Create target directory if it doesn't exist
	if (!fs.existsSync(dbTarget)) {
		console.log(`Creating new database directory: ${dbName}`);
		fs.mkdirSync(dbTarget, { recursive: true });
	}

	// Remove existing db link/directory
	if (fs.existsSync(dbLink)) {
		const stats = fs.lstatSync(dbLink);
		if (stats.isSymbolicLink()) {
			fs.unlinkSync(dbLink);
		} else {
			// It's a real directory - back it up with timestamp
			const defaultDb = path.join(meteorLocalDir, 'db.default');
			if (!fs.existsSync(defaultDb)) {
				console.log(`Backing up existing database to: default`);
				fs.renameSync(dbLink, defaultDb);
			} else {
				// Default already exists, create timestamped backup instead of deleting
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
				let backupName = path.join(meteorLocalDir, `db.backup.${timestamp}`);
				// Ensure unique backup name
				let suffix = 0;
				while (fs.existsSync(backupName)) {
					suffix++;
					backupName = path.join(meteorLocalDir, `db.backup.${timestamp}.${suffix}`);
				}
				console.log(`Backing up existing database to: ${path.basename(backupName)}`);
				fs.renameSync(dbLink, backupName);
			}
		}
	}

	// Create symlink to target database
	fs.symlinkSync(`db.${dbName}`, dbLink);
	console.log(`✓ Switched to database: ${dbName}`);
}

try {
	// Note: This script assumes that install-and-build.mjs has been run before

	// List databases if requested
	if (config.dbList) {
		listDatabases();
		process.exit(0);
	}

	// Switch database if requested
	if (config.dbName) {
		switchDatabase(config.dbName);
	}

	// Start our own MongoDB (and set MONGO_URL) before launching anything that connects to it. This is
	// done before concurrently (which has no startup ordering) so Mongo is ready when Meteor connects.
	activeMongo = await startMongoIfNeeded();

	try {
		// The main watching execution
		console.log(hr());
		console.log(" ⚙️  Starting up in development mode...         ");
		console.log(hr());
		await concurrently(
			[
				...(config.uiOnly ? [] : watchPackages()),
				...(config.uiOnly ? [] : watchWorker()),
				...watchMeteor(),
			],
			{
				prefix: "name",
				killOthers: ["failure", "success"],
				restartTries: 0,
			}
		).result;
	} finally {
		await activeMongo.stop();
	}
} catch (e) {
	console.error(e.message);
	process.exit(1);
}

async function signalHandler(signal) {
	try {
		if (activeMongo) await activeMongo.stop();
	} catch {
		// best-effort shutdown; exit regardless
	}
	process.exit();
}

// Make sure to exit on interrupt
process.on("SIGINT", signalHandler);
process.on("SIGTERM", signalHandler);
process.on("SIGQUIT", signalHandler);
