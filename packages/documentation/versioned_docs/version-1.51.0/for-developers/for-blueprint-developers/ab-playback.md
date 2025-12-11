# AB Playback

:::info
Prior to 1.50 of Sofie, this was implemented in Blueprints and not natively in Sofie-core
:::

_AB Playback_ is a common technique for clip playback. The aim is to be able to play multiple clips back to back, alternating which player is used for each clip.  
At first glance it sounds simple to handle, but it quickly becomes complicated when we consider the need to allow users to run adlibs and that the system needs to seamlessly update pre-programmed clips when this happens.

To avoid this problem, we take an approach of labelling pieces as needing an AB assignment and leaving timeline objects to have some unresolved values during the ingest blueprint operations, and we perform the AB resolving when building the timeline for playout.

There are other challenges to the resolving to think about too, which make this a challenging area to tackle, and not something that wants to be considered when starting out with blueprints. Some of these challenges are:

- Users get confused if the player of a clip changes without a reason
- Reloading an already loaded clip can be costly, so should be avoided when possible
- Adlibbing a clip, or changing what Part is nexted can result in needing to move what player a clip has assigned
- Postroll or preroll is often needed
- Some studios can have less players available than ideal. (eg, going back to back between two clips, and a clip is playing on the studio monitor)

## Defining Piece sessions

An AB-session is a request for an AB player for the lifetime of the object or Piece. The resolver operates on these sessions, to identify when players are needed and to identify which objects and Pieces are linked and should use the same Player.

In order for the AB resolver to know what AB sessions there are on the timeline, and how they all relate to each other, we define `abSessions` properties on various objects when defining Pieces and their content during the `getSegment` blueprint method.

The AB resolving operates by looking at all the Pieces on the timeline, and plotting all the requested abSessions out in time. It will then iterate through each of these sessions in time order and assign them in order to the available players.  
Note: The sessions of TimelineObjects are not considered at this point, except for those in lookahead.

Both Pieces and TimelineObjects accept an array of AB sessions, and are capable of using multiple AB pools on the same object. Eg, choosing a clip player and the DVE to play it through.

:::warning
The sessions of TimelineObjects are not considered during the resolver stage, except for lookahead objects.  
If a TimelineObject has an `abSession` set, its parent Piece must declare the same session.
:::

For example:

```ts
const partExternalId = 'id-from-nrcs'
const piece: Piece = {
	externalId: partExternalId,
	name: 'My Piece',

	abSessions: [{
		sessionName: partExternalId,
		poolName: 'clip'
	}],

	...
}
```

This declares that this Piece requires a player from the 'clip' pool, with a unique sessionName.

:::info
The `sessionName` property is an identifier for a session within the Segment.  
Any other Pieces or TimelineObjects that want to share the session should use the same sessionName. Unrelated sessions must use a different name.
:::

## Enabling AB playback resolving

To enable AB playback for your blueprints, the `getAbResolverConfiguration` method of a ShowStyle blueprint must be implemented. This informs Sofie that you want the AB playback logic to run, and configures the behaviour.

A minimal implementation of this is:

```ts
getAbResolverConfiguration: (context: IShowStyleContext): ABResolverConfiguration => {
	return {
		resolverOptions: {
			idealGapBefore: 1000,
			nowWindow: 2000,
		},
		pools: {
			clip: [1, 2],
		},
	}
}
```

The `resolverOptions` property defines various configuration that will affect how sessions are assigned to players.  
The `pools` property defines the AB pools in your system, along with the ids of the players in the pools. These do not have to be sequential starting from 1, and can be any numbers you wish. The order used here will define the order the resolver will assign to.

## Updating the timeline from the assignments

There are 3 possible strategies for applying the assignments to timeline objects. The applying and ab-resolving is done just before `onTimelineGenerate` from your blueprints is called.

### TimelineObject Keyframes

The simplest approach is to use timeline keyframes, which can be labelled as belong to an abSession. These keyframes must be generated during ingest.

This strategy works best for changing inputs on a video-mixer or other scenarios where a property inside of a timeline object needs changing.

