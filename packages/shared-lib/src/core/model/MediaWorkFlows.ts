import { Time } from '../../lib/lib.js'
import { MediaWorkFlowId, PeripheralDeviceId, StudioId } from './Ids.js'

export interface MediaWorkFlow {
	_id: MediaWorkFlowId
	_rev: string

	name?: string
	/** A secondary name, some kind of a comment about the workFlow */
	comment?: string

	/** Which device this workflow originated from */
	deviceId: PeripheralDeviceId
	studioId: StudioId

	source: string
	/** Id of the expectedMedia Item */
	expectedMediaItemId?: string[]
	mediaObjectId?: string
	created: Time

	priority: number

	finished: boolean
	success: boolean
}
