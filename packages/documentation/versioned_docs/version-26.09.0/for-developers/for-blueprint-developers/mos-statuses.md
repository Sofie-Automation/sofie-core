# MOS Statuses

Sofie is able to report statuses back to stories and objects in the NRCS. This is driven by blueprints defining properties during Ingest.

:::tip
For any statuses to be sent, this must be enabled on the gateway. There are some additional properties too, to limit what is sent. This is described in the [MOS Gateway Installation Guide]('../../../../user-guide/installation/installing-a-gateway/rundown-or-newsroom-system-connection/mos-gateway.md).
:::

# Part Properties

All of these properties reside on the IBlueprintPart that are returned from `getSegment`.

```ts
/** The externalId of the part as expected by the NRCS. If not set, the externalId property will be used */
ingestNotifyPartExternalId?: string

/** Set to true if ingest-device should be notified when this part starts playing */
shouldNotifyCurrentPlayingPart?: boolean

/** Whether part should be reported as ready to the ingest-device. Set to undefined/null to disable this reporting */
ingestNotifyPartReady?: boolean | null

/** Report items as ready to the ingest-device. Only named items will be reported, using the boolean value provided */
ingestNotifyItemsReady?: IngestPartNotifyItemReady[]
```

## Examples

### Simple Statuses

For the most basic setup, of Sofie Reporting `PLAY` and `STOP` to the NRCS at activation and while playing a rundown you need to perform the following steps.

1. Enable the `Write Statuses to NRCS` setting in the MOS gateway setting
1. For each part that should report `PLAY` and `STOP` statuses, set `shouldNotifyCurrentPlayingPart: true`.
   If your part `externalId` properties do not match the `externalId` of the NRCS data, you will need to set `ingestNotifyPartExternalId` to the NRCS `externalId`, so that the MOS gateway can match up the statuses to the NRCS data.

Optionally, you may also wish to report `READY` or `NOTREADY` statuses to the NRCS for any stories which have not been played or set as next. You can do this by setting `ingestNotifyPartReady`. A `true` value means `READY`, with `false` meaning `NOTREADY`. Leaving it unset or `undefined` will skip reporting these statuses.

### MOS Item Statuses

You can also report statuses for MOS items if needed. These can be set based on Package Manager statuses, as they can trigger the ingest of a part to be rerun. With this you can build status reporting based on whether clips are ready for playout.

Because Sofie Pieces rarely map 1:1 with MOS items, these statuses are not done via pieces, but instead the `ingestNotifyItemsReady` is used.  
This property is a simple array of:

```ts
export interface IngestPartNotifyItemReady {
	externalId: string
	ready: boolean
}
```

Only items which are present in this array will have statuses reported.
