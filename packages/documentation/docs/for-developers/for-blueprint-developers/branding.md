# Branding

_Branding_ lets a single ShowStyle be played out in several visual variants, such as different programme brands or regional opt-outs, without needing a ShowStyle Variant or a separate ingest for each.

A Branding can:

- change how Parts, Pieces and AdLibs are displayed (their titles, names and labels)
- include or exclude Pieces and AdLibs from playout

It cannot change the content or timing of a Piece, or move it between layers. Anything which needs to differ in playout should be expressed as separate Pieces, each limited to the Brandings it is for.

## Defining Brandings

The Brandings available to a ShowStyle are defined on the ShowStyleBase. They can be provided by the blueprint from `applyConfig` as the `branding` property, and edited in the ShowStyle settings in the UI.

Each Branding has a user facing `name` and a `config`. The shape of the `config` is described by `brandingConfigSchema` in the ShowStyle blueprint manifest, in the same way as the ShowStyle config.

## Which Branding is used

Every PartInstance is given a Branding when it is created, and keeps it until it is changed by a playout operation:

1. If there is a current PartInstance, its Branding is inherited
2. Otherwise, if there is a next PartInstance, its Branding is inherited
3. Otherwise the `defaultBrandingId` of the RundownPlaylist is used, as provided by `getRundownPlaylistInfo` in the Studio blueprint

A PartInstance may have no Branding selected (`null`). In that case only the unbranded properties and the Pieces not limited to any Branding are used.

Documents which have no PartInstance of their own, such as the Parts and AdLibs shown in the Rundown view and the shelf, are displayed using the Branding of the current PartInstance. Before anything has been played they use the `defaultBrandingId`.

### Changing the Branding

An AdLib Action can change the Branding with `context.setBranding(target, brandingId)`, where `target` is one of:

- `'current'` - only the current PartInstance
- `'next'` - only the next PartInstance
- `'both'` - the current and the next PartInstances

As the next PartInstance usually exists already when an action runs, changing only the `'current'` will not affect it. Use `'both'` to change the Branding from now on. Changing the Branding of the current PartInstance regenerates the timeline, so it can change what is on air partway through a Part.

The id must be one of the Brandings of the ShowStyle, or `null` to select no Branding.

The selected Brandings can be read with `getCurrentBranding()` and `getNextBranding()` in the AdLib Action, `onTake`, `onSetAsNext` and `onTimelineGenerate` contexts. These return the resolved Branding, including its `config`, or `null` when none is selected.

## Limiting Pieces and AdLibs to a Branding

Pieces, AdLib Pieces and AdLib Actions can be limited to some Brandings with `onlyValidForBranding`, an array of Branding ids. When the selected Branding is not in the list, it is as if the document does not exist:

- the Piece is excluded from the timeline and from lookahead
- it is not continued as an infinite into the following Parts
- the AdLib is hidden from the UI, and starting it is rejected

A document limited to some Brandings is never used when no Branding is selected, and an empty array means it is never used.

This allows the blueprint to generate a Piece per Branding during ingest, and have the right one play depending on the selected Branding.

## Overriding how a document is displayed

Parts, Pieces, AdLib Pieces and AdLib Actions can provide `branding`, an object of overrides keyed by the id of the Branding. While that Branding is selected, any property named in the overrides replaces the one on the document in full.

Only properties which affect how the document is displayed can be overridden:

| Document               | Properties                                                            |
| ---------------------- | --------------------------------------------------------------------- |
| Part                   | `title`, `prompterTitle`, `identifier`                                |
| Piece / AdLib Piece    | `name`                                                                |
| AdLib Action `display` | `label`, `description`, `triggerLabel`, `_rank`, `tags`               |

The `tags` of a Piece cannot be overridden, as they are matched against the `currentPieceTags` and `nextPieceTags` of AdLibs to determine their tally.

```ts
const piece: IBlueprintPiece = {
	externalId: 'headline',
	name: 'Headline',
	// ...
	branding: {
		regional: { name: 'Regional headline' },
	},
}
```

Any override which names a property that cannot be overridden, or has a value of the wrong type, is dropped with a warning in the log, as is an `onlyValidForBranding` which is not an array of strings.

Branding is not supported on Bucket AdLibs, as they are shared between Rundowns and ShowStyles.
