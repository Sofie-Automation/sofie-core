# Time of Day Pieces

Time of Day Pieces (some places it's refered to as Global Pieces and some places as Rundown Pieces) are pieces that belong to the entire Rundown rather than individual Parts. They enable content to be scheduled based on time of day instead of relative rundown timing.

## Purpose and Use Cases

A use case for Time of Day Pieces could be **pre-show automation**: automatically playing audiobeds, showing cameras with countdown graphics, or adding a graphics info at a precise time no matter what part the rundown is currently on.

### Pre-Show Countdown Example

News show starts at 2:00 PM. At 1:59:30 PM (30 seconds before), we want to:
- Play an audiobed (music/ambience)
- Show a camera with a countdown graphic
- Transition to the first part of the show when producer does a take

With Time of Day Pieces, we can schedule these elements based on the actual show start time, even if the operator is rehearsing earlier parts or the previous show ran long.

### Example Of Other Use Cases

Time of Day Pieces could also support:

- **Scheduled breaks**: Insert commercials or station IDs at exact times
- **Time-of-day graphics**: Display time-specific overlays like clocks at precise moments
- **News tickers**: Start/stop scrolling special text at specific times
- **Regulatory content**: Play mandatory content at legally required times
- **Virtual markers**: Use invisible pieces to stop infinite pieces at specific times

## Key Differences from Regular Pieces

| Property | Regular Pieces | Time of Day Pieces |
|----------|---------------|-------------------|
| Ownership | Part | Rundown |
| Timing | Relative to part/segment | Time of day |
| Lifespan | Various options | Always `OutOnRundownChange` |
| `enable.start` | Number or `'now'` | Number only (absolute timestamp) |
| `enable.isAbsolute` | Not applicable | Always `true` |

## Creating Time of Day Pieces in Blueprints

### Blueprint Return Structure

In your `ShowStyleBlueprintManifest.getRundown()` method, return the `globalPieces` array:

```typescript
import {
  ShowStyleBlueprintManifest,
  IBlueprintRundownPiece
} from '@sofie-automation/blueprints-integration'

export const manifest: ShowStyleBlueprintManifest = {
  // ... other manifest properties

  getRundown(context, ingestRundown) {
    const globalPieces: IBlueprintRundownPiece[] = [
      // Your time of day pieces here
    ]

    return {
      rundown: { /* rundown data */ },
      globalAdLibPieces: [],
      globalActions: [],
      globalPieces: globalPieces,  
      // Add your global pieces here
      baseline: { /* baseline data */ }
    }
  }
}
```

### Practical Example: Pre-Show Countdown

Here's a basic example of how a 30-second pre-show countdown with audiobed and camera could be implemented:

```typescript
import { IBlueprintRundownPiece } from '@sofie-automation/blueprints-integration'
import { DeviceType } from 'timeline-state-resolver-types'

function createPreShowCountdown(
  context,
  rundown,
  showStartTime: string  // e.g., '2025-03-04T14:00:00Z'
): IBlueprintRundownPiece[] {
  const pieces: IBlueprintRundownPiece[] = []
  const showStart = Date.parse(showStartTime)
  const countdownStart = showStart - 30000  // 30 seconds before show

  // 1. Audio bed (starts 30 seconds before show)
  pieces.push({
    externalId: 'pre_show_audiobed',
    name: 'Pre-Show Audio Bed (30s countdown)',
    enable: {
      start: countdownStart,
      duration: 30000,  // 30 seconds
      isAbsolute: true
    },
    sourceLayerId: 'studio_audio',
    outputLayerId: 'program',
    content: {
      timelineObjects: [
        {
          id: '',
          enable: { start: 0 },
          layer: 'audio_bed',
          content: {
            deviceType: DeviceType.Sisyfos,
            type: 'audio',
            name: 'pre_show_audiobed',
            data: {
              file: 'path/to/audiobed.mp3',
              volume: 0.8
            }
            // Your audio configuration
          }
        }
      ]
    },
    tags: ['pre-show', 'countdown']
  })

  // 2. Camera with countdown graphic
  pieces.push({
    externalId: 'pre_show_camera_countdown',
    name: 'Countdown Camera + Graphic',
    enable: {
      start: countdownStart,
      duration: 30000,
      isAbsolute: true
    },
    sourceLayerId: 'camera_program',
    outputLayerId: 'program',
    content: {
      timelineObjects: [
        // Camera input
        {
          id: '',
          enable: { start: 0 },
          layer: 'pgm_camera',
          content: {
            deviceType: DeviceType.ATEM,
            type: 'me',
            me: {
              input: 1,  // Camera 1
              transition: 'CUT'
            }
          }
        },
        // Countdown graphic overlay
        {
          id: '',
          enable: { start: 0 },
          layer: 'countdown_graphic',
          content: {
            deviceType: DeviceType.CASPARCG,
            type: 'template',
            name: 'countdown_30s',
            data: {
              targetTime: showStart,  // Countdown to show start
              showName: rundown.name
            }
          }
        }
      ]
    },
    tags: ['pre-show', 'countdown', 'camera']
  })

  return pieces
}

// Usage in getRundown():
export const manifest: ShowStyleBlueprintManifest = {
  getRundown(context, ingestRundown) {
    // Extract show start time from ingest data
    const showStartTime = ingestRundown.payload.expectedStart

    return {
      rundown: { /* rundown config */ },
      globalAdLibPieces: [],
      globalActions: [],
      globalPieces: createPreShowCountdown(context, ingestRundown, showStartTime),
      baseline: { /* baseline */ }
    }
  }
}
```

### Required Constraints

1. **Absolute Timing Only**:
   - `enable.isAbsolute` must be `true`
   - `enable.start` must be a number (milliseconds since Unix epoch), **NOT** `'now'`
   - Use `Date.parse()` or `new Date().getTime()` to generate timestamps

2. **Ownership**:
   - Pieces belong to the rundown, not parts
   - Cannot be associated with segments or parts
   - Stored with `startPartId: null` in the database

3. **Lifespan**:
   - The `lifespan` property is not settable in blueprints (omitted from interface)
   - Automatically forced to `PieceLifespan.OutOnRundownChange` during post-processing
   - Pieces persist until the rundown changes or is deactivated

4. **Piece Types**:
   - Cannot be transition pieces
   - `pieceType` is forced to `Normal` during processing
   - Cannot use `extendOnHold` (incompatible with rundown ownership)


## Processing and Timeline Integration

### Timeline Preparation

Time of Day Pieces are filtered based on a **prepare time window** before being added to the timeline:

- **Studio Setting**: `rundownGlobalPiecesPrepareTime` (default: 30000ms = 30 seconds)
- **Behavior**: Pieces starting more than 30 seconds in the future are excluded from the current timeline
- **Regeneration**: Timeline is automatically regenerated when pieces become active

This prevents cluttering the timeline with pieces that won't be needed soon.

### Priority and Layer Conflicts

When pieces collide on the same source layer:

1. **Absolute vs. Relative**: Absolute-timed pieces (Time of Day Pieces) take priority over relative-timed pieces
2. **Start Time**: Later starting pieces stop earlier ones
3. **Virtual Pieces**: Can cap other pieces without adding their own content

This is handled in `processAndPrunePieceInstanceTimings()` in the core timeline processor.

## Interaction with Infinite Pieces

### Baseline Infinites

Time of Day Pieces integrate with the infinite piece system:

- **Loading**: Global pieces are loaded as "baseline infinites" when a rundown is activated
- **Function**: Processed by `getBaselineInfinitesForPart()`
- **Marking**: Tagged with `infinite.fromPreviousPart: true`
- **Tracking**: Receive `infiniteInstanceId` and `infiniteInstanceIndex` for continuation

### Stopping Infinites with Virtual Pieces

A common pattern is using virtual Time of Day Pieces to stop infinite pieces at specific times:

```typescript
// Infinite lower third that runs continuously
const infiniteLowerThird: IBlueprintPiece = {
  externalId: 'lower_third_infinite',
  name: 'Continuous Lower Third',
  enable: { start: 0 },
  lifespan: PieceLifespan.OutOnRundownEnd,
  sourceLayerId: 'graphics_lower_third',
  outputLayerId: 'program',
  content: { /* timeline objects */ }
}

// Stop it at a specific time without showing anything else
const stopMarker: IBlueprintRundownPiece = {
  externalId: 'stop_lower_third_at_3pm',
  name: 'Stop Lower Third at 3 PM',
  enable: {
    start: Date.parse('2025-03-04T15:00:00Z'),
    isAbsolute: true
  },
  sourceLayerId: 'graphics_lower_third',  // Same layer
  outputLayerId: 'program',
  virtual: true,  // No content, just stops the infinite piece
  content: { timelineObjects: [] }
}
```

## Studio Configuration

### Setting: `rundownGlobalPiecesPrepareTime`

Time of Day Pieces are pr default not shown on the timeline until they are within a certain time window before their start time. This is controlled by the `rundownGlobalPiecesPrepareTime` setting.
The default is 30 seconds (30000 milliseconds).

- **Location**: Studio Settings
- **Type**: Number (milliseconds)
- **Default**: 30000 (30 seconds)
- **Purpose**: Controls the lookahead window for adding time of day pieces to the timeline

**Access via UI**:
```
Settings → Studios → [Your Studio] → General Settings
```

**Example Values**:
- `30000` (30 seconds) - Default, suitable for most scenarios
- `60000` (1 minute) - For pieces that need more preparation time
- `10000` (10 seconds) - For simpler pieces with minimal preparation

### Configuration in Code

The setting is defined in:
```
packages/shared-lib/src/core/model/StudioSettings.ts
```

## Blueprint Context Access

When syncing updates to part instances, Time of Day Pieces are available in the blueprint context in:

```typescript
function syncIngestUpdateToPartInstance(
  context: IRundownSyncContext,
  ingestPart: IngestPart,
  rundownPieces: IBlueprintRundownPieceDB[]  // Available here!
): void {
  // Access global pieces to make decisions
  const relevantGlobalPieces = rundownPieces.filter(piece => {
    // Filter based on your criteria
    return piece.tags?.includes('time-of-day') //or.the.tag.you.have.chosen.for.time.of.day.pieces
  })
}
```

## Best Practices

### 1. Use Descriptive External IDs

```typescript
// Good: Clear, descriptive, includes timing info
externalId: 'commercial_break_slot_1430_news_hour'

// Bad: Generic, not searchable
externalId: 'piece_1'
```

### 2. Tag Your Pieces
For easier filtering and identification, use tags to categorize your Time of Day Pieces. This is especially useful if you have any automated pieces that are relative to dynamic content.
The tags could be something like:
```typescript
tags: ['automated', 'time-of-day', 'commercial', 'mandatory']
```

Tags help with:
- Filtering in blueprint logic
- Analytics and reporting

### 3. Handle Timezone Conversion

```typescript
// Use UTC for consistency
const utcTime = Date.parse('2025-03-04T14:00:00Z')

// Or convert from local time
const localTime = new Date(2025, 2, 4, 14, 0, 0)  // March 4, 2025, 2:00 PM local
const timestamp = localTime.getTime()
```

### 5. Document Time-Based Logic
It's crucial to document why specific time of day pieces are scheduled and what their purpose are, especially because these pieces can interfere with a live transmission.

## Related Documentation

- [Part and Piece Timings](./part-and-piece-timings.mdx) - Understanding piece timing fundamentals
- [Infinites](./part-and-piece-timings.mdx#infinites) - How infinite pieces work
- [Lookahead](./lookahead.md) - Timeline lookahead and preparation

## Technical Reference

### Blueprint Interface Location

```
packages/blueprints-integration/src/documents/rundownPiece.ts
```

### Key Implementation Files

- **Blueprint API**: `packages/blueprints-integration/src/api/showStyle.ts`
- **Ingest Processing**: `packages/job-worker/src/ingest/generationRundown.ts`
- **Post-Processing**: `packages/job-worker/src/blueprints/postProcess.ts` → `postProcessGlobalPieces()`
- **Timeline Processing**: `packages/corelib/src/playout/processAndPrune.ts`
- **Infinite Handling**: `packages/job-worker/src/playout/infinites.ts` → `getBaselineInfinitesForPart()`
- **Timeline Generation**: `packages/job-worker/src/playout/timeline/generate.ts`

### Interface Definition

```typescript
export interface IBlueprintRundownPiece<TPrivateData = unknown, TPublicData = unknown>
  extends Omit<IBlueprintPieceGeneric<TPrivateData, TPublicData>, 'lifespan'> {

  /** When the piece should be active on the timeline. */
  enable: {
    start: number
    duration?: number
    // For now, these pieces are always absolute (using wall time)
    isAbsolute: true
  }

  /** Whether the piece is virtual (marker only, no content). */
  virtual?: boolean

  /** Whether the piece affects studio output. */
  notInVision?: boolean
}
```
