import { Meteor } from 'meteor/meteor'
import './lib/lib'

import './buckets'
import './blueprintUpgradeStatus/publication'
import './ingestStatus/publication'
import './packageManager/expectedPackages/publication'
import './packageManager/packageContainers'
import './packageManager/playoutContext'
import './pieceContentStatusUI/bucket/publication'
import './pieceContentStatusUI/rundown/publication'
import './organization'
import './partsUI/publication'
import './partInstancesUI/publication'
import './peripheralDevice'
import './peripheralDeviceForDevice'
import './rundown'
import './rundownPlaylist'
import './segmentPartNotesUI/publication'
import './showStyle'
import './showStyleUI'
import './studio'
import './studioUI'
import './system'
import './timeline'
import './translationsBundles'
import './triggeredActionsUI'
import './mountedTriggers'
import './deviceTriggersPreview'

import { AllPubSubNames } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MeteorPublications } from './lib/lib'
import { logger } from '../logging'

// Ensure all the publications were registered at startup
if (Meteor.isDevelopment) {
	Meteor.startup(() => {
		for (const pubName of AllPubSubNames) {
			if (!MeteorPublications[pubName]) {
				logger.error(`Publication "${pubName}" is not setup!`)
			}
		}
	})
}
