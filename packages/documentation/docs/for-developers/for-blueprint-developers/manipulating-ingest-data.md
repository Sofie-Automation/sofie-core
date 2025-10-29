# Manipulating Ingest Data

In Sofie we receive the rundown from an NRCS in the form of the `IngestRundown`, `IngestSegment` and `IngestPart` types. ([Source Code](https://github.com/Sofie-Automation/sofie-core/blob/master/packages/shared-lib/src/peripheralDevice/ingest.ts))
These are passed into the `getRundown` or `getSegment` blueprints methods to transform them into a Rundown that Sofie can display and play.

At times it can be useful to manipulate this data before it gets passed into these methods. This wants to be done before `getSegment` in order to limit the scope of the re-generation needed. We could have made it so that `getSegment` is able to view the whole `IngestRundown`, but that would mean that any change to the `IngestRundown` would require re-generating every segment. This would be costly and could have side effects.

A new method `processIngestData` was added to transform the `NRCSIngestRundown` into a `SofieIngestRundown`. The types of the two are the same, so implementing the `processIngestData` method is optional, with the default being to pass through the NRCS rundown unchanged. (There is an exception here for MOS, which is explained below).

The basic implementation of this method which simply propogates nrcs changes is:

```ts
function processIngestData(
	context: IProcessIngestDataContext,
	mutableIngestRundown: MutableIngestRundown<any, any, any>,
	nrcsIngestRundown: IngestRundown,
	previousNrcsIngestRundown: IngestRundown | undefined,
	changes: NrcsIngestChangeDetails | UserOperationChange
) {
	if (changes.source === 'ingest') {
		blueprintContext.defaultApplyIngestChanges(mutableIngestRundown, nrcsIngestRundown, changes)
	}
}
```

In this method, the key part is the `mutableIngestRundown` which is the `IngestRundown` that will get used for `getRundown` and `getSegment` later. It is a class with various mutator methods which allows Sofie to cheaply check what has changed and know what needs to be regenerated. (We did consider performing deep diffs, but were concerned about the cost of diffing these very large rundown objects).  
This object internally contains an `IngestRundown`.

The `nrcsIngestRundown` parameter is the full `IngestRundown` as seen by the NRCS. The `previousNrcsIngestRundown` parameter is the `nrcsIngestRundown` from the previous call. This is to allow you to perform any comparisons between the data that may be useful.

The `changes` object is a structure that defines what the NRCS provided changes for. The changes have already been applied onto the `nrcsIngestRundown`, this provides a description of what/where the changes were applied to.

Finally, the `blueprintContext.defaultApplyIngestChanges` call is what performs the 'magic'. Inside of this it is interpreting the `changes` object, and calling the appropriate methods on `mutableIngestRundown`. It is expected that this logic should be able to handle most use cases, but there may be some where they need something custom, so it is completely possible to reimplement inside blueprints.

So far this has ignored that the `changes` object can be of type `UserOperationChange`; this is explained below.

## Modifying NRCS Ingest Data

MOS does not have Segments, to handle this Sofie creates a Segment and Part for each MOS Story, expecting them to be grouped later if needed.

In the past Sofie has had a hardcoded grouping logic, based on how NRK define this as a prefix in the Part names. Obviously this doesn't work for everyone, so this needed to be made more customisable. (This is still the default behaviour when `processIngestData` is not implemented)

To perform the NRK grouping behaviour the following implementation can be used:

```ts
function processIngestData(
	context: IProcessIngestDataContext,
	mutableIngestRundown: MutableIngestRundown<any, any, any>,
	nrcsIngestRundown: IngestRundown,
	previousNrcsIngestRundown: IngestRundown | undefined,
	changes: NrcsIngestChangeDetails | UserOperationChange
) {
	if (changes.source === 'ingest') {
		// Group parts by interpreting the slug to be in the form `SEGMENTNAME;PARTNAME`
		const groupedResult = context.groupMosPartsInRundownAndChangesWithSeparator(
			nrcsIngestRundown,
			previousNrcsIngestRundown,
			ingestRundownChanges.changes,
			';' // Backwards compatibility
		)

		context.defaultApplyIngestChanges(
			mutableIngestRundown,
			groupedResult.nrcsIngestRundown,
			groupedResult.ingestChanges
		)
	}
}
```

There is also a helper method for doing your own logic:

```ts
function processIngestData(
	context: IProcessIngestDataContext,
	mutableIngestRundown: MutableIngestRundown<any, any, any>,
	nrcsIngestRundown: IngestRundown,
	previousNrcsIngestRundown: IngestRundown | undefined,
	changes: NrcsIngestChangeDetails | UserOperationChange
) {
	if (changes.source === 'ingest') {
		// Group parts by some custom logic
		const groupedResult = context.groupPartsInRundownAndChanges(
			nrcsIngestRundown,
			previousNrcsIngestRundown,
			ingestRundownChanges.changes,
			(segments) => {
				// TODO - perform the grouping here
				return segmentsAfterMyChanges
			}
		)

		context.defaultApplyIngestChanges(
			mutableIngestRundown,
			groupedResult.nrcsIngestRundown,
			groupedResult.ingestChanges
		)
	}
}
```

Both of these return a modified `nrcsIngestRundown` with the changes applied, and a new `changes` object which is similarly updated to match the new layout.

You can of course do any portions of this yourself if you desire.

## User Edits

In some cases, it can be beneficial to allow the user to perform some editing of the Rundown from within the Sofie UI. AdLibs and AdLib Actions can allow for some of this to be done in the current and next Part, but this is limited and doesn't persist when re-running the Part.

The idea here is that the UI will be given some descriptors on operations it can perform, which will then make calls to `processIngestData` so that they can be applied to the IngestRundown. Doing it at this level allows things to persist and for decisions to be made by blueprints over how to merge the changes when an update for a Part is received from the NRCS.

This page doesn't go into how to define the editor for the UI, just how to handle the operations.

There are a few Sofie defined definitions of operations, but it is also expected that custom operations will be defined. You can check the Typescript types for the builtin operations that you might want to handle.

For example, it could be possible for Segments to be locked, so that any NRCS changes for them are ignored.

```ts
function processIngestData(
	context: IProcessIngestDataContext,
	mutableIngestRundown: MutableIngestRundown<any, any, any>,
	nrcsIngestRundown: IngestRundown,
	previousNrcsIngestRundown: IngestRundown | undefined,
	changes: NrcsIngestChangeDetails | UserOperationChange
) {
	if (changes.source === 'ingest') {
		for (const segment of mutableIngestRundown.segments) {
			delete ingestRundownChanges.changes.segmentChanges[segment.externalId]
			// TODO - does this need to revert nrcsIngestRundown too?
		}

		blueprintContext.defaultApplyIngestChanges(mutableIngestRundown, nrcsIngestRundown, changes)
	} else if (changes.source === 'user') {
		if (changes.operation.id === 'lock-segment') {
			mutableIngestRundown.getSegment(changes.operationTarget.segmentExternalId)?.setUserEditState('locked', true)
		}
	}
}
```
