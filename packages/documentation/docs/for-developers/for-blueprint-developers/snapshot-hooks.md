---
title: Snapshot hooks
---

# Snapshot hooks

Sofie can store **snapshots** of system configuration and rundown playlist state. Blueprints can run optional callbacks when those snapshots are **created**, which is useful for driving external systems—for example executing [TSR actions](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.IExecuteTSRActionsContext.html) on playout devices when a snapshot is stored.

What actually triggers each hook depends on the snapshot type (see below). In short: **cron** only stores **playlist** snapshots (when enabled in system settings), not system snapshots. **Debug capture** is a separate user-triggered flow that runs both hooks.

There are two hooks, on different blueprint types:

| Snapshot type              | Blueprint                                                                                                                                               | Callback                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System (and debug capture) | [Studio](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.StudioBlueprintManifest.html)        | [`onSystemSnapshotCreated`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.StudioBlueprintManifest.html#onsystemsnapshotcreated)        |
| Rundown playlist           | [Show Style](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.ShowStyleBlueprintManifest.html) | [`onPlaylistSnapshotCreated`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.ShowStyleBlueprintManifest.html#onplaylistsnapshotcreated) |

Restore operations do **not** invoke these hooks (creation only).

## Why studio and show style (not system blueprint)

Playout devices and TSR actions are **studio-scoped**. The studio blueprint hook runs in a studio worker job with access to `listPlayoutDevices()` and `executeTSRAction()`. The show style hook runs when playlist playout data is snapshotted and uses the same TSR APIs.

The [system blueprint](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.SystemBlueprintManifest.html) has no device context and is not used for these callbacks.

## `onSystemSnapshotCreated` (studio blueprint)

Called **after** the system snapshot file has been stored.

### It runs when:

Typical triggers: **Settings → Snapshots** (system snapshot), **REST/API** (`POST /snapshots` with type `system`), and **debug capture** (see below). Automatic system snapshots taken before migration use the same path for full-system snapshots.

- **Studio-scoped system snapshot** (`studioId` set in snapshot options): one invocation for that studio.
- **Full-system snapshot** (no `studioId`, all studios in the file): one invocation **per studio** included in the snapshot.
- **Debug snapshot** ([`storeDebugSnapshot`](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/server/api/snapshot.ts)): one invocation for the target studio (`info.type` is `'debug'`). This is available from the rundown UI / triggered actions (“create snapshot for debug”), not from cron. The embedded system data inside the debug file does not fire additional system hooks.

If no studio is in scope (empty studio list), the hook is not called.

### Context

[`ISystemSnapshotCreatedContext`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.ISystemSnapshotCreatedContext.html) — studio config, mappings, and [`IExecuteTSRActionsContext`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.IExecuteTSRActionsContext.html).

### Info payload

[`IBlueprintSystemSnapshotInfo`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.IBlueprintSystemSnapshotInfo.html) — metadata only; the snapshot JSON is **not** passed into the blueprint VM.

| Field                         | Description                                                  |
| ----------------------------- | ------------------------------------------------------------ |
| `snapshotId`                  | Id of the stored snapshot                                    |
| `reason`                      | Human-readable reason from the request (UI, API, cron, etc.) |
| `type`                        | [`BlueprintSnapshotType`](https://sofie-automation.github.io/sofie-core/typedoc/types/_sofie_automation_blueprints_integration.BlueprintSnapshotType.html) (`system` or `debug`) |
| `options.studioId`            | Studio this invocation is for                                |
| `options.withDeviceSnapshots` | Whether device state was included in the file                |
| `options.fullSystem`          | `true` if the stored snapshot is a full-system snapshot      |

### Example

```ts
async onSystemSnapshotCreated(context, info) {
	const devices = await context.listPlayoutDevices()
	if (devices.length === 0) return

	await context.executeTSRAction(devices[0].deviceId, 'mySnapshotAction', {
		snapshotId: info.snapshotId,
		reason: info.reason,
		fullSystem: info.options.fullSystem ?? false,
	})
}
```

## `onPlaylistSnapshotCreated` (show style blueprint)

Called **after** playlist snapshot data has been generated in the job-worker, **before** Meteor writes the snapshot file to disk.

### It runs when:

- User triggers “store snapshot” on a rundown playlist (rundown header, shelf, after-broadcast form, triggered actions, etc.)
- **REST/API** playlist snapshots
- **Cron** — when `coreSystem.settings.cron.storeRundownSnapshots.enabled` is true ([`meteor/server/cronjobs.ts`](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/server/cronjobs.ts)); optional filter by playlist name
- **Debug capture** — for each **active** playlist in the studio, when the user runs debug snapshot capture (same UI/trigger path as above; one hook per active playlist)

### Show style selection

Playlists may contain multiple rundowns (and show styles). Only **one** show style blueprint is invoked per snapshot:

1. Show style of the rundown for the **current** part instance, if set
2. Otherwise show style of the **next** part instance
3. Otherwise show style of the **first** rundown in the playlist (sorted by name)

If the playlist has no rundowns, the hook is skipped.

### Context

[`IPlaylistSnapshotCreatedContext`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.IPlaylistSnapshotCreatedContext.html) — show style and studio config, and `IExecuteTSRActionsContext`.

### Info payload

[`IBlueprintPlaylistSnapshotInfo`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.IBlueprintPlaylistSnapshotInfo.html) — metadata only; not the full snapshot blob.

| Field                  | Description                                   |
| ---------------------- | --------------------------------------------- |
| `snapshotId`           | Id assigned before generation                 |
| `playlistId`           | Rundown playlist id                           |
| `reason`               | Human-readable reason from the request        |
| `options.full`         | All part/piece instances vs recent only       |
| `options.withTimeline` | Timeline included when playlist was activated |
| `playlist.name`        | Playlist name at snapshot time                |
| `playlist.active`      | Whether the playlist had an activation        |
| `playlist.rehearsal`   | Rehearsal mode flag                           |

### Example

```ts
async onPlaylistSnapshotCreated(context, info) {
	const devices = await context.listPlayoutDevices()

	await context.executeTSRAction(devices[0].deviceId, 'playlistSnapshotAction', {
		playlistId: info.playlistId,
		active: info.playlist.active,
		reason: info.reason,
	})
}
```

## Error handling

If a hook throws or rejects, Core **logs the error** and continues. Snapshot generation and storage are not aborted. This matches other playout event hooks such as `onRundownActivate`.

## Related API

- Type definitions: [`snapshotContext.ts`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/blueprints-integration/src/context/snapshotContext.ts) in `@sofie-automation/blueprints-integration`
- TSR methods: [`IExecuteTSRActionsContext`](https://sofie-automation.github.io/sofie-core/typedoc/interfaces/_sofie_automation_blueprints_integration.IExecuteTSRActionsContext.html) (also used by `onTake`, `onRundownActivate`, adlib actions, etc.)
