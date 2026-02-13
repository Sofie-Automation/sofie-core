---
title: Data Model
sidebar_position: 9
---

Sofie persists the majority of its data in a MongoDB database. This allows us to use Typescript friendly documents,
without needing to worry too much about the strictness of schemas, and allows us to watch for changes happening inside
the database as a way of ensuring that updates are reactive.

Data is typically pushed to the UI or the gateways through [Publications](./publications) over the DDP connection that Meteor provides.

## Collection Ownership

Each collection in MongoDB is owned by a different area of Sofie. In some cases, changes are also made by another area, but we try to keep this to a minimum.
In every case, any layout changes and any scheduled cleanup are performed by the Meteor layer for simplicity.

### Meteor

This category of collections is rather loosely defined, as it ends up being everything that doesn't belong somewhere else

This consists of anything that is configurable from the Sofie UI, anything needed solely for the UI and some other bits. Additionally, there are some collections which are populated by other portions of a Sofie system, such as by Package Manager, through an API over DDP.  
Currently, there is not a very clearly defined flow for modifying these documents, with the UI often making changes directly with minimal or no validation.

This includes:

- [Blueprints](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/Blueprint.ts)
- [Buckets](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/Bucket.ts)
- [CoreSystem](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/collections/CoreSystem.ts)
- [Evaluations](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/collections/Evaluations.ts)
- [ExternalMessageQueue](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/ExternalMessageQueue.ts)
- [ExpectedPackageWorkStatuses](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/ExpectedPackageWorkStatuses.ts)
- [MediaObjects](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/MediaObjects.ts)
- [MediaWorkFlows](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/collections/MediaWorkFlows.ts)
- [MediaWorkFlowSteps](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/collections/MediaWorkFlowSteps.ts)
- [PackageInfos](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/PackageInfos.ts)
- [PackageContainerPackageStatuses](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/PackageContainerPackageStatus.ts)
- [PackageContainerStatuses](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/PackageContainerStatus.ts)
- [PeripheralDeviceCommands](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/PeripheralDeviceCommand.ts)
- [PeripheralDevices](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/PeripheralDevice.ts)
- [RundownLayouts](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/collections/RundownLayouts.ts)
- [ShowStyleBase](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/ShowStyleBase.ts)
- [ShowStyleVariant](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/ShowStyleVariant.ts)
- [Snapshots](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/collections/Snapshots.ts)
- [Studio](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/Studio.ts)
- [TriggeredActions](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/collections/TriggeredActions.ts)
- [TranslationsBundles](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/collections/TranslationsBundles.ts)
- [UserActionsLog](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/collections/UserActionsLog.ts)
- [Users](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/collections/Users.ts)
- [Workers](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/lib/collections/Workers.ts)
- [WorkerThreads](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/WorkerThreads.ts)

### Ingest

This category of collections is owned by the ingest [worker threads](./worker-threads-and-locks.md), and models a Rundown based on how it is defined by the NRCS.

These collections are not exposed as writable in Meteor, and are only allowed to be written to by the ingest worker threads.
There is an exception to both of these; Meteor is allowed to write to it as part of migrations, and cleaning up old documents. While the playout worker is allowed to modify certain Segments that are labelled as being owned by playout.

The collections which are owned by the ingest workers are:

- [AdLibActions](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/AdLibActions.ts)
- [AdLibPieces](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/AdLibPieces.ts)
- [BucketAdLibActions](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/BucketAdLibActions.ts)
- [BucketAdLibPieces](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/BucketAdLibPieces.ts)
- [ExpectedPackages](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/ExpectedPackages.ts)
- [ExpectedPlayoutItems](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/ExpectedPlayoutItems.ts)
- [IngestDataCache](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/IngestDataCache.ts)
- [Parts](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/Parts.ts)
- [Pieces](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/Pieces.ts)
- [RundownBaselineAdLibActions](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/RundownBaselineAdLibActions.ts)
- [RundownBaselineAdLibPieces](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/RundownBaselineAdLibPieces.ts)
- [RundownBaselineObjects](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/RundownBaselineObjects.ts)
- [Rundowns](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/Rundowns.ts)
- [Segments](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/Segments.ts)

These collections model a Rundown from the NRCS in a Sofie form. Almost all of these contain documents which are largely generated by blueprints.
Some of these collections are used by Package Manager to initiate work, while others form a view of the Rundown for the users, and are used as part of the model for playout.

### Playout

