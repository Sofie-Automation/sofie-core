import { Meteor } from 'meteor/meteor'
import { MakeMeteorCall } from '@sofie-automation/meteor-lib/dist/api/methods'

export const MeteorCall = MakeMeteorCall(Meteor.applyAsync)
