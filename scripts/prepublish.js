/* *************************************************************************
 *
 * This script rewrites the package.json files of the packages in this mono-repo.
 * It changes the dependencies of internal packages from "link:../PACKAGE-NAME" to
 * use an absolute version instead, so that the published packages can be used externally.
 *
 *
 * **************************************************************************/
const fs = require('fs')
const fsp = fs.promises
const path = require('path')

const basePath = path.resolve('./packages')

/**
 * Argument allowing to override the default package scope in forks
 * Will change the package names from @sofie-automation/<package-name> to <scopeOverride>/<package-name>
 */
const repositoryName = process.argv[2] // eg nrkno/sofie-nrk-core
const scopeOverride = process.argv[3] // eg nrk
const prefixSofie = !!process.argv[4] // eg 1

;(async() => {

     // exists?
    if (!await exists(basePath)) throw new Error(`${basePath} does not exist`)

    const packages = []

    for (const dir of await fsp.readdir(basePath, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue

        const dirPath = path.join(basePath, dir.name)
        const packagePath = path.join(dirPath, 'package.json')

        // exists?
        if (!await exists(packagePath)) continue

        const pkgJson = require(packagePath)
        packages.push({
            packagePath,
			dirName: dir.name,
            package: pkgJson,
            originalName: pkgJson.name
        })
    }


    for (const p of packages) {
        let changed = false
        // Rewrite internal dependencies to target the correct version, so that it works when published to npm:
        for (const depName of Object.keys(p.package.dependencies || {})) {

            const foundPackage = packages.find(p => p.originalName === depName)
            if (foundPackage) {
				modifyDependency(depName, p.package.dependencies, foundPackage.package.version)
				changed = true
            }
        }

		// Update any references to github repository, some of this is needed for provenance
		if (repositoryName){
			if (p.package.repository) {
				p.package.repository.url = `https://github.com/${repositoryName}.git`
			}
			if (p.package.bugs) {
				p.package.bugs.url = `https://github.com/${repositoryName}/issues`
			}
			p.package.homepage = `https://github.com/${repositoryName}/blob/main/packages/${p.dirName}#readme`
			changed = true
		}

		const newName = translatePackageName(p.package.name)
		if (newName && newName !== p.package.name) {
			p.package.name = newName
			changed = true
		}
        if (changed) {
            await fsp.writeFile(p.packagePath, JSON.stringify(p.package, null, '\t')+'\n')
            console.log(`Updated ${p.originalName !== p.package.name ? p.originalName + ' -> ' : ''}${p.package.name}`)
        }
    }

    console.log(`Done`)
})().catch((err) => {
    console.error(err)
    process.exit(1)
})


function translatePackageName(name) {
	const packageName = name.split('/')
	if (scopeOverride && packageName.length === 2) {
		let nameSuffix = packageName[1]
		if (prefixSofie && !nameSuffix.startsWith('sofie-')) nameSuffix = 'sofie-' + nameSuffix

		return `@${scopeOverride}/${nameSuffix}`
	} else {
		return null
	}
}

function modifyDependency(depName, dependencies, version) {
	const newName = translatePackageName(depName)
	if (newName) {
		dependencies[depName] = `npm:${newName}@${version}`
	} else {
		dependencies[depName] = version
	}
}

async function exists(checkPath) {
    try {
        await fsp.access(checkPath, fs.constants.F_OK)
        return true
    } catch (err) {
        return false
    }
}