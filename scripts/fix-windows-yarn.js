// this is expected to run from within `meteor`
const process = require("process");
const fs = require("fs");
const path = require("path");

function mkdirSyncIfNotExists(p) {
	if (fs.existsSync(p)) return;
	fs.mkdirSync(p);
}

function copyFileSyncIfNotExists(source, target) {
	if (fs.existsSync(target)) return;
	fs.copyFileSync(source, target);
}

function copyFileSync(source, target) {
	let targetFile = target;

	// If target is a directory, a new file with the same name will be created
	if (fs.existsSync(target)) {
		if (fs.lstatSync(target).isDirectory()) {
			targetFile = path.join(target, path.basename(source));
		}
	}

	fs.copyFileSync(source, targetFile);
}

function copyFolderRecursiveSync(source, target) {
	// Check if folder needs to be created or integrated
	const targetFolder = path.join(target, path.basename(source));
	if (!fs.existsSync(targetFolder)) {
		fs.mkdirSync(targetFolder);
	}

	// Copy
	if (fs.lstatSync(source).isDirectory()) {
		const filesToCopy = fs.readdirSync(source);
		filesToCopy.forEach(function (file) {
			var curSource = path.join(source, file);
			if (fs.lstatSync(curSource).isDirectory()) {
				copyFolderRecursiveSync(curSource, targetFolder);
			} else {
				copyFileSync(curSource, targetFolder);
			}
		});
	}
}

// only run on Windows
if (process.platform !== "win32") process.exit();

const files = ["yarn", "yarn.cmd", "yarnpkg", "yarnpkg.cmd", "yarn.js"];

files.forEach((file) => {
	copyFileSyncIfNotExists(
		`.meteor/local/dev_bundle/node_modules/yarn/bin/${file}`,
		`.meteor/local/dev_bundle/bin/${file}`,
	);
});

mkdirSyncIfNotExists(".meteor/local/dev_bundle/lib");
copyFolderRecursiveSync(
	".meteor/local/dev_bundle/node_modules/yarn/lib",
	".meteor/local/dev_bundle",
);
