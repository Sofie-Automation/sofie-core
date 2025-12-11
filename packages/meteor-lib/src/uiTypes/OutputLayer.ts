import type { IOutputLayer } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'
import type { ISourceLayerExtended } from './SourceLayer.js'

export interface IOutputLayerExtended extends IOutputLayer {
	/** Is this output layer used in this segment */
	used: boolean
	/** Source layers that will be used by this output layer */
	sourceLayers: Array<ISourceLayerExtended>
}
