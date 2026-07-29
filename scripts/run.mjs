import process from "process";
import fs from "fs";
import path from "path";
import concurrently from "concurrently";
import { parse as parseYaml } from "yaml";
import { config } from "./lib.js";

const DEV_LOCAL_PATH = path.join(process.cwd(), "dev-local.yaml");

/**
 * Optional personal overrides from repo-root `dev-local.yaml`
 * (see `dev-local.example.yaml`).
 *
 * @returns {{
 *   tsc?: { nodeOptions?: string },
 *   meteor?: { toolNodeFlags?: string, nodeOptions?: string },
 *   vite?: { nodeOptions?: string, host?: boolean },
 * }}
 */
function loadDevLocalConfig() {
	if (!fs.existsSync(DEV_LOCAL_PATH)) {
		return {};
	}

	try {
		const parsed = parseYaml(fs.readFileSync(DEV_LOCAL_PATH, "utf8"));
		if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
			console.warn("dev-local.yaml: expected a mapping at the top level, ignoring");
			return {};
		}
		console.log("Found dev-local.yaml");
		return parsed;
	} catch (e) {
		console.error(`Failed to parse dev-local.yaml: ${e.message}`);
		process.exit(1);
	}
}

const localConfig = loadDevLocalConfig();

function joinCommand(...parts) {
	return parts.filter((part) => !!part).join(" ");
}

/** @param {Record<string, string | undefined>} env */
function envOrUndefined(env) {
	const cleaned = Object.fromEntries(Object.entries(env).filter(([, value]) => value != null));
	return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function watchPackages() {
	return [
		{
			command: 'yarn watch --preserveWatchOutput',
			cwd: "packages",
			name: "TSC",
			prefixColor: "red",
			env: envOrUndefined({
				// Cap TypeScript compiler memory when configured in dev-local.yaml.
				NODE_OPTIONS: localConfig.tsc?.nodeOptions,
			}),
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
			env: envOrUndefined({
				// TOOL_NODE_FLAGS caps the Meteor build tool's own Node process.
				// NODE_OPTIONS caps the Meteor app server process.
				TOOL_NODE_FLAGS: localConfig.meteor?.toolNodeFlags,
				NODE_OPTIONS: localConfig.meteor?.nodeOptions,
			}),
		},
		{
			command: joinCommand(
				"yarn dev",
				localConfig.vite?.host ? "-- --host" : ""
			),
			cwd: "packages/webui",
			name: "VITE",
			prefixColor: "yellow",
			env: envOrUndefined({
				SOFIE_BASE_PATH: rootUrl && rootUrl.pathname.length > 1 ? rootUrl.pathname : '',
				// Cap Vite's Node process when configured in dev-local.yaml.
				NODE_OPTIONS: localConfig.vite?.nodeOptions,
			}),
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
} catch (e) {
	console.error(e.message);
	process.exit(1);
}

function signalHandler(signal) {
	process.exit();
}

// Make sure to exit on interrupt
process.on("SIGINT", signalHandler);
process.on("SIGTERM", signalHandler);
process.on("SIGQUIT", signalHandler);
