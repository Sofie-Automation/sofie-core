/**
 * This file is the entry-point for Meteor's server side
 */

import { Meteor } from 'meteor/meteor'

Meteor.startup(() => {
	console.log('startup')
})

// Import all files that register Meteor methods:
import './api/blueprints/api'
import './api/blueprints/http'
import './api/blueprintConfigPresets'
import './api/client'
import './api/ExternalMessageQueue'
import './api/heapSnapshot'
import './api/ingest/debug'
import './api/integration/expectedPackages'
import './api/integration/media-scanner'
import './api/integration/mediaWorkFlows'
import './api/mongo'
import './api/peripheralDevice'
import './api/playout/api'
import './api/rundown'
import './api/rundownLayouts'
import './api/showStyles'
import './api/triggeredActions'
import './api/snapshot'
import './api/studio/api'
import './api/system'
import './api/userActions'
import './methods'
import './migration/api'
import './migration/databaseMigration'
import './migration/migrations'
import './api/playout/debug'
import './performanceMonitor'
import './systemStatus/api'
import './api/user'
import './api/organizations'
import './api/serviceMessages/api'
import './webmanifest'

// import all files that calls Meteor.startup:
import './api/rest/api'
import './Connections'
import './coreSystem'
import './cronjobs'
import './prometheus'
import './api/deviceTriggers/observer'
import './logo'
import './systemTime'
// import './performanceMonitor' // called above

// Setup publications and security:
import './publications/_publications'
import './security/securityVerify'
