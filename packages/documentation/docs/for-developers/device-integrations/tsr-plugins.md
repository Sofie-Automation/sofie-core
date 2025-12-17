# TSR Plugins

As of 1.53, it is possible to load additional device integrations into TSR as 'plugins'. This is intended to be an escape hatch when you need to make an integration for an internal system or for when an NDA with a device vendor does not allow for opensourcing. We still encourage anything which can be made opensource to be contributed back.

## Creating a plugin

It is expected that each plugin should be its own self-contained folder, including any npm dependencies.

You can see a complete and working (at time of writing) example of this at [sofie-tsr-plugin-example](https://github.com/SuperFlyTV/sofie-tsr-plugin-example). This example is based upon a copy of the builtin atem integration.

There are a few npm libraries which will be useful to you

- `timeline-state-resolver-types` - Some common types from TSR are defined in here
- `timeline-state-resolver-api` - This defines the api and other types that your device integrations should implement.
- `timeline-state-resolver-tools` - This contains various tooling for building your plugin

Some useful npm scripts you may wish to copy are:

```js
{
    "translations:extract": "tsr-extract-translations tsr-plugin-example ./src/main.ts",
    "translations:bundle": "tsr-bundle-translations tsr-plugin-example ./translations.json",
    "schema:deref": "tsr-schema-deref ./src ./src/\\$schemas/generated",
    "schema:types": "tsr-schema-types ./src/\\$schemas/generated ./src/generated"
}
```

There are a few key properties that your plugin must conform to, the rest of the structure and how it gets generated is up to you.

1. It must be possible to `require(...)` your plugin folder. The resuling js must contain an export of the format `export const Devices: Record<string, DeviceEntry> = {}`
   This is how the TSR process finds the entrypoint for your code, and allows you to define multiple device types.

2. There must be a `manifest.json` file at the root of your plugin folder. This should contain json in the form `Record<string, TSRDevicesManifestEntry>`
   This is a composite of various json schemas, we recommend generating this file with a script and using the same source schemas to generate relevant typescript types.

3. There must be a `translations.json` file at the root of your plugin folder. This should contain json in the form `TranslationsBundle[]`.
   This should contain any translation strings that should be used when displaying various things about your device in a UI. Populating this with translations is optional, you only need to do so if this is useful to your users.

:::info
If running some of the `timeline-state-resolver-tools` scripts fails with an error relating to `cheerio`, you should add a yarn resolution (or equivalent for your package manager) to pin the version to `"cheerio": "1.0.0-rc.12"` which is compatible with our tooling.
:::

## Using with the TSR API

If you are using TSR in a non-sofie project, to load plugins you should:

- construct a `DevicesRegistry`
- using the methods on this registry, load the needed plugins
- pass this registry into the `Conductor` constructor, inside the options object.

You can mutate the contents of the `DevicesRegistry` after passing to the `Conductor`, and it will be used when spawning or restarting devices.

## Using with Sofie

In Sofie playout-gateway, plugins can be loaded by setting the `TSR_PLUGIN_PATHS` environment variable to any folders containing plugins.

It is possible to extend the docker images to add in your own plugins.  
You can use a dockerfile in your plugin git repository along the lines of:

```Dockerfile
# BUILD IMAGE
FROM node:22
WORKDIR /opt/tsr-plugin-example

COPY . .

RUN corepack enable
RUN yarn install
RUN yarn build
RUN yarn install --production

# cleanup stuff we don't want in the final image
RUN rm -rf .git src

# DEPLOY IMAGE
FROM sofietv/tv-automation-playout-gateway:release53

ENV TSR_PLUGIN_PATHS=/opt/tsr-plugin-example
COPY --from=0 /opt/tsr-plugin-example /opt/tsr-plugin-example
```

## Using in Sofie blueprints

To use a TSR plugin in your blueprints, make sure you have your content types available in the blueprints.

You can create a file in your src folder such as `tsr-types.d.ts` with content being something like:

```ts
import type { FakeDeviceType, TimelineContentFakeAny } from './test-types.js'

declare module 'timeline-state-resolver-types' {
	interface TimelineContentMap {
		[FakeDeviceType]: TimelineContentFakeAny
	}
}
```

The `FakeDeviceType` should be defined as `export const FakeDeviceType = 'fake' as const` and should be used as the deviceType property of your types.

A minimal example of the types is:

```ts
export const FakeDeviceType = 'fake' as const

export declare enum TimelineContentTypeFake {
	AUX = 'aux',
}

export type TimelineContentFakeAny = TimelineContentFakeAUX

export interface TimelineContentFakeBase {
	deviceType: typeof FakeDeviceType
	type: TimelineContentTypeFake
}

export interface TimelineContentFakeAUX extends TimelineContentFakeBase {
	type: TimelineContentTypeFake.AUX
	aux: {
		input: number
	}
}
```

With this, all of the sofie timeline object and tsr types will accept your custom types as well as the default ones.
