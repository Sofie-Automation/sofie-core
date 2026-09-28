import process from "process";
import fs from "fs";
import path from "path";
import concurrently from "concurrently";
import { config } from "./lib.js";
import {
	startDevMongo,
	DEV_MONGO_VERSION,
} from "../packages/sofie-core/scripts/dev-mongo.mjs";

// Where all development-only data lives: the dev MongoDB, the fallback snapshot store and dev logs.
// Gitignored. The server is told about it through SOFIE_DEV_DATA_DIR.
const DEV_DATA_DIR = path.resolve(".dev-data");
const MONGO_DATA_DIR = path.join(DEV_DATA_DIR, "mongo");
// Where the dev MongoDB lived before the server moved into packages/. Only used to point people at their old data.
const LEGACY_MONGO_DATA_DIR = path.join("meteor", ".meteor", "local");
const SERVER_DIR = path.join("packages", "sofie-core");

// Defaults for the dev MongoDB we spawn. Overridable via env (typically a root .env file, loaded by
// the `dev` script with `node --env-file-if-exists=.env`).
const MONGO_DEFAULTS = {
	version: DEV_MONGO_VERSION, // shared with the jest integration replset (see dev-mongo.mjs)
	port: "3001", // a stable, predictable port so external tooling (Compass, mongosh) can connect
	dbName: "meteor", // the database name Meteor used, kept so existing dev databases keep working
};

// Address the dev server binds to, unless SOFIE_BIND_ADDRESS says otherwise. Loopback only, so a dev
// server is not reachable from the network. The server's own default is 0.0.0.0, for deployments.
const DEV_BIND_ADDRESS = "127.0.0.1";

// The running dev MongoDB instance, so signal handlers can stop it gracefully. stop() is idempotent.
let activeMongo = null;

function joinCommand(...parts) {
	return parts.filter((part) => !!part).join(" ");
}

// Format a config value for logging, noting the default when it has been overridden via env.
function describeMongoValue(value, envVar, defaultValue) {
	return process.env[envVar]
		? `${value} (overridden; default ${defaultValue})`
		: `${value} (default)`;
}

/**
 * Start the dev MongoDB (single-node replica set) and point MONGO_URL at it for the server. If MONGO_URL is already set (e.g. via .env), use that external
 * server and don't spawn anything. Returns an object with an idempotent stop().
 */
async function startMongoIfNeeded() {
	if (process.env.MONGO_URL) {
		console.log(
			`MongoDB (dev): using external MONGO_URL, not spawning a local instance`,
		);
		return { stop: async () => {} };
	}

	const version = process.env.MONGO_VERSION || MONGO_DEFAULTS.version;
	const port = parseInt(process.env.MONGO_PORT || MONGO_DEFAULTS.port, 10);
	const dbName = process.env.MONGO_DEV_DB || MONGO_DEFAULTS.dbName;
	const dbPath = path.join(MONGO_DATA_DIR, "db");

	console.log("MongoDB (dev):");
	console.log(
		`  version: ${describeMongoValue(version, "MONGO_VERSION", MONGO_DEFAULTS.version)}`,
	);
	console.log(
		`  port:    ${describeMongoValue(String(port), "MONGO_PORT", MONGO_DEFAULTS.port)}`,
	);
	console.log(
		`  db:      ${describeMongoValue(dbName, "MONGO_DEV_DB", MONGO_DEFAULTS.dbName)}`,
	);
	console.log(`  path:    ${dbPath}`);
	console.log(
		"  starting... (the first run downloads the mongod binary, which can take a moment)",
	);

	const { uri, stop } = await startDevMongo({
		dbPath,
		port,
		dbName,
		version,
		log: (message) => console.log(`  ${message}`),
	});
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
			command: "yarn watch --preserveWatchOutput",
			name: "TSC",
			prefixColor: "red",
		},
	];
}

function watchWorker() {
	return [
		{
			command: "yarn watch-for-worker-changes",
			name: "WORKER-RESTART",
			prefixColor: "green",
		},
	];
}

