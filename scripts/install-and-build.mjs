import cp from "child_process";
import process from "process";
import concurrently from "concurrently";
import { EXTRA_PACKAGES, config } from "./lib.js";

function hr() {
	// write regular dashes if this is a "simple" output stream ()
	if (!process.stdout.hasColors || !process.stdout.hasColors())
		return "-".repeat(process.stdout.columns ?? 40);
	return "─".repeat(process.stdout.columns ?? 40);
}
function exec(cmd) {
	return new Promise((resolve, reject) => {
		cp.exec(cmd, (err, stdout, stderr) => {
			if (err) reject(err);
			resolve({ stdout, stderr });
		});
	});
}
const yarnVersion = await exec("yarn -v");

// Require yarn > 1:
if (
	yarnVersion.stdout.startsWith("0.") ||
	yarnVersion.stdout.startsWith("1.")
) {
	console.error(
		"It seems like you're using an old version of yarn. Please upgrade to yarn 2 or later"
	);
	console.error(`Detected yarn version: ${yarnVersion.stdout.trim()}`);
	console.error(`--`);
	console.error(`Tip:`);
	console.error(
		`To uninstall yarn classic, you can find where it's installed by running 'which yarn' or 'where yarn'`
	);
	console.error(`After you have uninstalled it, run 'corepack enable'`);

	process.exit(1);
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

	const buildArgs = ["--ignore @sofie-automation/webui"];
	if (config.uiOnly) {
		buildArgs.push(...EXTRA_PACKAGES.map((pkg) => `--ignore ${pkg}`));
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
