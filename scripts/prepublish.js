/* *************************************************************************
 *
 * This script rewrites the package.json files of the packages in this mono-repo.
 * It changes the dependencies of internal packages from "link:../PACKAGE-NAME" to
 * use an absolute version instead, so that the published packages can be used externally.
 *
 *
 * **************************************************************************/
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const basePath = path.resolve("./packages");

/**
 * Argument allowing to override the default package scope in forks
 * Will change the package names from @sofie-automation/<package-name> to <scopeOverride>/<package-name>
 */
const scopeOverride = process.argv[2];

(async () => {
	// exists?
	if (!(await exists(basePath)))
		throw new Error(`${basePath} does not exist`);

	const packages = [];

	for (const dir of await fsp.readdir(basePath, { withFileTypes: true })) {
		if (!dir.isDirectory()) continue;

		const dirPath = path.join(basePath, dir.name);
		const packagePath = path.join(dirPath, "package.json");

		// exists?
		if (!(await exists(packagePath))) continue;

		const package = require(packagePath);
		packages.push({
			packagePath,
			package,
			originalName: package.name,
		});
	}

	for (const p of packages) {
		let changed = false;
		// Rewrite internal dependencies to target the correct version, so that it works when published to npm:
		for (const depName of Object.keys(p.package.dependencies || {})) {
			const foundPackage = packages.find(
				(p) => p.originalName === depName,
			);
			if (foundPackage) {
				if (
					p.package.dependencies[depName] !==
					foundPackage.package.version
				) {
					modifyDependency(
						depName,
						p.package.dependencies,
						foundPackage.package.version,
					);
					changed = true;
				}
			}
		}
		const packageName = p.package.name.split("/");
		if (scopeOverride && packageName.length === 2) {
			p.package.name = `${scopeOverride}/${packageName[1]}`;
			changed = true;
		}
		if (changed) {
			await fsp.writeFile(
				p.packagePath,
				JSON.stringify(p.package, null, "\t") + "\n",
			);
			console.log(
				`Updated ${p.originalName !== p.package.name ? p.originalName + " -> " : ""}${p.package.name}`,
			);
		}
	}

	console.log(`Done`);
})().catch((err) => {
	console.error(err);
	process.exit(1);
});

function modifyDependency(depName, dependencies, version) {
	const oldDepName = depName.split("/");
	dependencies[depName] =
		scopeOverride && oldDepName.length === 2
			? `npm:${scopeOverride}/${oldDepName[1]}@${version}`
			: version;
}

async function exists(checkPath) {
	try {
		await fsp.access(checkPath, fs.constants.F_OK);
		return true;
	} catch (err) {
		return false;
	}
}
