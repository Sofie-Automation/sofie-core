---
sidebar_position: 1
---

# Introduction

:::caution
Documentation for this page is yet to be written.
:::

[Blueprints](../../user-guide/concepts-and-architecture.md#blueprints) are programs that run inside Sofie Core and interpret
data coming in from the Rundowns and transform that into playable elements. They use an API published in [@sofie-automation/blueprints-integration](https://sofie-automation.github.io/sofie-core/typedoc/modules/_sofie_automation_blueprints_integration.html) library to expose their functionality and communicate with Sofie Core.

Technically, a Blueprint is a JavaScript object, implementing one of the `BlueprintManifestBase` interfaces.

Currently, there are three types of Blueprints:

- [Show Style Blueprints](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.ShowStyleBlueprintManifest.html) - handling converting NRCS Rundown data into Sofie Rundowns and content.
- [Studio Blueprints](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.StudioBlueprintManifest.html) - handling selecting ShowStyles for a given NRCS Rundown and assigning NRCS Rundowns to Sofie Playlists
- [System Blueprints](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.SystemBlueprintManifest.html) - handling system provisioning and global configuration
