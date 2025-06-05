const legally = require("../meteor/node_modules/legally");

// Usage: node checkLicenses.js --allowed=MIT,ISC --excludePackages=badPackageWhoDoesntSpeficyLicense

let validLicenses = [];
let excludePackages = [];

process.argv.forEach((argString) => {
	let m;
	m = argString.match(/--allowed=["']([^"']*)["']/);
	if (!m) m = argString.match(/--allowed=(.*)/);
	if (m) {
		const strs = m[1].split(",");
		console.log(`Valid licenses: ${strs.join(", ")}`);
		validLicenses = strs.map((str) => new RegExp(str), "i");
	}

	m = argString.match(/--excludePackages=(.*)/);
	if (m) {
		excludePackages = m[1].split(",");
		console.log(`Excluding packages: ${excludePackages.join(", ")}`);
	}
});

if (!validLicenses.length) {
	throw "usage: node checkLicenses.js --allowed=MIT,ISC --excludePackages=badPackageWhoDoesntSpeficyLicense";
}

console.log("Checking used licenses...");

legally()
	.then((licenses) => {
		let ok = true;

		for (const [packageName, info] of Object.entries(licenses)) {
			let exclude = false;
			for (const excludePackage of excludePackages) {
				if (packageName.match(new RegExp(`^${excludePackage}@`))) {
					exclude = true;
				}
			}
			if (exclude) continue;

			let foundApproved = false;
			for (const license of info.package) {
				for (const validLicense of validLicenses) {
					if (license.match(validLicense)) {
						foundApproved = true;
						break;
					}
				}
			}
			if (!foundApproved) {
				console.log(
					`Unapproved License: "${info.package}" in ${packageName}`,
				);
				ok = false;
			}
		}

		if (ok) {
			console.log("All is well :)");
			process.exit(0);
		} else {
			process.exit(100);
		}
	})
	.catch((e) => {
		console.error(e);
		process.exit(100);
	});
