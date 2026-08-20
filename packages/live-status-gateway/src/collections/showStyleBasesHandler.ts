import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { PublicationCollection } from '../publicationCollection.js'
import { CollectionHandlers } from '../liveStatusServer.js'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBShowStyleBase, OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { IOutputLayer, ISourceLayer } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseExt } from './showStyleBaseHandler.js'
import _ from 'underscore'

function buildShowStyleBaseExt(showStyleBase: DBShowStyleBase): ShowStyleBaseExt {
	const sourceLayers: SourceLayers = applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj
	const outputLayers: OutputLayers = applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj

	const sourceLayerNamesById = new Map<string, string>()
	const outputLayerNamesById = new Map<string, string>()

	for (const [layerId, sourceLayer] of Object.entries<ISourceLayer | undefined>(sourceLayers)) {
		if (sourceLayer === undefined || sourceLayer === null) continue
		sourceLayerNamesById.set(layerId, sourceLayer.name)
	}
	for (const [layerId, outputLayer] of Object.entries<IOutputLayer | undefined>(outputLayers)) {
		if (outputLayer === undefined || outputLayer === null) continue
		outputLayerNamesById.set(layerId, outputLayer.name)
	}

	return {
		...showStyleBase,
		sourceLayerNamesById,
		outputLayerNamesById,
		sourceLayers,
	} as ShowStyleBaseExt
}

/**
 * Subscribes to all ShowStyleBases used by rundowns in the active playlist.
 * This enables mixed-showstyle playlists to resolve each rundown/segment with the correct showstyle.
 */
export class ShowStyleBasesHandler extends PublicationCollection<
	ShowStyleBaseExt[],
	CorelibPubSub.showStyleBases,
	CollectionName.ShowStyleBases
> {
	private _showStyleBaseIds: ShowStyleBaseId[] = []

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.ShowStyleBases, CorelibPubSub.showStyleBases, logger, coreHandler)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)
		handlers.rundownsHandler.subscribe(this.onRundownsUpdate)
	}

	protected changed(): void {
		this.updateAndNotify()
	}

	private updateAndNotify(): void {
		const collection = this.getCollectionOrFail()
		const all = collection.find(undefined) as unknown as DBShowStyleBase[]

		const showStyles = all.map(buildShowStyleBaseExt)

		this._collectionData = showStyles
		this.notify(this._collectionData)
	}

	private onRundownsUpdate = (rundowns: DBRundown[] | undefined): void => {
		const ids = Array.from(
			new Set(
				(rundowns ?? []).map((rundown) => rundown.showStyleBaseId).filter((id): id is ShowStyleBaseId => !!id)
			)
		).sort()

		if (_.isEqual(this._showStyleBaseIds, ids)) return
		this._showStyleBaseIds = ids

		this.stopSubscription()
		if (this._showStyleBaseIds.length > 0) {
			this.setupSubscription(this._showStyleBaseIds)
		} else {
			this._collectionData = []
			this.notify(this._collectionData)
		}
	}
}
