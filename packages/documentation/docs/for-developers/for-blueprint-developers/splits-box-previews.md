---
title: SPLITS box previews
sidebar_position: 11
---

# SPLITS box previews

Sofie can show **package-manager thumbnails and preview video inside each box** of a SPLITS (multi-box / DVE) piece.

Blueprints define which sources sit in each box and which media files they use. Core resolves preview URLs at runtime and publishes them on the `uiPieceContentStatuses` publication. The WebUI draws them on the dashboard shelf buttons and in hover popups.

| Part      | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blueprint | [`SplitsContent`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/blueprints-integration/src/content.ts) (`boxSourceConfiguration`), optional [`expectedPackages`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/blueprints-integration/src/documents/pieceGeneric.ts) (same `MEDIA_FILE` pattern as VT), optional [`popUpPreview`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/blueprints-integration/src/previews.ts) |
| Core      | `status.boxPreviews[]` — one entry per box, same order as `boxSourceConfiguration`                                                                                                                                                                                                                                                                                                                                                                                                  |
| WebUI     | Merges `boxPreviews` into split layouts; most inline surfaces stay colour-only                                                                                                                                                                                                                                                                                                                                                                                                      |

For SPLITS pieces, piece-level `thumbnailUrl` / `previewUrl` on content status are always empty. Use `boxPreviews` only.

## What to put on the piece

Each SPLITS piece that should show media previews needs layout on `content` and, for VT (or other file-based) boxes, package expectations on the same [`IBlueprintPieceGeneric`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/blueprints-integration/src/documents/pieceGeneric.ts).

### `boxSourceConfiguration`

[`SplitsContent`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/blueprints-integration/src/content.ts) stores boxes in `boxSourceConfiguration`. Index `0` is the rearmost layer.

| Box             | `SourceLayerType`                   | Blueprint must set                                                      |
| --------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| VT clip         | `VT` (or `LIVE_SPEAK` on your show) | `fileName`, `studioLabel`, `switcherInput`, `geometry`, usual VT fields |
| Camera          | `CAMERA`                            | `studioLabel`, `switcherInput`, `geometry`                              |
| Remote          | `REMOTE`                            | Same as camera                                                          |
| Graphics / Nora | `GRAPHICS` (per show)               | Your existing pattern; include `fileName` if the box uses a file        |

Any VT (or file-based) box that should show a thumbnail **must** have `fileName` on that box entry. Without it, Core cannot match media and the WebUI shows only a layer-colour block.

**Geometry:** `geometry.x`, `geometry.y`, and `geometry.scale` are fractions of the layout (0–1). Optional `geometry.crop` (`left`, `top`, `right`, `bottom`, also 0–1) is applied in the WebUI with CSS `clip-path` — for example a 9:16 portrait window inside a square cell.

Your ingest may still use a nested `{ geometry, source }[]` shape internally. Sofie does **not** store that on the piece; map it into `SplitsContent` when building pieces.

### `expectedPackages`

`expectedPackages` on pieces is **not new**. The `MEDIA_FILE` shape is the same one you already use on standalone VT pieces. Some shows may already attach packages to SPLITS pieces for Package Manager / playout.

What **is** new is how Core uses them for the UI:

| Before split box previews                                                                              | After                                                                               |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| SPLITS + `expectedPackages` → one piece-level `thumbnailUrl` / `previewUrl` (first package only)       | Per-box URLs in `status.boxPreviews[]`, matched to each VT box `fileName`           |
| SPLITS without `expectedPackages` → content status did not read VT media from `boxSourceConfiguration` | Core resolves previews from `fileName` via MediaObjects (and packages when present) |

#### Rules

- Add one [`ExpectedPackage.PackageType.MEDIA_FILE`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/shared-lib/src/package-manager/package.ts) per **distinct** file in the layout.
- `content.filePath` must match the box `fileName` (same string as playout and Package Manager).
- Reuse your existing VT package helpers (`sources`, `version`, accessors, containers).
- Do **not** put `thumbnailUrl` or `previewUrl` on content or packages.
- Two boxes sharing one file → one package entry; both boxes still need that `fileName`.

If VT boxes have no `expectedPackages`, Core can still fill previews from **MediaObjects** only. Prefer `expectedPackages` whenever your VT pieces already use them — routing, status, and Package Manager thumbnails stay consistent.

### Source layer

- `sourceLayerId` must point to a layer with `type: SPLITS` in the show-style blueprint.
- Timeline / playout for splits is unchanged; only content status and preview UI are affected.

## Optional `popUpPreview`

You may set `content.popUpPreview` with [`PreviewType.Split`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/blueprints-integration/src/previews.ts) (`boxes`, optional `background` asset).

