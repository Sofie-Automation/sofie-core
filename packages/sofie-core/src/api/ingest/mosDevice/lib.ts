import { MOS } from '@sofie-automation/corelib'
import { mosTypes } from '@sofie-automation/meteor-lib/dist/mos'
import { SofieError } from '@sofie-automation/corelib/dist/error'

export function parseMosString(str: MOS.IMOSString128): string {
	if (!str) throw new SofieError(401, 'parseMosString: str parameter missing!')
	return mosTypes.mosString128.stringify(str)
}