function watchServer() {
	const settingsFileExists = fs.existsSync("meteor-settings.json");
	if (settingsFileExists) {
		console.log("Found meteor-settings.json");
	} else {
		console.log("No meteor-settings.json");
	}

	// If a ROOT_URL is defined, the server will serve under that. We should use the same for vite, to get the correct proxying
	const rootUrl = process.env.ROOT_URL ? new URL(process.env.ROOT_URL) : null;

	return [
		{
			command: joinCommand(
				"yarn debug",
				config.inspectServer ? " --inspect" : "",
				config.verbose ? " --verbose" : "",
				settingsFileExists ? " --settings ../../meteor-settings.json" : "",
			),
			cwd: SERVER_DIR,
			name: "SERVER",
			prefixColor: "cyan",
			env: {
				// Point the server at the MongoDB we spawned (see startMongoIfNeeded)
				MONGO_URL: process.env.MONGO_URL,
				// Dev-only data (fallback snapshot store, dev logs) goes next to the dev database, not into the package
				SOFIE_DEV_DATA_DIR: DEV_DATA_DIR,
				SOFIE_BIND_ADDRESS: process.env.SOFIE_BIND_ADDRESS || DEV_BIND_ADDRESS,
				// Vite serves the webui itself in dev, but the server still serves some assets out of
				// the same directory (the logo route, and the locales for the web manifest).
				SOFIE_WEBUI_DIR: path.resolve("packages", "webui", "public"),
			},
		},
		{
			command: `yarn dev`,
			cwd: "packages/webui",
			name: "VITE",
			prefixColor: "yellow",
			env: {
				DEV_SOFIE_BASE_PATH:
					rootUrl && rootUrl.pathname.length > 1 ? rootUrl.pathname : "",
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
	const mongoDataDir = MONGO_DATA_DIR;
	const dbLink = path.join(mongoDataDir, "db");

	if (!fs.existsSync(mongoDataDir)) {
		console.log(`No databases found (${MONGO_DATA_DIR} does not exist yet)`);
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
			currentDb = "(unnamed - real directory)";
		}
	}

	// List all db.* directories
	const files = fs.readdirSync(mongoDataDir);
	const dbDirs = files
		.filter(
			(file) =>
				file.startsWith("db.") &&
				fs.lstatSync(path.join(mongoDataDir, file)).isDirectory(),
		)
		.map((file) => file.substring(3));

	console.log("\nAvailable databases:");
	if (dbDirs.length === 0) {
		console.log("  (none found)");
	} else {
		dbDirs.sort().forEach((db) => {
			const marker = db === currentDb ? " ← current" : "";
			console.log(`  ${db}${marker}`);
		});
	}

	if (currentDb && !dbDirs.includes(currentDb)) {
		console.log(`\nCurrent: ${currentDb}`);
	}
	console.log("");
}

function switchDatabase(dbName) {
	const mongoDataDir = MONGO_DATA_DIR;
	const dbLink = path.join(mongoDataDir, "db");
	const dbTarget = path.join(mongoDataDir, `db.${dbName}`);

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
			const defaultDb = path.join(mongoDataDir, "db.default");
			if (!fs.existsSync(defaultDb)) {
				console.log(`Backing up existing database to: default`);
				fs.renameSync(dbLink, defaultDb);
			} else {
				// Default already exists, create timestamped backup instead of deleting
				const timestamp = new Date()
					.toISOString()
					.replace(/[:.]/g, "-")
					.substring(0, 19);
				let backupName = path.join(mongoDataDir, `db.backup.${timestamp}`);
				// Ensure unique backup name
				let suffix = 0;
				while (fs.existsSync(backupName)) {
					suffix++;
					backupName = path.join(
						mongoDataDir,
						`db.backup.${timestamp}.${suffix}`,
					);
				}
				console.log(
					`Backing up existing database to: ${path.basename(backupName)}`,
				);
				fs.renameSync(dbLink, backupName);
			}
		}
	}

	// Create symlink to target database
	fs.symlinkSync(`db.${dbName}`, dbLink);
	console.log(`✓ Switched to database: ${dbName}`);
}

/**
 * The dev MongoDB used to live in meteor/.meteor/local. If that is still around and nothing has been created in the
 * new location yet, tell the developer how to bring their data along. Nothing is moved automatically.
 */
function warnAboutLegacyDevData() {
	if (!fs.existsSync(LEGACY_MONGO_DATA_DIR) || fs.existsSync(MONGO_DATA_DIR)) return;

	console.log(hr());
	console.log(` ⚠️  Found a dev database from before the server moved into ${SERVER_DIR}: ${LEGACY_MONGO_DATA_DIR}`);
	console.log(`    The dev database now lives in ${MONGO_DATA_DIR}. To keep your data, stop this and run:`);
	console.log(`      mkdir -p ${MONGO_DATA_DIR} && mv ${path.join(LEGACY_MONGO_DATA_DIR, "db")}* ${MONGO_DATA_DIR}/`);
	console.log(`    Otherwise a fresh database will be created and the old directory can be deleted.`);
	console.log(hr());
}

try {
	// Note: This script assumes that install-and-build.mjs has been run before

	warnAboutLegacyDevData();

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
	// done before concurrently (which has no startup ordering) so Mongo is ready when the server connects.
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
				...watchServer(),
			],
			{
				prefix: "name",
				killOthers: ["failure", "success"],
				restartTries: 0,
			},
		).result;
	} finally {
		await activeMongo.stop();
	}
} catch (e) {
	// Errors flagged as `explained` already say what went wrong and what to do about it, so print just the
	// messages. Anything else gets the full stack and `cause` chain: an unannotated message on its own is
	// often a bare driver/tooling error (eg "connection 1 to 127.0.0.1:3003 closed") that says nothing
	// about which step failed.
	if (e?.explained) {
		console.error(`Error: ${e.message}`);
		for (let cause = e.cause; cause; cause = cause.cause) {
			console.error(`  caused by: ${cause.message ?? cause}`);
		}
	} else {
		console.error(e?.stack ?? e);
		for (let cause = e?.cause; cause; cause = cause.cause) {
			console.error("Caused by:", cause?.stack ?? cause);
		}
	}
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
