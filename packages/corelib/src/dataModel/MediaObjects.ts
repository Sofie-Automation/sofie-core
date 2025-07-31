import { ProtectedString } from '../protectedString.js'

export interface MediaObjects {
	_id: ProtectedString<'MediaObjId'>
	mediainfo?: {
		format?: {
			duration: number
		}
	}
}
