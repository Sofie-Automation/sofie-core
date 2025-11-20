---
sidebar_position: 1
---

# Introduction

:::caution
Documentation for this page is yet to be written.
:::

[Blueprints](../../user-guide/concepts-and-architecture.md#blueprints) are JavaScript programs that run inside Sofie Core and interpret data coming in from the Rundowns and transform that into playable elements. They use an API published in [@sofie-automation/blueprints-integration](https://sofie-automation.github.io/sofie-core/typedoc/modules/_sofie_automation_blueprints_integration.html) [TypeScript](https://www.typescriptlang.org/) library to expose their functionality and communicate with Sofie Core.

Technically, a Blueprint is a JavaScript object, implementing one of the `BlueprintManifestBase` interfaces.

Sofie doesn't have a built-in package manager or import, so all dependencies need to be bundled into a single `*.js` file bundle using a bundler such as  [Rollup](https://rollupjs.org/) or [webpack](https://webpack.js.org/). The community has built a set of utilities called [SuperFlyTV/sofie-blueprint-tools](https://github.com/SuperFlyTV/sofie-blueprint-tools/) that acts as a nascent framework for building & bundling Blueprints written in TypeScript.

:::info
Note that the Runtime Environment for Blueprints in Sofie is plain JavaScript at [ES2015 level](https://en.wikipedia.org/wiki/ECMAScript_version_history#6th_edition_%E2%80%93_ECMAScript_2015), so other ways of building Blueprints are also possible.
:::

Currently, there are three types of Blueprints:

- [Show Style Blueprints](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.ShowStyleBlueprintManifest.html) - handling converting NRCS Rundown data into Sofie Rundowns and content.
- [Studio Blueprints](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.StudioBlueprintManifest.html) - handling selecting ShowStyles for a given NRCS Rundown and assigning NRCS Rundowns to Sofie Playlists
- [System Blueprints](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.SystemBlueprintManifest.html) - handling system provisioning and global configuration

# Show Style Blueprints

These blueprints interpret the data coming from the [NRCS](../../user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/intro.md), meaning that they need to support the particular data structures that a given Ingest Gateway uses to store incoming data from the Rundown editor. They will need to convert Rundown Pages, Cues, Items, pieces of show script and other types of objects into [Sofie concepts](../concepts-and-architecture.md) such as Segments, Parts, Pieces and AdLibs.

# Studio Blueprints

These blueprints provide a "baseline" Timeline that is being used by your Studio whenever there isn't a Rundown active. They also handle combining Rundowns into RundownPlaylists. Via the [`applyConfig`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie-automation_blueprints-integration.StudioBlueprintManifest.html#applyconfig) method, these Blueprints enable a _Configuration-as-Code_ approach to configuring connections to various elements of your Control Room and Studio.

# System Blueprints

These blueprints exist to allow a _Configuration-as-Code_ approach to an entire Sofie system. This is done via the [`applyConfig`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie-automation_blueprints-integration.SystemBlueprintManifest.html#applyconfig) providing personality information such as global system configuration or system-wide HotKeys via the Blueprints.