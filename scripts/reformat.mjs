import path from "path";
import fs from "fs/promises";
import { glob } from "glob";
import cp from "child_process";

/*

Instructions for applying reformatting:

1. Cherry-pick the commit "chore: update dependencies and reformatting script"
2. Run `yarn postinstall`
3. Apply reformatting automatically:
  a. Run `node scripts/reformat.mjs --write`
  b. Run `node scripts/reformat.mjs --write` again :)
  c. commit the result
	"chore: reformat code using reformat.mjs"
4. cherry-pick the commits:
	* "chore: apply various fixes after reformatting"

*/

const writeChanges = Boolean(process.argv.find((arg) => arg === "--write"));

if (!writeChanges) console.log('Dry run, use "--write" to apply changes');

let exitCode = 0;
let maxCount = 99999;

async function main() {
	let anyChanged = false;
	for (let i = 0; i < 3; i++) {
		// First, prettier reformat all files:
		try {
			console.log("Prettier formatting ---------------------------------");
			await prettierReformatFiles();
		} catch (e) {
			console.error(e);
			exitCode = 1;
		}

		try {
			console.log("Custom formatting -----------------------------------");
			anyChanged = await customReformatFiles();
		} catch (e) {
			console.error(e);
			exitCode = 1;
		}

		if (!anyChanged) {
			break;
		} else {
			console.log("Running again to apply reformatting onto previous run");
		}
	}

	if (anyChanged) {
		console.error(
			`ERROR! Something went wrong, reformatting went into a loop!`
		);
		exitCode = 1;
	} else {
		console.log("Done!");
	}
}