This category of collections is owned by the playout [worker threads](./worker-threads-and-locks.md), and is used to model the playout of a Rundown or set of Rundowns.

During the final stage of an ingest operation, there is a period where the ingest worker acquires a `PlaylistLock`, so that it can ensure that the RundownPlaylist the Rundown is a part of is updated with any necessary changes following the ingest operation. During this lock, it will also attempt to [sync any ingest changes](./for-blueprint-developers/sync-ingest-changes) to the PartInstances and PieceInstances, if supported by the blueprints.

As before, Meteor is allowed to write to these collections as part of migrations, and cleaning up old documents.

The collections which can only be modified inside of a `PlaylistLock` are:

- [PartInstances](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/PartInstances.ts)
- [PieceInstances](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/PieceInstances.ts)
- [RundownPlaylists](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/RundownPlaylists.ts)
- [Timelines](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/Timelines.ts)
- [TimelineDatastore](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/TimelineDatastore.ts)

These collections are used in combination with many of the ingest collections, to drive playout.

#### RundownPlaylist

RundownPlaylists are a Sofie invention designed to solve one problem; in some NRCS it is beneficial to build a show across multiple Rundowns, which should then be concatenated for playout.
In particular, MOS has no concept of a Playlist, only Rundowns, and it was here where we need to be able to combine multiple Rundowns.

This functionality can be used to either break down long shows into manageable chunks, or to indicate a different type of show between the each portion.

Because of this, RundownPlaylists are largely missing from the ingest side of Sofie. We do not expose them in the ingest APIs, or do anything with them throughout the majority of the blueprints generating a Rundown.
Instead, we let the blueprints specify that a Rundown should be part of a RundownPlaylist by setting the `playlistExternalId` property, where multiple Rundowns in a Studio with the same id will be grouped into a RundownPlaylist.
If this property is not used, we automatically generate a RundownPlaylist containing the Rundown by itself.

It is during the final stages of an ingest operation, where the RundownPlaylist will be generated (with the help of blueprints), if it is necessary.
Another benefit to this approach, is that it allows for very cheaply and easily moving Rundowns between RundownPlaylists, even safely affecting a RundownPlaylist that is currently on air.

#### Part vs PartInstance and Piece vs PieceInstance

In the early days of Sofie, we had only Parts and Pieces, no PartInstances and PieceInstances.

This quickly became costly and complicated to handle cases where the user used Adlibs in Sofie. Some of the challenges were:

- When a Part is deleted from the NRCS and that part is on air, we don't want to delete it in Sofie immediately
- When a Part is modified in the NRCS and that part is on air, we may not want to apply all of the changes to playout immediately
- When a Part has finished playback and is set-as-next again, we need to make sure to discard any changes made by the previous playout, and restore it to as if was refreshly ingested (including the changes we ignored while it was on air)
- When creating an adlib part, we need to be sure that an ingest operation doesn't attempt to delete it, until playout is finished with it.
- After using an adlib in a part, we need to remove the piece it created when we set-as-next again, or reset the rundown
- When an earlier part is removed, where an infinite piece has spanned into the current part, we may not want to remove that infinite piece

Our solution to some of this early on was to not regenerate certain Parts when receiving ingest operations for them, and to defer it until after that Part was off air. While this worked, it was not optimal to re-run ingest operations like that while doing a take. This also required the blueprint api to generate a single part in each call, which we were starting to find limiting. This was also problematic when resetting a rundown, as that would often require rerunning ingest for the whole rundown, making it a notably slow operation.

At this point in time, Adlib Actions did not exist in Sofie. They are able to change almost every property of a Part of Piece that ingest is able to define, which makes the resetting process harder.

PartInstances and PieceInstances were added as a way for us to make a copy of each Part and Piece, as it was selected for playout, so that we could allow ingest without risking affecting playout, and to simplify the cleanup performed. The PartInstances and PieceInstances are our record of how the Rundown was played, which we can utilise to output metadata such as for chapter markers on a web player. In earlier versions of Sofie this was tracked independently with an `AsRunLog`, which resulted in odd issues such as having `AsRunLog` entries which referred to a Part which no longer existed, or whose content was very different to how it was played.

Later on, this separation has allowed us to more cleanly define operations as ingest or playout, and allows us to run them in parallel with more confidence that they won't accidentally wipe out each others changes. Previously, both ingest and playout operations would be modifying documents in the Piece and Part collections, making concurrent operations unsafe as they could be modifying the same Part or Piece.
