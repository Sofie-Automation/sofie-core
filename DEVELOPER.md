# For Developers

Before you start, be sure to read the [Contribution guidelines](CONTRIBUTING.md)!

## About Sofie Core

### Documentation

The documentation can be found at [Sofie TV Automation Documentation](https://sofie-automation.github.io/sofie-core//) and its for subsection [For Developers](https://sofie-automation.github.io/sofie-core//docs/for-developers/intro). Specific _Sofie Core_ information can also be in `DOCS.md` and `DEVELOPER.md` in the subfolders of this git project, for example [meteor/server/api/playout](meteor/server/api/playout/DOCS.md).

### Monorepo Layout

This repository is a monorepo and contains both the main application (usually called server-core) as well as multiple auxiliary projects. In the `meteor` folder you will find the main Meteor application with `server` and `client` sub folders for the server-side application and front end. The `packages` folder contains other libraries and apps used together with Sofie Core.

## Getting Started with Local Development

Follow these instructions to start up Sofie Core in development mode. (For production deploys, see [System documentation](https://sofie-automation.github.io/sofie-core//docs/user-guide/installation/intro).)

### Prerequisites

- Install [Node.js](https://nodejs.org) 20 (using [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows) is the recommended way to install Node.js)
- Install [Meteor](https://www.meteor.com/install) (`npm install --global meteor`)
- Enable [corepack](https://nodejs.org/api/corepack.html#corepack) (`corepack enable`) as administrator/root. If `corepack` is not found, you may need to install it first with `npm install --global corepack`

- If on Windows, you may need to `npm install --global windows-build-tools` but this is not always necessary

### Quick Start

```bash
git clone -b main https://github.com/Sofie-Automation/sofie-core.git
cd sofie-core
yarn
yarn start
```

> 💡 First startup may take a while, especially on Windows. To speed things up, consider adding `%LOCALAPPDATA%\.meteor` and the directory where you cloned `server-core` to your Windows Defender virus protection exclusions.

The Sofie ui (served by Vite) can be accessed at `http://localhost:3005`. The meteor http server can be access directly at `http://localhost:3000`

### Slightly more Involved Start

1. Clone the repository (for development, it is recommended to base your work on the latest unstable release branch)

   ```bash
   git clone -b releaseXYZ https://github.com/Sofie-Automation/sofie-core.git
   ```

2. Go into the cloned directory

   ```bash
   cd sofie-core
   ```

3. Setup meteor and dependencies. (Before this, make sure your NODE_ENV environment variable is NOT set to "production"!)

   ```bash
   yarn install
   ```

4. Start development mode

   ```bash
   yarn dev
   ```

5. In another window, start the playout-gateway. You will need to manually restart this upon making changes

   ```bash
   cd sofie-core/packages/playout-gateway
   yarn buildstart
   ```

### Lowering memory, CPU footprint in development

If you find yourself in a situation where running Sofie in development mode is too heavy, but you're not planning on modifying any of the low-level packages in the `packages` directory, you may want to run Sofie in the _UI-only mode_, in which only meteor will be rebuilt and type-checked on modification:

```bash
yarn dev --ui-only
```

### Dealing with Strange Errors

If you get any strange errors (such as the application crashing, "Unable to resolve some modules" or errors during installation of dependencies), the last resort is to reset and restart:

```bash
yarn reset # Removes all installed dependencies and build artifacts
yarn start # Set up, install and run in dev mode
```

## Editing the Code

The code is formatted and linted using prettier/eslint. The shared config can be found in the [code-standard-preset](https://github.com/Sofie-Automation/sofie-code-standard-preset) project. We recommend using VS code with the Prettier plugin and "format-on-save" enabled.

### When Using the Visual Studio Code IDE

We provide a `settings.json.default` file in `.vscode` that you should consider using with your IDE. Also consider installing suggested
extensions, which should help you create PRs consistent with project's code standards.

### Attaching a NodeJS debugger to the Meteor process

You can connect a debugging client to Meteor's Node process on port `9229`. In order for that to be possible, enable the `--inspect-meteor` mode:

```bash
yarn dev --inspect-meteor
```

### Debugging blueprints

The "Attach" configuration in `launch.json` supports debugging blueprints.

Local blueprints repo needs to be added to the Visual Studio Code workspace under the name "Blueprints".

It is required to set `devtool` to `'inline-source-map'` and `output.devtoolModuleFilenameTemplate` to `'blueprint:///[resource-path]'` in webpack config of the blueprints.

## Translating Sofie

For support of various languages in the GUI, Sofie uses the _i18next_ framework. It uses JSON-based translation files to store UI strings. In order to build a new translation file, first extract a PO template file from Sofie UI source code:

```bash
cd meteor
yarn i18n-extract-pot
```

Find the created `template.pot` file in `meteor/i18n` folder. Create a new PO file based on that template using a PO editor of your choice. Save it in the `meteor/i18n` folder using your [ISO 639-1 language code](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) of choice as the filename.

Then, run the compilation script:

```bash
yarn i18n-compile-json
```

The resulting JSON file will be placed in `meteor/public/locales/xx`, where it will be available to the Sofie UI for use and auto-detection.

Then submit this as a PR.

## Deprecations

### ConfigManifests

The ConfigManifests for Blueprints and Gateways was replaced with JSONSchema in R50.
However, one usage by AdlibActions for their userDataManifest remains as this is not something we are actively using.

## Blueprint Migrations

In R52, the replacement flow of `validateConfig` and `applyConfig` was extended to the system blueprint
It is no longer recommended to use the old migrations flow for system blueprints.

### Blueprints: getPieceABSessionId & getTimelineObjectAbSessionId

With AB being a native concept supported by Sofie since R50, these are likely no longer useful to Blueprints.

### MongoQuery `fields` specifier

It is recommended to use `projection` instead, as it is functionally identical but follows recommended naming from mongodb.

## Other info

### Version-Numbering Scheme

This repository, Sofie Core, does not follow semver. We believe that semver does not make sense for Sofie Core as there are so many moving parts that a majority of releases could be considered breaking in some way.

Instead of semver, the Major number gets incremented whenever we feel like Sofie has evolved enough to warrant the change. The minor number gets incremented for each iteration of the development cycle, with the digit matching the cycle number. The patch number gets incremented for patch releases as expected.

The version numbers of the `blueprints-integration` and `server-core-integration` libraries are tied to this, and as such they also do not follow semver. In future these may be decoupled.
The api of `server-core-integration` is pretty stable and rarely undergoes any breaking changes, so is ok to be mismatched.
The api of `blueprints-integration` is rather volatile, and often has breaking changes. Because of this, we recommend matching the minor version of `blueprints-integration` with Sofie core. Sofie will warn if these do not match. We expect this to settle down in the future, and will review this decision when we feel it is worthwhile.

### Glossary

_Note: this list is not very complete but will be supplemented over time._

<table class="relative-table wrapped" style="width: 58.5299%;">
<colgroup><col style="width: 22.6079%;"> <col style="width: 77.3921%;"></colgroup>
<tbody>

<tr>
<th>Term</th>
<th>Meaning</th>
</tr>

<tr>
<td>Auto Next</td>
<td>Part with a set duration after which Sofie will automatically take the next part</td>
</tr>

<tr>
<td>Hold</td>
<td>Allows a blueprint developer to extend some pieces into the next part until the user does another take. Can be used to make _J-cuts_.</td>
</tr>

<tr>
<td>Piece or Part Instance</td>
<td>A copy of the original part or piece that was created just before playback. Can contain timing information and prevents ingest operations from badly affecting parts and pieces on-air</td>
</tr>

</tbody>
</table>

### Additional license information

Background image used for previewing graphical elements is based on "Sunset over dark forest" by Aliis Sinisalu: https://unsplash.com/photos/8NiAH5YRZPs used under the [Unsplash License](https://unsplash.com/license).
