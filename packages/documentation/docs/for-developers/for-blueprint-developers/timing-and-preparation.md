# Timing and Preparation Concepts

Sofie uses several complementary techniques to ensure smooth, glitch-free playout. Understanding how these work together—especially with adlibs—is crucial for effective blueprint development.

## Overview

When content goes to air, multiple timing challenges must be addressed:

- **Device latency**: Some devices take frames or milliseconds to respond to commands
- **Content loading**: Media needs to be loaded into players before playback
- **Synchronization**: Multiple devices must change state simultaneously for clean transitions
- **Dynamic changes**: Operators triggering adlibs bypasses pre-planned preparation

Sofie addresses these through a layered approach:

1. **Lookahead** - Prepares upcoming content during previous parts
2. **Pre-roll** - Compensates for device/content latency
3. **Preliminary** - Sends commands early for timing compensation
4. **Transitions** - Manages smooth handoffs between parts

## Lookahead: Preparing Future Content

**Purpose**: Load and prepare content from future parts while earlier content is playing.

**How it works**: During timeline generation, Sofie searches forward through upcoming parts, finds content that will be needed, and creates "lookahead" timeline objects. These objects can:
- Preload videos into players (using `LookaheadMode.PRELOAD` for background layers)
- Show upcoming content on preview monitors (using `LookaheadMode.WHEN_CLEAR`)
- Assign AB playback servers in advance

**When it's effective**:
- Planned, pre-programmed content in the rundown
- Following normal part progression (next/take workflow)
- Content that doesn't change due to operator intervention

**When it's bypassed**:
- **Adlibs**: When operators trigger adlib pieces or actions, lookahead can't predict them
- Rundown changes: Reordering or modifying parts
- Dynamic nexting: Jumping to unexpected parts

**Example**: A VT clip in Part 5 can be loaded into CasparCG during Part 4, so when Part 5 is taken, the clip is already buffered and ready to play.

## Pre-roll: Compensating for Latency

**Purpose**: Start pieces early to compensate for the time devices need before content becomes visible/audible.

**Set via**: `prerollDuration` property on Pieces (in milliseconds)

**Common use cases**:

### Video Playback Latency
Even when a clip is preloaded via lookahead, there's often latency between issuing a PLAY command and frames appearing on SDI:

```typescript
// VT piece with preroll to compensate for CasparCG playback latency
const vtPiece: IBlueprintPiece = {
  externalId: 'vt_clip_001',
  name: 'VT: Interview',
  prerollDuration: 200, // CasparCG typically needs 5-8 frames (200ms at 25fps)
  content: {
    timelineObjects: [
      {
        id: 'caspar_play',
        layer: 'caspar_player_1',
        enable: { start: 0 },
        content: {
          deviceType: TSR.DeviceType.CASPARCG,
          type: TSR.TimelineContentTypeCasparCg.VIDEO,
          file: 'interview.mxf'
        }
      }
    ]
  }
}
```

This ensures that when the vision mixer cuts to the CasparCG input, frames are already flowing.

### Instant Adlibs with Keyframes
For adlibs that execute immediately (bypassing lookahead), preroll can load content while using keyframes to sync playback:

```typescript
// vMix internally - loading and playback have different timing needs
const adlibPiece: IBlueprintAdLibPiece = {
  externalId: 'adlib_vt_breaking',
  name: 'Breaking News VT',
  prerollDuration: 1000, // Time needed to load the file
  content: {
    timelineObjects: [
      {
        id: 'vmix_input',
        enable: { start: 0 },
        layer: 'vmix_input_1',
        content: {
          deviceType: TSR.DeviceType.VMIX,
          type: TSR.TimelineContentTypeVMix.INPUT,
          input: 1,
          filePath: 'breaking_news.mp4',
          playing: false, // Don't play immediately
        },
        keyframes: [
          {
            id: 'start_playback',
            enable: { start: 1000 }, // Start after loading completes
            content: {
              playing: true // Now start playback, synced with cut
            }
          }
        ]
      }
    ]
  }
}
```

### Latency Variations by Setup

Different studio configurations require different preroll values:

| Setup | Typical Preroll | Reason |
|-------|----------------|--------|
| CasparCG → ATEM | 200-300ms | CasparCG playback start latency + cabling |
| vMix internal | 0ms for playback, varies for loading | Play command is instant if loaded; use loading time for preroll |
| vMix → ATEM | 40-80ms | Frame buffering + cabling |
| Quantel server | 0-40ms | Often instant, may need preliminary instead |

