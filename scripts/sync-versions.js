/**
 * Push the version of the root package.json (the product version, bumped by commit-and-tag-version) into
 * lerna.json and every workspace under packages/, and stage the results.
 * Run by the commit-and-tag-version `postbump` hook, see the root package.json.
 */
const { execSync } = require('child_process')
const path = require('path')

const PACKAGE_VERSION = require('../package.json').version

const cmd = `yarn set-version-and-changelog ${PACKAGE_VERSION} && yarn stage-versions`
console.log(cmd)
execSync(cmd, { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