Preview **URLs still come from** `UIPieceContentStatus`, not from the blueprint preview object. If `popUpPreview` is omitted, SPLITS pieces still get a default hover popup built from `SplitsContent`.

## Published status: `boxPreviews`

The `uiPieceContentStatuses` publication includes `status.boxPreviews` on [`PieceContentStatusObj`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/corelib/src/dataModel/PieceContentStatus.ts).

| Field                                      | Description                                              |
| ------------------------------------------ | -------------------------------------------------------- |
| `boxPreviews`                              | Array, same length and order as `boxSourceConfiguration` |
| `boxPreviews[i]`                           | `{}` for camera / remote / other non-file boxes          |
| `boxPreviews[i].thumbnailUrl`              | Thumbnail for box `i` when media is ready                |
| `boxPreviews[i].previewUrl`                | Preview video for box `i` (hover scrub)                  |
| `thumbnailUrl`, `previewUrl` (piece-level) | Always unset for SPLITS                                  |

## How Core resolves preview URLs

Implementation: [`checkPieceContentStatus.ts`](https://github.com/Sofie-Automation/sofie-core/blob/main/meteor/server/publications/pieceContentStatusUI/checkPieceContentStatus.ts). Helpers: [`splitBoxMedia.ts`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/shared-lib/src/package-manager/splitBoxMedia.ts).

### Via expected packages

Runs when `piece.expectedPackages` is set (same entry point as other layers).

1. For each `MEDIA_FILE` package, resolve thumbnail/preview URLs from Package Manager side effects on routed containers.
2. Key URLs in memory by normalized `filePath`.
3. Build `boxPreviews[]` with [`buildPublishedBoxPreviews`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/shared-lib/src/package-manager/splitBoxMedia.ts) (zip to box order).
4. For any VT box still missing URLs, fill from MediaObjects by `fileName`.

`contentDuration` on status comes from the package scan (same as VT pieces).

### Via MediaObjects only

Runs when the piece has **no** `expectedPackages` but the layer is SPLITS.

1. Collect distinct media ids from VT / LIVE_SPEAK / GRAPHICS / TRANSITION boxes with `fileName`.
2. Load each MediaObject and build `boxPreviews[]`.
3. Set `contentDuration` from the longest stream duration found in mediainfo.

Studio setting `mockPieceContentStatus` returns fake per-box URLs when `boxSourceConfiguration` is present (dev only).

## Where previews appear in the WebUI

| Surface                             | Component                                                                                                                                              | Notes                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Dashboard / bucket / ad-lib buttons | `DashboardPieceButtonSplitPreview` (via `MediaBox`)                                                                                                    | Inline box thumbnails when the layout enables thumbnails (buttons, or list with thumbnails enabled) |
| Hover popup                         | [`BoxLayoutPreview`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/webui/src/client/ui/PreviewPopUp/Previews/BoxLayoutPreview.tsx) | Shows box thumbnails and preview video; supports scrub when `previewUrl` exists                     |

These surfaces are **colour-only inline** (no visible box thumbnails), but will still show box media in the hover popup where supported:

- Storyboard thumbnails and secondary pieces
- Segment timeline SPLITS strip
- OPL main-piece line
- Clock view / camera screen indicators

Shared helpers: [`getSplitPreview`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/webui/src/client/lib/ui/splitPreview.ts), [`RenderSplitPreview`](https://github.com/Sofie-Automation/sofie-core/blob/main/packages/webui/src/client/lib/SplitPreviewBox.tsx).

## Example piece

```typescript
import { SourceLayerType, ExpectedPackage } from '@sofie-automation/blueprints-integration'

const piece = {
	sourceLayerId: '…', // SPLITS layer
	content: {
		boxSourceConfiguration: [
			{
				type: SourceLayerType.CAMERA,
				studioLabel: 'Cam 1',
				switcherInput: 1,
				geometry: { x: 0.1, y: 0.2, scale: 0.4 },
			},
			{
				type: SourceLayerType.VT,
				studioLabel: 'Snow clip',
				switcherInput: '',
				fileName: 'clips/head3_Snow.mp4',
				geometry: {
					x: 0.35,
					y: 0.7,
					scale: 0.3,
					crop: { left: 7 / 32, top: 0, right: 7 / 32, bottom: 0 },
				},
			},
		],
	},
	expectedPackages: [
		{
			_id: 'split_vt_clips_head3_snow',
			type: ExpectedPackage.PackageType.MEDIA_FILE,
			content: { filePath: 'clips/head3_Snow.mp4' },
			version: {
				/* same as standalone VT pieces */
			},
			sources: [
				/* same as standalone VT pieces */
			],
		},
	],
}
```