**Key insight from conversation**: "you can assume that a play command is instantaneous (same latency as other commands like Cut)" only when the video player and switcher are the same software (like vMix), because there's no extra cabling and buffering. With external equipment, you must compensate.

### Lookahead + Preroll Interaction

**Open question**: When lookahead has successfully preloaded content, can preroll be shortened or eliminated?

Currently, blueprints must set preroll assuming worst-case (no lookahead). Future enhancements might allow:
- Devices tracking loaded state and adjusting timing
- Conditional preroll based on whether lookahead succeeded
- Blueprint access to lookahead state during timeline generation

## Preliminary: Early Command Execution

**Purpose**: Send device commands earlier than their scheduled time to compensate for command processing delays.

**Set via**: `preliminary` property on commands (in TSR device integrations, not typically in blueprints)

**Measured in**: Milliseconds before the scheduled timeline time

**Difference from preroll**:
- **Preroll**: Adjusts when pieces start on the timeline (visible in Sofie UI)
- **Preliminary**: Adjusts when commands are sent to devices (hidden from users)

**Example use**: Quantel servers might need commands 1000ms early to guarantee frame-accurate execution:

```typescript
// In TSR device integration (not blueprint code)
{
  command: {
    type: QuantelCommandType.PLAYCLIP,
    clipId: 123
  },
  preliminary: 1000, // Send command 1 second early
  timelineObjId: 'clip_playback'
}
```

**When both are needed**: A piece might have both:
- `prerollDuration: 200` (start the piece 200ms early on timeline)
- Commands with `preliminary: 1000` (send those commands 1000ms before their timeline time)
- Net effect: Command sent 1200ms before intended playback point

## Transitions: Smooth Part Boundaries

Transitions provide visual continuity when moving between parts:

### In Transition
Delays new content while playing a transition effect:

```typescript
const part: IBlueprintPart = {
  externalId: 'part_b',
  inTransition: {
    blockTakeDuration: 1000,        // Block takes for 1 second
    previousPartKeepaliveDuration: 1000,  // Keep Part A alive for 1 second
    partContentDelayDuration: 500   // Delay Part B content by 500ms
  }
}
```

Normal pieces in Part B are delayed by `partContentDelayDuration`, while special pieces with `pieceType: IBlueprintPieceType.InTransition` play during the transition.

**Interaction with preroll**: Pieces in Part B still need their preroll time, which is added to the transition delay. The previous part extends to accommodate both.

### Out Transition
Keeps old content playing briefly after a take:

```typescript
const part: IBlueprintPart = {
  externalId: 'part_a',
  outTransition: {
    duration: 1000  // Keep Part A alive for 1 second after take
  }
}
```

Pieces with `pieceType: IBlueprintPieceType.OutTransition` play during this extension.

See [Part and Piece Timings](./part-and-piece-timings.mdx) for detailed timing interactions.

## Adlibs: The Dynamic Challenge

**Adlibs** (ad-lib pieces and actions) are operator-triggered content that bypasses normal planning:

### Why Adlibs Complicate Preparation

1. **No lookahead**: Can't predict what operators will trigger
2. **Immediate execution**: Often need content on-air within frames
3. **State disruption**: May invalidate lookahead that was prepared for other content

### Making Adlibs Work

**Strategy 1: Aggressive preroll**
```typescript
const adlibCamera: IBlueprintAdLibPiece = {
  name: 'Camera 3',
  prerollDuration: 0, // Vision mixer cuts are instant
  content: { /* ... */ }
}

const adlibVT: IBlueprintAdLibPiece = {
  name: 'Breaking News',
  prerollDuration: 1500, // Need time to load + buffer
  content: { /* ... */ }
}
```

**Strategy 2: Expected Packages**
Pre-copy frequently-used adlib media to local storage, so loading is faster:

```typescript
const adlibPiece: IBlueprintAdLibPiece = {
  name: 'Emergency VT',
  expectedPackages: [{
    _id: 'emergency_vt_package',
    type: ExpectedPackage.PackageType.MEDIA_FILE,
    content: { filePath: 'emergency.mxf' },
    // Package manager ensures this is local before rundown activates
  }],
  content: { /* ... */ }
}
```

**Strategy 3: Keep-alive infinites**
Use infinite pieces to keep certain content loaded:

