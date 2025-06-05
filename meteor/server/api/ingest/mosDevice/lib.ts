import { MOS } from '@sofie-automation/corelib'
import { Meteor } from 'meteor/meteor'
import { mosTypes } from '@sofie-automation/meteor-lib/dist/mos'

export function parseMosString(str: MOS.IMOSString128): string {
	if (!str) throw new Meteor.Error(401, 'parseMosString: str parameter missing!')
	return mosTypes.mosString128.stringify(str)
}
