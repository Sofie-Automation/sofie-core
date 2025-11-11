---
title: Sync Ingest Changes
---

Since PartInstances and PieceInstances were added to Sofie, the default behaviour in Sofie is to not propogate any ingest changes from a Part onto its PartInstances.

This is a safety net as without a detailed understanding of the Part and the change, we can't know whether it is safe to make on air. Without this, it would be possible for the user to change a clip name in the NRCS, and for Sofie to happily propogate that could result in a sudden change of clip mid sentence, or black if the clip needed to be copied to the playout server. This gets even more complicated when we consider that an adlib-action could have already modified a PartInstance, with changes that should likely not be overwritten with the newly ingested Part.

Instead, this propogation can be implemented by a ShowStyle blueprint in the `syncIngestUpdateToPartInstance` method, in this way the implementation can be tailored to understand the change and its potential impact. This method is able to update the previous, current and next PartInstances. Any PartInstances older than the previous is no longer being used on the timeline so is now simply a record of how it was played and updating it would have no benefit. Sofie never has any further than the next PartInstance generated, so for any Part after that the Part is all that exists for it, so any changes will be used when it becomes the next.

In this blueprint method, you are able to update almost any of the properties that are available to you both during ingest, and during adlib actions. It is possible the leave the Part in a broken state after this, so care must be taken to ensure it is not. If the call to your method throws an uncaught error, the changes you have made so far will be discarded but the rest of the ingest operation will continue as normal.

### Tips

- You should make use of the `metaData` fields on each Part and Piece to help work out what has changed. At NRK, we store the parsed ingest data (after converting the MOS to an intermediary json format) for the Part here, so that we can do a detailed diff to figure out whether a change is safe to accept.

- You should track in `metaData` whether a part has been modified by an adlib-action in a way that makes this sync unsafe.

- At NRK, we differentiate the Pieces into `primary`, `secondary`, `adlib`. This allows us to control the updates more granularly.

- `newData.part` will be `undefined` when the PartInstance is orphaned. Generally, it's useful to differentiate the behavior of the implementation of this function based on `existingPartInstance.partInstance.orphaned` state

- `playStatus: previous` means that the currentPartInstance is `orphaned: adlib-part` and thus possibly depends on an already past PartInstance for some of it's properties. Therefore the blueprint is allowed to modify the most recently played non-adlibbed PartInstance using ingested data.