```ts
let obj = {
	id: '',
	enable: { start: 0 },
	layer: 'atem_me_program',
	content: {
		deviceType: TSR.DeviceType.ATEM,
		type: TSR.TimelineContentTypeAtem.ME,
		me: {
			input: 0, // placeholder
			transition: TSR.AtemTransitionStyle.CUT,
		},
	},
	keyframes: [
		{
			id: `mp_1`,
			enable: { while: '1' },
			disabled: true,
			content: {
				input: 10,
			},
			preserveForLookahead: true,
			abSession: {
				pool: 'clip',
				index: 1,
			},
		},
		{
			id: `mp_2`,
			enable: { while: '1' },
			disabled: true,
			content: {
				input: 11,
			},
			preserveForLookahead: true,
			abSession: {
				pool: 'clip',
				index: 2,
			},
		},
	],
	abSessions: [
		{
			pool: 'clip',
			name: 'abcdef',
		},
	],
}
```

This object demonstrates how keyframes can be used to perform changes based on an assigned ab player session. The object itself must be labelled with the `abSession`, in the same way as the Piece is.  
Each keyframe can be labelled with an `abSession`, with only one from the pool being left active. If `disabled` is set on the keyframe, that will be unset, and the other keyframes for the pool will be removed.

Setting `disabled: true` is not strictly necessary, but ensures that the keyframe will be inactive in case that ab-pool is not processed.  
In this example we are setting `preserveForLookahead` so that the keyframes are present on lookahead objects. If not set, then the keyframes will be removed by lookahead.

### TimelineObject layer changing

Another apoproach is to move objects between timeline layers. For example, player 1 is on CasparCG channel 1, with player 2 on CasparCG channel 2. This requires a different mapping for each layer.

This strategy works best for playing a clip, where the whole object needs to move to different mappings.

To enable this, the `ABResolverConfiguration` object returned from `getAbResolverConfiguration` can have a set of rules defined with the `timelineObjectLayerChangeRules` property.

For example:

```ts
getAbResolverConfiguration: (context: IShowStyleContext): ABResolverConfiguration => {
	return {
		resolverOptions: {
			idealGapBefore: 1000,
			nowWindow: 2000,
		},
		pools: {
			clip: [1, 2],
		},
		timelineObjectLayerChangeRules: {
			['casparcg_player_clip_pending']: {
				acceptedPoolNames: [AbSessionPool.CLIP],
				newLayerName: (playerId: number) => `casparcg_player_clip_${playerId}`,
				allowsLookahead: true,
			},
		},
	}
}
```

And a timeline object:

```ts
const clipObject: TimelineObjectCoreExt<> = {
	id: '',
	enable: { start: 0 },
	layer: 'casparcg_player_clip_pending',
	content: {
		deviceType: TSR.DeviceType.CASPARCG,
		type: TSR.TimelineContentTypeCasparCg.MEDIA,
		file: 'AMB',
	},
	abSessions: [
		{
			pool: 'clip',
			name: 'abcdef',
		},
	],
}
```

This will result in the timeline object being moved to `casparcg_player_clip_1` if the clip is assigned to player 1, or `casparcg_player_clip_2` if the clip is assigned to player 2.

This is also compatible with lookahead. To do this, the `casparcg_player_clip_pending` mapping should be created with the lookahead configuration set there, this should be of type `ABSTRACT`. The AB resolver will detect this lookahead object and it will get an assignment when a player is available. Lookahead should not be enabled for the `casparcg_player_clip_1` and other final mappings, as lookahead is run before AB so it will not find any objects on those layers.

### Custom behaviour

Sometimes, something more complex is needed than what the other options allow for. To support this, the `ABResolverConfiguration` object has an optional property `customApplyToObject`. It is advised to use the other two approaches when possible.

```ts
getAbResolverConfiguration: (context: IShowStyleContext): ABResolverConfiguration => {
	return {
		resolverOptions: {
			idealGapBefore: 1000,
			nowWindow: 2000,
		},
		pools: {
			clip: [1, 2],
		},
		customApplyToObject: (
			context: ICommonContext,
			poolName: string,
			playerId: number,
			timelineObject: OnGenerateTimelineObj<TSR.TSRTimelineContent>
		) => {
			// Your own logic here

			return false
		},
	}
}
```

Inside this function you are able to make any changes you like to the timeline object.  
Return true if the object was changed, or false if it is unchanged. This allows for logging whether Sofie failed to modify an object for an ab assignment.

For example, we use this to remap audio channels deep inside of some Sisyfos timeline objects. It is not possible for us to do this with keyframes due to the keyframes being applied with a shallow merge for the Sisyfos TSR device.
