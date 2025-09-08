# Lookahead

Lookahead allows Sofie to look into future Parts and Pieces, in order to preload or preview what is coming up. The aim is to fill in the gaps between your TimelineObjects with lookahead versions of these objects.  
In this way, it can be used to provide functionality such as an AUX on your vision mixer showing the next cut, or to load the next clip into the media player.

## Defining

Lookahead can be enabled by configuring a few properties on a mapping:

```ts
/** What method core should use to create lookahead objects for this layer */
lookahead: LookaheadMode
/** The minimum number lookahead objects to create from future parts for this layer. Default = 1 */
lookaheadDepth?: number
/** Maximum distance to search for lookahead. Default = undefined */
lookaheadMaxSearchDistance?: number
```

With `LookaheadMode` defined as:

```ts
export enum LookaheadMode {
	/**
	 * Disable lookahead for this layer
	 */
	NONE = 0,
	/**
	 * Preload content with a secondary layer.
	 * This requires support from the TSR device, to allow for preloading on a resource at the same time as it being on air.
	 * For example, this allows for your TimelineObjects to control the foreground of a CasparCG layer, with lookahead controlling the background of the same layer.
	 */
	PRELOAD = 1,
	/**
	 * Fill the gaps between the planned objects on a layer.
	 * This is the primary lookahead mode, and appears to TSR devices as a single layer of simple objects.
	 */
	WHEN_CLEAR = 3,
}
```

If undefined, `lookaheadMaxSearchDistance` currently has a default distance of 10 parts. This number was chosen arbitrarily, and could change in the future. Be careful when choosing a distance to not set it too high. All the Pieces from the parts being searched have to be loaded from the database, which can come at a noticable cost.

If you are doing [AB Playback](./ab-playback.md), or performing some other processing of the timeline in `onTimelineGenerate`, you may benefit from increasing the value of `lookaheadDepth`. In the case of AB Playback, you will likely want to set it to the number of players available in your pool.

Typically, TimelineObjects do not need anything special to support lookahead, other than a sensible `priority` value. Lookahead objects are given a priority between `0` and `0.1`. Generally, your baseline objects should have a priority of `0` so that they are overridden by lookahead, and any objects from your Parts and Pieces should have a priority of `1` or higher, so that they override lookahead objects.

If there are any keyframes on TimelineObjects that should be preserved when being converted to a lookahead object, they will need the `preserveForLookahead` property set.

## How it works

Lookahead is calculated while the timeline is being built, and searches based on the playhead, rather than looking at the planned Parts.

The searching operates per-layer first looking at the current PartInstance, then the next PartInstance and then any Parts after the next PartInstance in the rundown. Any Parts marked as `invalid` or `floated` are ignored. This is what allows lookahead to be dynamic based on what the User is doing and intending to play.

It is searching Parts in that order, until it has either searched through the `lookaheadMaxSearchDistance` number of Parts, or has found at least `lookaheadDepth` future timeline objects.

Any pieces marked as `pieceType: IBlueprintPieceType.InTransition` will be considered only if playout intends to use the transition.  
If an object is found in both a normal piece with `{ start: 0 }` and in an InTransition piece, then the objects from the normal piece will be ignored.

These objects are then processed and added to the timeline. This is done in one of two ways:

1. As timed objects.  
   If the object selected for lookahead is already on the timeline (it is in the current part, or the next part and autonext is enabled), then timed lookahead objects are generated. These objects are to fill in the gaps, and get their `enable` object to reference the objects on the timeline that they are filling between.
   The `lookaheadDepth` setting of the mapping is ignored for these objects.

2. As future objects.  
   If the object selected for lookahead is not on the timeline, then simpler objects are generated. Instead, these get an enable of either `{ while: '1' }`, or set to start after the last timed object on that layer. This lets them fill all the time after any other known objects.  
    The `lookaheadDepth` setting of the mapping is respected for these objects, with this number defining the **minimum** number future objects that will be produced. These future objects are inserted with a decreasing `priority`, starting from 0.1 decreasing down to but never reaching 0.  
    When using the `WHEN_CLEAR` lookahead mode, all but the first will be set as `disabled`, to ensure they aren't considered for being played out. These `disabled` objects can be used by `onTimelineGenerate`, or they will be dropped from the timeline if left `disabled`.  
    When there are multiple future objects on a layer, only the first is useful for playout directly, but the others are often utilised for [AB Playback](./ab-playback.md)

Some additional changes done when processing each lookahead timeline object:

- The `id` is processed to be unique
- The `isLookahead` property is set as true
- If the object has any keyframes, any not marked with `preserveForLookahead` are removed
- The object is removed from any group it was contained within
- If the lookahead mode used is `PRELOAD`, then the layer property is changed, with the `lookaheadForLayer` property set to indicate the layer it is for.

The resulting objects are appended to the timeline and included in the call to `onTimelineGenerate` and the [AB Playback](./ab-playback.md) resolving.

## Advanced Scenarios

Because the lookahead objects are included in the timeline to `onTimelineGenerate`, this gives you the ability to make changes to the lookahead output.

[AB Playback](./ab-playback.md) started out as being implemented inside of `onTimelineGenerate` and relies on lookahead objects being produced before reassigning them to other mappings.

If any objects found by lookahead have a class `_lookahead_start_delay`, they will be given a short delay in their start time. This is a hack introduced to workaround a timing issue. At some point this will be removed once a proper solution is found.

Sometimes it can be useful to have keyframes which are only applied when in lookahead. That can be achieved by setting `preserveForLookahead`, making the keyframe be disabled, and then re-enabling it inside `onTimelineGenerate` at the correct time.

It is possible to implement a 'next' AUX on your vision mixer by:

- Setup this mapping with `lookaheadDepth: 1` and `lookahead: LookaheadMode.WHEN_CLEAR`
- Each Part creates a TimelineObject on this mapping. Crucially, these have a priority of 0.
- Lookahead will run and will insert its objects overriding your predefined ones (because of its higher priority). Resulting in the AUX always showing the lookahead object.
