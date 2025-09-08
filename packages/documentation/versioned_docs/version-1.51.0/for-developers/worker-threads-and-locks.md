---
title: Worker Threads & Locks
sidebar_position: 9
---

Starting with v1.40.0 (Release 40), the core logic of Sofie is split across
multiple threads. This has been done to minimise performance bottlenecks such as ingest changes delaying takes. In its
current state, it should not impact deployment of Sofie.

In the initial implementation, these threads are run through [threadedClass](https://github.com/nytamin/threadedclass)
inside of Meteor. As Meteor does not support the use of `worker_threads`, and to allow for future separation, the
`worker_threads` are treated and implemented as if they are outside of the Meteor ecosystem. The code is isolated from
Meteor inside of `packages/job-worker`, with some shared code placed in `packages/corelib`.

Prior to v1.40.0, there was already a work-queue of sorts in Meteor. As such the functions were defined pretty well to
translate across to being on a true work queue. For now this work queue is still in-memory in the Meteor process, but we
intend to investigate relocating this in a future release. This will be necessary as part of a larger task of allowing
us to scale Meteor for better resiliency. Many parts of the worker system have been designed with this in mind, and so
have sufficient abstraction in place already.

### The Worker

The worker process is designed to run the work for one or more studios. The initial implementation will run for all
studios in the database, and is monitoring for studios to be added or removed.

For each studio, the worker runs 3 threads:

1. The Studio/Playout thread. This is where all the playout operations are executed, as well as other operations that
   require 'ownership' of the Studio
2. The Ingest thread. This is where all the MOS/Ingest updates are handled and fed through the bluerpints.
3. The events thread. Some low-priority tasks are pushed to here. Such as notifying ENPS about _the yellow line_, or the
   Blueprints methods used to generate External-Messages for As-Run Log.

In future it is expected that there will be multiple ingest threads. How the work will be split across them is yet to be
determined

### Locks

At times, the playout and ingest threads both need to take ownership of `RundownPlaylists` and `Rundowns`.

To facilitate this, there are a couple of lock types in Sofie. These are coordinated by the parent thread in the worker
process.

#### PlaylistLock

This lock gives ownership of a specific `RundownPlaylist`. It is required to be able to load a `PlayoutModel`, and
must be held during other times where the `RundownPlaylist` is modified or is expected to not change.

This lock must be held while writing any changes to either a `RundownPlaylist` or any `Rundown` that belong to the
`RundownPlaylist`. This ensures that any writes to MongoDB are atomic, and that Sofie doesn't start performing a
playout operation halfway through an ingest operation saving.

#### RundownLock

This lock gives ownership of a specific `Rundown`. It is required to be able to load a `IngestModel`, and must held
during other times where the `Rundown` is modified or is expected to not change.

:::caution
It is not allowed to aquire a `RundownLock` while inside of a `PlaylistLock`. This is to avoid deadlocks, as it is very
common to aquire a `PlaylistLock` inside of a `RundownLock`
:::
