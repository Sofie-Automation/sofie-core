const semver = require("semver");

if (process.argv.length < 4) {
	console.error("Expected two arguments");
	process.exit(1);
}

const PublishedVersionStr = process.argv[2];
const NewVersionStr = process.argv[3];

const newVersion = semver.parse(NewVersionStr);
if (!newVersion) throw new Error(`NewVersion "${NewVersionStr}" not valid`);

if (newVersion.prerelease.length > 0) {
	// Prerelease versions always tagged as beta
	console.log("beta");
} else if (newVersion.compare(PublishedVersionStr) === 1) {
	// New version is higher than the last published version
	console.log("latest");
} else {
	console.log("hotfix");
}
