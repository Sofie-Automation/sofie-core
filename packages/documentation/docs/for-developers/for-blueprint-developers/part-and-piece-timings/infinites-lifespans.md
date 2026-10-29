# Infinites: lifespans

An **infinite** is a piece that can continue after the end of the part where it starts. Its **lifespan** sets how far it continues, how it moves through the rundown, and what occurs when a newer piece covers it.

This page describes the lifespan object. For the legacy lifespan presets (`PieceLifespan`), refer to [Infinites](./infinites.md).

## The lifespan object

Set the `lifespan` property of a piece or an adlib piece to an object with three properties:

```ts
interface IPieceLifespan {
	scope: 'part' | 'segment' | 'rundown' | 'showstyle' | 'playlist'
	presence: 'forward-scope' | 'follow-playhead'
	inShadow: 'stop' | 'persist'
}
```

If you do not set a property, Sofie uses its default value:

| Property   | Default         |
| ---------- | --------------- |
| `scope`    | `part`          |
| `presence` | `forward-scope` |
| `inShadow` | `stop`          |

A piece is an infinite when its `scope` is not `part`.

### `scope`: how far the piece continues

| `scope`     | The piece stops when                                                                         |
| ----------- | -------------------------------------------------------------------------------------------- |
| `part`      | The part stops. This is a normal piece. Sofie does not continue it.                          |
| `segment`   | The playhead goes out of the segment.                                                        |
| `rundown`   | The playhead goes out of the rundown.                                                        |
| `showstyle` | The playhead goes into a rundown that has a different ShowStyleBase.                         |
| `playlist`  | The playlist stops. A change of ShowStyleBase does not stop the piece.                       |

For `showstyle`, all the rundowns from the start rundown to the current rundown must have the same ShowStyleBase. Thus, in a playlist with the ShowStyleBases A, A, B, A, an infinite from the first rundown does not continue into the last rundown.

Sofie uses the ShowStyleBase to compare show styles. It does not use the ShowStyleVariant.

### `presence`: how the piece moves through the rundown

- **`forward-scope`**: The piece is part of the plan.
  - It continues into all the subsequent parts in its scope, in the order of the rundown.
  - It continues also when the operator skips a part. The pieces in a skipped part also change it.
  - The rundown view shows it in the subsequent parts before they play.
- **`follow-playhead`**: The piece follows the playhead.
  - It becomes an infinite only after it plays.
  - It then continues from the on-air part, in the order that the parts play.
  - A part that the operator skips does not change it.
  - The rundown view shows it in the subsequent parts only after it plays.

### `inShadow`: what occurs when a newer piece covers it

A newer piece **covers** an infinite when the newer piece starts on the same source layer, later than the infinite.