```typescript
// In a part early in the rundown
const keepAlivePiece: IBlueprintPiece = {
  name: 'Preload Common Clips',
  lifespan: PieceLifespan.OutOnRundownEnd, // Stays loaded all rundown
  enable: { start: 0 },
  content: {
    timelineObjects: [
      {
        id: 'preload_breaking',
        layer: 'caspar_player_2_background', // Using background layer
        enable: { while: '1' },
        content: {
          deviceType: TSR.DeviceType.CASPARCG,
          type: TSR.TimelineContentTypeCasparCg.VIDEO,
          file: 'breaking_news_template.mxf',
          playing: false // Loaded but not playing
        }
      }
    ]
  }
}
```

**Strategy 4: Baseline timeline**
Studio baseline can keep devices in a ready state:

```typescript
// In studio blueprint getBaseline()
return {
  timelineObjects: [
    {
      id: 'preload_common_graphics',
      enable: { while: 1 },
      layer: 'caspar_graphics_background',
      content: {
        deviceType: TSR.DeviceType.CASPARCG,
        type: TSR.TimelineContentTypeCasparCg.TEMPLATE,
        templateType: 'html',
        name: 'common_lower_third',
        useStopCommand: false
      }
    }
  ]
}
```

## How Everything Works Together

### Planned Content Flow
1. **Ingest**: Rundown arrives with VT clips in parts
2. **Expected Packages**: Package Manager copies media to local storage
3. **Lookahead**: During Part A, lookahead finds VT in Part B, creates preload object
4. **Device loading**: CasparCG loads clip into background layer
5. **Take to Part B**: 
   - Part B timeline starts (with preroll offset)
   - CasparCG PLAY command sent (with preliminary offset if configured)
   - 200ms later (preroll compensates), video frames reach ATEM
   - ATEM cut executes, synchronized with video now flowing
6. **Transition**: In/out transitions provide smooth visual handoff if configured

### Adlib Flow
1. **Operator triggers**: Camera adlib during VT playback
2. **No lookahead**: Content wasn't predicted
3. **Preroll activates**: If camera switch has `prerollDuration: 0`, happens immediately
4. **Preliminary**: Any ATEM commands might use preliminary timing
5. **Timeline disruption**: Lookahead for Part B may be invalidated
6. **Re-lookahead**: Next timeline generation creates new lookahead based on current state

### VT Adlib Flow (complex)
1. **Operator triggers**: VT adlib during camera shot
2. **Preroll**: `prerollDuration: 1000` starts piece 1 second early
3. **Load command**: CasparCG LOAD sent immediately (via preliminary timing)
4. **Keyframe**: At `start: 1000`, PLAY command sent
5. **Synchronization**: Vision mixer cut happens at same moment as PLAY
6. **Result**: Clean cut to playing video

## Best Practices

### When to Use Each Technique

| Scenario | Lookahead | Preroll | Preliminary | Transitions |
|----------|-----------|---------|-------------|-------------|
| Planned VT in sequence | ✓ | ✓ | Maybe | Optional |
| Camera cuts | ✗ | Usually 0 | Rarely | Optional |
| Graphics | ✓ | Varies | Rarely | Rarely |
| VT adlib | ✗ | ✓ Required | Maybe | ✗ |
| Part transitions | ✓ | ✓ | Maybe | ✓ |

### Configuration Guidelines

1. **Measure your latencies**: Use test patterns and frame counting to determine actual device delays
2. **Set preroll conservatively**: Assume lookahead might fail (it won't for planned content, but keeps adlibs working)
3. **Test adlib paths**: Actually trigger adlibs to verify timing works without lookahead
4. **Consider all device chains**: Latency accumulates through cabling, converters, frame syncs
5. **Document your values**: Comment why specific preroll/preliminary values were chosen

### Common Pitfalls

**Relying only on lookahead**: Works great until an adlib breaks the flow.

**Insufficient preroll for adlibs**: Operators see glitches when triggering unprepared content.

**Confusing preroll and preliminary**: Preroll is visible in timeline, preliminary is device-internal.

**Not accounting for loading time**: vMix/CasparCG need time to load files, not just play them.

**Forgetting keyframe timing**: When using preroll for loading, remember to delay playback start via keyframes.

## Related Concepts

See the [Glossary](../glossary.md) for definitions of related terms:

- **Baseline Timeline** - Studio-level always-on device configuration
- **MakeReady** - Device initialization when rundowns activate  
- **Infinite Pieces** - Content that persists across part boundaries
- **Expected Packages** - Media pipeline ensuring files are ready
- **AB Playback** - Automatic player assignment for clip sequences

## Further Reading

- [Part and Piece Timings](./part-and-piece-timings.mdx) - Detailed timing mechanics
- [Lookahead](./lookahead.md) - Deep dive into lookahead configuration
- [AB Playback](./ab-playback.md) - Player assignment and management
