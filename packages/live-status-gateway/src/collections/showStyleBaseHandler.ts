import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { PublicationCollection } from '../publicationCollection.js'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBShowStyleBase, OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { IOutputLayer, ISourceLayer } from '@sofie-automation/blueprints-integration'
import { CollectionHandlers } from '../liveStatusServer.js'

export interface ShowStyleBaseExt extends DBShowStyleBase {
	sourceLayerNamesById: ReadonlyMap<string, string>
	outputLayerNamesById: ReadonlyMap<string, string>
	sourceLayers: SourceLayers
}

export class ShowStyleBaseHandler extends PublicationCollection<
	ShowStyleBaseExt,
	CorelibPubSub.showStyleBases,
	CollectionName.ShowStyleBases
> {
	private _showStyleBaseId: ShowStyleBaseId | undefined
	private _sourceLayersMap: Map<string, string> = new Map()
	private _outputLayersMap: Map<string, string> = new Map()

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.ShowStyleBases, CorelibPubSub.showStyleBases, logger, coreHandler)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)

		handlers.rundownHandler.subscribe(this.onRundownUpdate)
	}

	protected changed(): void {
		if (this._showStyleBaseId) {
			this.updateCollectionData()
			this.notify(this._collectionData)
		}
	}

	onRundownUpdate = (data: DBRundown | undefined): void => {
		this.logUpdateReceived('rundown', `rundownId ${data?._id}, showStyleBaseId ${data?.showStyleBaseId}`)
		const prevShowStyleBaseId = this._showStyleBaseId
		this._showStyleBaseId = data?.showStyleBaseId

		if (prevShowStyleBaseId !== this._showStyleBaseId) {
			this.stopSubscription()
			if (this._showStyleBaseId) {
				this.setupSubscription([this._showStyleBaseId])
			}
		}
	}

	updateCollectionData(): void {
		const collection = this.getCollectionOrFail()
		if (!this._showStyleBaseId) return
		const showStyleBase = collection.findOne(this._showStyleBaseId)
		if (!showStyleBase) {
			this._collectionData = undefined
			return
		}
		const sourceLayers: SourceLayers = showStyleBase
			? applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj
			: {}
		const outputLayers: OutputLayers = showStyleBase
			? applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj
			: {}
		this._logger.info(
			`${this._name} received showStyleBase update with sourceLayers [${Object.values<ISourceLayer | undefined>(
				sourceLayers
			).map(
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				(s) => s!.name
			)}]`
		)
		this._logger.info(
			`${this._name} received showStyleBase update with outputLayers [${Object.values<IOutputLayer | undefined>(
				outputLayers
			).map(
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				(s) => s!.name
			)}]`
		)
		this._sourceLayersMap.clear()
		this._outputLayersMap.clear()
		for (const [layerId, sourceLayer] of Object.entries<ISourceLayer | undefined>(sourceLayers)) {
			if (sourceLayer === undefined || sourceLayer === null) continue
			this._sourceLayersMap.set(layerId, sourceLayer.name)
		}
		for (const [layerId, outputLayer] of Object.entries<IOutputLayer | undefined>(outputLayers)) {
			if (outputLayer === undefined || outputLayer === null) continue
			this._outputLayersMap.set(layerId, outputLayer.name)
		}
		const showStyleBaseExt: ShowStyleBaseExt = {
			...showStyleBase,
			sourceLayerNamesById: this._sourceLayersMap,
			outputLayerNamesById: this._outputLayersMap,
			sourceLayers,
		}
		this._collectionData = showStyleBaseExt
	}
}