- **`stop`**: Any newer piece on the source layer stops the infinite permanently. This includes a normal piece, an adlib and a clear virtual piece. A shadow piece does not stop it (see [Virtual pieces](#virtual-pieces)).
- **`persist`**: The newer piece hides the infinite temporarily. When the newer piece stops, the infinite shows again. This occurs in the same part and in subsequent parts. Only an open-ended `persist` piece with the same scope stops it permanently.

A piece is **open-ended** when it has no `enable.duration` and no user duration.

## Stacking

Sofie gives each piece a timeline priority from its lifespan:

| Piece                     | Priority |
| ------------------------- | -------- |
| `stop`, all scopes        | 5        |
| `persist`, `part`         | 3        |
| `persist`, `segment`      | 2        |
| `persist`, `rundown`      | 1        |
| `persist`, `showstyle`    | 0        |
| `persist`, `playlist`     | -1       |

A piece with a higher priority covers a piece with a lower priority. When two pieces have the same priority, the piece that started last covers the other piece.

Thus, a `persist` piece with a narrow scope can cover a `persist` piece with a broad scope. The broad piece shows again when the narrow piece stops.

:::warning Known issue
The newer piece must always cover the older piece. At this time, a newer `persist` piece with a broader scope does not cover an older `persist` piece with a narrower scope. The older piece stays on top until it stops. This is a bug. A fix is necessary.
:::

### Example: nested pieces

A `rundown`, `persist` infinite comes from a previous part. The current part has three `part`, `persist` pieces on the same source layer:

- A, from 1 s to 6 s
- B, from 2 s to 5 s
- C, from 3 s to 4 s

The source layer shows: infinite, A, B, C, B, A, infinite.

## Interactions

Each row is an infinite on the source layer. Each column is a newer piece that starts on the same source layer.

| Infinite ↓ / newer piece → | `stop`, all scopes | `persist`, narrower scope | `persist`, same scope, open-ended | `persist`, same scope, with an end | `persist`, broader scope | Clear virtual | Shadow virtual |
| -------------------------- | ------------------ | ------------------------- | --------------------------------- | ---------------------------------- | ------------------------ | ------------- | -------------- |
| `stop`                     | Stopped            | Stopped                   | Stopped                           | Stopped                            | Stopped                  | Stopped       | Hidden         |
| `persist`                  | Hidden             | Hidden                    | Stopped                           | Hidden                             | Not covered              | See note      | Hidden         |

- **Stopped**: The infinite stops where the newer piece starts. It does not show again.
- **Hidden**: The infinite does not show while the newer piece is on air. It shows again when the newer piece stops. If the newer piece is open-ended and has the `part` scope, the infinite shows again in the next part.
- **Not covered**: The infinite stays on top. The newer piece shows only after the infinite stops. This is a bug. Refer to the known issue in [Stacking](#stacking).
- **See note**: A clear virtual piece has the same effect as a piece with its lifespan, but it has no content.

A `presence` value does not change these interactions. It changes only how the piece moves through the rundown.

## Virtual pieces

A virtual piece (`virtual: true`) has no content. Use it to change the infinites on a source layer without showing a new graphic. Set `virtualMode` to select its effect:

```ts
virtualMode?: 'clear' | 'shadow'
```

- **`clear`** (default): The virtual piece has the same effect as a piece with its lifespan. For example:
  - It stops `stop` infinites.
  - An open-ended `clear` piece with a `persist` lifespan stops the `persist` infinites with the same scope.
  - A `clear` piece with a `part` scope and an end hides a `persist` infinite. The infinite shows again when the piece stops.
- **`shadow`**: The virtual piece hides the source layer while it is on air. It does not stop pieces.
  - All the pieces below it are hidden. They show again when the shadow stops.
  - A piece that starts after the shadow shows on top of the shadow.
  - The shadow continues for its own lifespan and duration. For example, an open-ended shadow with the `segment` scope hides the source layer until the end of the segment.
  - Sofie sets `virtual: true` on all shadow pieces.

Use a shadow when an adlib must hide the content on a source layer temporarily. The adlib does not have to know the content of that source layer.

## Adlibbed infinites

An **adlibbed infinite** is an infinite that the operator or a blueprint adds while the rundown is on air:

- An adlib piece.
- A piece that an adlib action inserts.
- A piece that an adlib action changes to an infinite with `updatePieceInstance`.

An adlibbed `forward-scope` infinite continues only while the playhead moves forward through the rundown. If the playhead moves back, Sofie removes it.

Sofie sorts an adlib by the time when the operator takes it. Sofie compares this time with the start times of the planned pieces in the same part. For example, an adlib that the operator takes at 2 s is below a planned piece that starts at 5 s.

## Stop an infinite

### Planned

To stop an infinite, start a newer piece on the same source layer:

- For a `stop` infinite, use any piece.
- For a `persist` infinite, use an open-ended `persist` piece with the same scope.
- To stop the infinite and show no content, make the new piece virtual. Do not use a shadow piece, because a shadow does not stop pieces.

### From an adlib action

- `stopPiecesOnLayers(sourceLayerIds, timeOffset?)` and `stopPieceInstances(ids, timeOffset?)` stop the pieces on air:
  - For normal pieces and `follow-playhead` infinites, Sofie crops the piece instance.
  - For `forward-scope` infinites, Sofie inserts a virtual piece with the same lifespan. This piece prevents the subsequent parts from making the infinite again.
- `insertPiece('current' | 'next', piece)` inserts a piece. It has the same effect as any newer piece on the source layer.

A user stop (a user duration) stops a piece permanently, whatever its lifespan.

## Lifespans that Sofie changes

- Sofie changes these pieces to `part`, `forward-scope`, `stop`:
  - Transition pieces (`pieceType` is not `Normal`).
  - Pieces with `extendOnHold: true`.
- Rundown global pieces (`globalPieces`) have no lifespan property. Sofie gives them `rundown`, `follow-playhead`, `stop`. They start when the first part of the rundown plays.

## Rundowns with different show styles

- Sofie finds infinites by `sourceLayerId`. To show a `showstyle` or `playlist` infinite in a rundown with a different ShowStyleBase, both show styles must have:
  - A source layer with the same id.
  - A related output layer and mappings.
- Infinites do not go into or out of an AdLibTesting segment. To change this, set the studio setting `allowTestingAdlibsToPersist`.

:::caution
The `inShadow` value `legacy-persist` is deprecated. It exists only to keep the behavior of the legacy `*-end` presets. Do not use it in new blueprints. Use `persist`.
:::