// ----------------------------------------------------------------------------
async function prettierReformatFiles() {
	// await runCmd(`npx prettier --check "./**/*.{ts,tsx,json,md}"`);
	await runCmd(
		`npx prettier ${
			writeChanges ? "--write" : "--check"
		} "./**/*.{ts,tsx,js,jsx,json,css,scss,md,html}"`
	);
}
async function customReformatFiles() {
	// include a
	const files = await glob(["**/*.ts", "**/*.tsx"], {
		ignore: ["**/node_modules/**", "**/dist/**"],
	});

	console.log(`Found ${files.length} files...`);

	let modified = [];

	for (const filename of files) {
		maxCount--;
		if (maxCount < 0) break;

		// if (!filename.includes("App.tsx")) continue;

		console.log(filename);

		const filePath = path.resolve(filename);

		const fileContentOrg = await fs.readFile(filePath, "utf-8");
		let fileContent = fileContentOrg;
		// console.log("fileContent", fileContent);

		const maybeReplaceCb = async (match) => {
			const matchStr = match[0];

			// console.log("matchStr", matchStr);

			if (
				// Already fixed:
				matchStr.includes(".js'") ||
				matchStr.includes(".jsx'") ||
				matchStr.includes(".ts'") ||
				matchStr.includes(".tsx'") ||
				matchStr.includes(".json'") ||
				matchStr.includes(".scss'")
			)
				return undefined;

			if (
				// Must be a relative file name:
				!matchStr.includes("'./") &&
				!matchStr.includes("'..") &&
				!matchStr.includes("'.'")
			)
				return undefined;

			let replaceFile = undefined;

			let orgTarget = path.resolve(path.dirname(filePath), match[1]);

			try {
				if (
					(await fsExists(orgTarget)) &&
					(await isDirectory(orgTarget)) &&
					!(await fsExists(orgTarget + ".ts")) // in case there is a lib.ts and a lib directory
				) {
					// is a directory

					let isAlreadyAFile = false;
					// now check if it also is a file
					const tsFilePaths = [`${orgTarget}.ts`, `${orgTarget}.tsx`];
					for (const tsFilePath of tsFilePaths) {
						// console.log("tsFilePath", tsFilePath);
						if (await fsExists(tsFilePath)) {
							isAlreadyAFile = true;
						}
					}

					if (!isAlreadyAFile) {
						// now check if there is an index file in it
						const indexFiles = [
							path.join(orgTarget, "index.ts"),
							path.join(orgTarget, "index.tsx"),
						];
						for (const indexFile of indexFiles) {
							// console.log("EXISTS?", indexFile);
							if (await fsExists(indexFile)) {
								// console.log("EXISTS", indexFile);

								replaceFile = match[1] + "/index.js";
								break;
							}
						}
					}
				}
			} catch (e) {
				console.log("orgTarget", filePath, match[1], orgTarget);
				throw e;
			}

			if (replaceFile === undefined) {
				replaceFile = match[1] + ".js";
			}

			return matchStr.replace(match[1], replaceFile);

			// return ` from '${replaceFile}'`;
		};
		if (!filename.startsWith("meteor")) {
			// Meteor doesn't support file extensions in imports

			// Add file extensions to imports:
			fileContent = await customReplaceAll(
				fileContent,
				/ from '(.*?)'/g,
				maybeReplaceCb
			);
			fileContent = await customReplaceAll(
				fileContent,
				/import '(.*?)'/g,
				maybeReplaceCb
			);
		}

		// myFunction && myFunction() -> myFunction?.()
		fileContent = await customReplaceAll(
			fileContent,
			/([^ \n\t]+) && ([^ \n\t]+)\(/g,
			(match) => {
				if (match[1] !== match[2]) return undefined;

				return `${match[1]}?.(`;
			}
		);

		// Custom fixes:
		fileContent = fileContent

			// import deepmerge from 'deepmerge'
			//
			.replaceAll(
				/import (\w+) = require\('([\w-]+)'\)/g, // `import _ = require('underscore')`,
				`import $1 from '$2'` // `import _ from 'underscore'`
			)
			.replaceAll(
				`import deepmerge = require('deepmerge')`,
				`import deepmerge from 'deepmerge'`
			)
			.replaceAll(
				/const (\w+) = require\('([\w-]+)'\)\n/g, //`const clone = require('fast-clone')`,
				`import $1 from '$2'\n` // `import clone from 'fast-clone'`
			)
			.replaceAll(
				`import * as deepExtend from 'deep-extend'`,
				`import deepExtend from 'deep-extend'`
			)
			.replaceAll(
				`import * as deepmerge from 'deepmerge'`,
				`import deepmerge from 'deepmerge'`
			)
			.replaceAll(
				`import * as EventEmitter from 'events'`,
				`import { EventEmitter } from 'events'`
			)
			.replaceAll(
				`import objectPath from 'object-path'`,
				`import * as objectPath from 'object-path'`
			)
			.replaceAll(
				`import * as _ from 'underscore'`,
				`import _ from 'underscore'`
			)

			.replaceAll(
				`// eslint-disable-next-line no-process-exit`,
				`// eslint-disable-next-line n/no-process-exit`
			)
			.replaceAll(
				`// eslint-disable-next-line @typescript-eslint/ban-types`,
				`// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type`
			)
			.replaceAll(
				`// eslint-disable-next-line @typescript-eslint/no-empty-interface`,
				`// eslint-disable-next-line @typescript-eslint/no-empty-object-type`
			);

		if (fileContentOrg !== fileContent) {
			modified.push(filename);
			if (writeChanges) await fs.writeFile(filePath, fileContent, "utf-8");
			else console.log(`Needs fixing: ${filename}`);
		}
	}
	if (writeChanges) {
		console.log(`Modified ${modified.length} files`);
	} else {
		if (modified.length > 0) {
			throw new Error(`${modified.length} files need fixing`);
		} else {
			console.log(
				`${modified.length} files need fixing (checked ${files.length} files)`
			);
		}
	}

	return modified.length > 0;
}
async function runCmd(cmd) {
	await new Promise((resolve, reject) => {
		const child = cp.exec(cmd, (err, stdout, stderr) => {
			if (err) {
				// console.error("stderr", stderr);
				reject(err);
			} else {
				resolve(stdout);
			}
		});

		child.stdout.pipe(process.stdout);
		child.stderr.pipe(process.stderr);
	});
}
async function customReplaceAll(str, regexp, cb) {
	const matches = str.matchAll(regexp);

	for (const match of matches) {
		const replaceWith = await cb(match);
		if (replaceWith !== undefined) {
			const matchStr = match[0];

			const newStr = str.replace(matchStr, replaceWith);

			if (newStr !== str) {
				str = newStr;

				if (!writeChanges) {
					console.log(`- ${matchStr}\n+ ${replaceWith}\n`);
				}
			}
		}
	}
	return str;
}

const cache = new Map();
async function isDirectory(filePath) {
	if (cache.has(filePath)) return cache.get(filePath);

	const stats = await fs.stat(filePath);
	const isDir = stats.isDirectory();

	cache.set(filePath, isDir);
	return isDir;
}
async function fsExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch (e) {
		return false;
	}
}

main()
	.catch(console.error)
	.then(() => process.exit(exitCode));
