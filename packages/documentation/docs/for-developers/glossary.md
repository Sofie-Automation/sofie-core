---
sidebar_position: 20
---

# Glossary

## Timing and Preparation

### Adlib (Ad-lib)
Short for "ad libitum" (Latin: "at one's pleasure"). Content that operators can trigger spontaneously during a show, outside the pre-programmed rundown flow. Includes both **adlib pieces** (alternative content like camera shots or clips) and **adlib actions** (scripted operations like "take graphics off").

**Key challenge**: Adlibs bypass [lookahead](#lookahead), so [preroll](#preroll-pre-roll) and [expected packages](#expected-package) become critical for smooth execution.

**Related**: [Timing and Preparation Guide](./for-blueprint-developers/timing-and-preparation.md)

### Baseline Timeline
Timeline objects defined at the studio level that run continuously, independent of rundown content. Used to establish default device states.

**Common uses**:
- Setting audio mixer default states
- Configuring vision mixer AUX outputs
- Device routing defaults

**Defined in**: Studio blueprint's `getBaseline()` method

**Characteristics**:
- Always enabled: `enable: { while: 1 }`
- Low priority (0-1) so rundown content can override
- Persists across rundowns

### Expected Package
A declaration in a blueprint that a specific media file or asset is needed for playout. Triggers the Package Manager to copy, transcode, or generate the file.

**Types include**:
- Media files (video, audio)
- Graphics templates
- Data files

**Side effects**: Can automatically generate:
- Web previews for UI
- Thumbnail images
- Loudness analysis
- Deep scan metadata

**Usage**: Critical for ensuring adlib content is ready even though it can't be predicted by lookahead.

### Infinite Piece
A piece with a `lifespan` that extends beyond its originating part.

**Lifespans**:
- `WithinPart` - Ends when part ends (normal pieces)
- `OutOnSegmentEnd` - Persists until segment ends
- `OutOnSegmentChange` - Persists until segment changes
- `OutOnRundownEnd` - Persists until rundown ends
- `OutOnRundownChange` - Persists until rundown changes
- `OutOnShowStyleEnd` - Persists until ShowStyle changes

**Purpose**: Keep content (like graphics, background audio, or loaded media) running across multiple parts without restarting, avoiding flicker and reload delays.

**Example**: A lower-third graphic that appears in Part 3 and should remain visible through Parts 4, 5, and 6.

### In Transition
A timing configuration on a part that manages the visual transition when taking **into** that part.

**Properties**:
- `blockTakeDuration` - How long to prevent additional takes
- `previousPartKeepaliveDuration` - How long to keep previous part playing
- `partContentDelayDuration` - How long to delay new content

**Effect**: Normal pieces are delayed while special transition pieces (with `pieceType: IBlueprintPieceType.InTransition`) play.

**Related**: [Out Transition](#out-transition), [Part and Piece Timings](./for-blueprint-developers/part-and-piece-timings.mdx)

### Lookahead
A Sofie feature that searches future parts/pieces to create timeline objects for preloading or previewing upcoming content.

**Purpose**:
- Preload media into players before needed
- Show "next" content on preview monitors
- Assign AB playback servers in advance

**Modes**:
- `NONE` - Lookahead disabled
- `PRELOAD` - Uses secondary device resources (e.g., CasparCG background layer)
- `WHEN_CLEAR` - Fills gaps in timeline

**Configuration** (per mapping):
- `lookahead` - Which mode to use
- `lookaheadDepth` - Minimum number of future objects to find (default: 1)
- `lookaheadMaxSearchDistance` - Maximum parts to search (default: 10)

**Limitation**: Cannot predict adlibs or dynamic rundown changes.

**Related**: [Lookahead Guide](./for-blueprint-developers/lookahead.md), [AB Playback](./for-blueprint-developers/ab-playback.md)

### MakeReady
A TSR operation that initializes or resets devices to a known good state, typically when a rundown playlist is activated.

**Common actions**:
- Resetting vision mixers to default state
- Clearing graphics engines
- Resetting audio mixer levels
- Preloading graphics templates

**Configured in**: Device options (TSR configuration)

**Triggered**: When rundown playlist activates, or manually via API

### Out Transition
A timing configuration on a part that manages the visual transition when taking **out of** that part.

**Property**:
- `duration` - How long to keep this part alive after take

**Effect**: The part extends beyond the take point, and special pieces with `pieceType: IBlueprintPieceType.OutTransition` play during this extension.

**Purpose**: Allow visual cleanup or transition effects before the new part fully takes over.

**Related**: [In Transition](#in-transition), [Postroll](#postroll)

### Postroll
Duration (in milliseconds) that a piece continues playing **after** its planned end time or after a take out.

**Set via**: `postrollDuration` property on pieces

**Purpose**: Allow pieces to complete their content beyond the technical endpoint. Differs from [out transition](#out-transition) in that:
- Out transition keeps **all** pieces playing
- Postroll keeps only **specific** pieces playing

**Example**: A clip that should play 2 seconds past its formal endpoint to avoid cutting off the final frame.

**Related**: [Preroll](#preroll-pre-roll), [Part and Piece Timings](./for-blueprint-developers/part-and-piece-timings.mdx)

### Preliminary
A property on TSR device commands specifying how many milliseconds **before** the scheduled timeline time the command should be executed.

**Set in**: TSR device integrations (not typically in blueprints)

**Purpose**: Compensate for command processing delays on devices to achieve frame-accurate execution.

**Example**: Quantel servers may need commands 1000ms early to guarantee precise timing.

**Difference from preroll**:
- **Preliminary**: When to send the command (hidden from users)
- **Preroll**: When to start the piece (visible in UI/timeline)

**Can combine**: A piece with `prerollDuration: 200` might generate commands with `preliminary: 1000`, resulting in commands sent 1200ms before the intended execution point.

**Related**: [Timing and Preparation Guide](./for-blueprint-developers/timing-and-preparation.md)

### Preroll (Pre-roll)
Duration (in milliseconds) that a piece needs to prepare its content **before** it should have visible or audible effect.

**Set via**: `prerollDuration` property on pieces

**Purpose**: Compensate for:
- Device playback latency (e.g., frames between PLAY command and SDI output)
- Content loading time
- Device stabilization time

**How it works**:
- Timeline generation adjusts piece start times backward
- Previous part extends to accommodate preroll time
- All pieces in a part get enough time for their individual preroll

**Common values**:
- Camera cuts: `0ms` (instant)
- CasparCG playback: `200-300ms` (5-8 frames at 25fps)
- File loading: `1000-2000ms` (device/file dependent)

**Critical for adlibs**: Since lookahead can't prepare adlib content, preroll must be sufficient for worst-case scenarios.

**Related**: [Timing and Preparation Guide](./for-blueprint-developers/timing-and-preparation.md), [Part and Piece Timings](./for-blueprint-developers/part-and-piece-timings.mdx)

## Content and Structure

### Blueprint
JavaScript/TypeScript code bundles that define how Sofie transforms ingest data and controls playout.

**Types**:
- **System Blueprint** - System-level configuration and migrations
- **Studio Blueprint** - Studio-wide device configuration and baseline
- **ShowStyle Blueprint** - Show-specific content transformation and playout logic

**Key responsibilities**:
- Transform ingest data into rundowns/segments/parts/pieces
- Generate timeline objects for device control
- Define configuration schemas
- Handle user actions

### Part
A logical grouping of content within a segment, representing a distinct section of the show (e.g., "Intro", "Interview", "VT Package").

**Contains**: Pieces (the actual playout content)

**Operator interaction**: Parts are the primary unit operators "take" between

**Timing**: Can have expected duration, auto-next behavior, transitions

### Piece
The fundamental unit of playout content. Represents a single item to play (camera shot, VT clip, graphic, etc.).

**Key properties**:
- `externalId` - Unique identifier within the part
- `name` - User-visible label
- `sourceLayerId` - Logical content type
- `outputLayerId` - Destination routing
- `lifespan` - How long it persists
- `enable` - When to start/stop
- `content` - Timeline objects controlling devices

**Types**: Normal, in-transition, out-transition

### Rundown
The complete sequence of content for a show, typically received from a newsroom system (NRCS) via MOS or other ingest methods.

**Structure**: Contains segments, which contain parts, which contain pieces

**Lifecycle**: Created from ingest, modified by users, executed during playout

### Segment
A major section of a rundown, typically representing a story or show segment.

**Contains**: Parts (subdivisions of the segment)

**Purpose**: Provides logical grouping for navigation and infinite piece scoping

### ShowStyle
Configuration defining how a particular type of show should behave, including:
- Source and output layer definitions
- Device configuration
- Blueprint logic specific to that show format

**Examples**: "Daily News", "Sports Show", "Weather Segment"

### Source Layer
A logical layer representing a type of content (e.g., "Camera", "VT", "Graphics Lower Third").

**Purpose**: Abstracts content types from physical device routing

**Defined in**: ShowStyle configuration

**Maps to**: Output layers (which map to physical device layers)

### Timeline Object
Low-level device control instruction that appears on the timeline.

**Contains**:
- `id` - Unique identifier
- `enable` - When to activate
- `layer` - Which device layer to control
- `content` - Device-specific control data (TSR content)

**Generated by**: Blueprints (from pieces) or system (lookahead, group wrappers)

**Executed by**: Timeline State Resolver (TSR)

## Device Control (TSR)

### AB Playback
A technique for alternating between video server players to enable seamless back-to-back clip playback.

**Problem solved**: 
- Prevents reloading clips unnecessarily
- Enables instant switching between clips
- Handles dynamic replanning without glitches

**How it works**:
- Pieces declare `abSessions` requesting a player
- AB resolver assigns sessions to physical players
- Uses lookahead to pre-assign upcoming clips

**Configuration**: `getAbResolverConfiguration()` in ShowStyle blueprint

**Related**: [AB Playback Guide](./for-blueprint-developers/ab-playback.md)

### Mapping
Configuration linking a Sofie layer to a physical device and its control parameters.

**Key properties**:
- `device` - Which TSR device to control
- `deviceId` - Which physical device
- Device-specific routing (input numbers, layer IDs, etc.)
- `lookahead` - Lookahead mode for this layer
- `lookaheadDepth` - How many future objects to find

**Defined in**: Studio configuration

**Used by**: Timeline generation and TSR device control

### TSR (Timeline State Resolver)
The Node.js library that executes timeline objects by controlling physical broadcast devices.

**Supported devices**: ATEM, CasparCG, Lawo, vMix, Sisyfos, Quantel, and many more

**Responsibilities**:
- Maintaining connections to devices
- Converting timeline to device state
- Generating and executing device commands
- Reporting device status

**Related**: [TSR Repository](https://github.com/Sofie-Automation/sofie-timeline-state-resolver)

## Data Ingest

### MOS (Media Object Server)
A standardized protocol for communication between newsroom systems and broadcast automation.

**Purpose**: Allows NRCS (newsroom computer systems) to send rundown data to Sofie

**MOS Objects**: Stories, items, metadata that Sofie transforms into rundowns

**Related**: [MOS Protocol Specification](http://mosprotocol.com/)

### NRCS (Newsroom Computer System)
The editorial system used by journalists to write scripts and build rundowns.

**Examples**: Avid iNews, Octopus, ENPS

**Integration**: Sends data to Sofie via MOS or other protocols

## See Also

- [Timing and Preparation Guide](./for-blueprint-developers/timing-and-preparation.md) - Comprehensive guide to lookahead, preroll, preliminary, and transitions
- [Blueprint Developer Introduction](./for-blueprint-developers/intro.md)
- [Data Model](./data-model.md)
