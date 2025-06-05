import process from "process";
import concurrently from "concurrently";
import { EXTRA_PACKAGES, config } from "./lib.js";

function hr() {
	// write regular dashes if this is a "simple" output stream ()
	if (!process.stdout.hasColors || !process.stdout.hasColors())
		return '-'.repeat(process.stdout.columns ?? 40)
	return '─'.repeat(process.stdout.columns ?? 40)
}

try {
	// Install and build packages
	console.log(hr());
	console.log(" 📦  Installing dependencies...");
	console.log(hr());

	await concurrently(
		[
			// Install meteor & Core dependencies
			{
				command: "yarn install:meteor",
				name: "METEOR-INSTALL",
				prefixColor: "red",
			},
			// Install packages depencencies
			{
				command: "yarn install:packages",
				name: "PACKAGES-INSTALL",
				prefixColor: "yellow",
			},
		],
		{
			prefix: "name",
			killOthers: ["failure", "success"],
			restartTries: 1,
		}
	).result;

	console.log(hr());
	console.log(" 🪛  Build packages...");
	console.log(hr());

	const buildArgs = ['--ignore @sofie-automation/webui']
	if (config.uiOnly) {
		buildArgs.push(...EXTRA_PACKAGES.map((pkg) => `--ignore ${pkg}`))
	}

	await concurrently(
		[
			{
				command: `yarn build:try ${buildArgs.join(" ")}`,
				cwd: "packages",
				name: "PACKAGES-BUILD",
				prefixColor: "yellow",
			},
		],
		{
			prefix: "name",
			killOthers: ["failure", "success"],
			restartTries: 1,
		}
	).result;
} catch (e) {
	console.error(e.message);
	process.exit(1);
}

function signalHandler(signal) {
	process.exit();
}

// Make sure to exit on interupt
process.on("SIGINT", signalHandler);
process.on("SIGTERM", signalHandler);
process.on("SIGQUIT", signalHandler);
