/**
 * This file is the entry-point for Meteor's server side
 */

// Setup logging
import { logger } from './logging'
console.log('startup')

// App imports
import * as fs from 'fs/promises'
import { MethodRegistry } from './methodRegistry'
import { registerAllApiMethods } from './methodRegistrations'
import { PublicationRegistry } from './publicationRegistry'
import { registerAllPublications } from './publicationRegistrations'
import { bindRestApiRouter } from './api/rest/api'
import { startupVerifyAllMethods } from './security/securityVerify'
import { createDdpConnectionRegistry, startStandaloneDdpServer } from './ddp-server'
import { makeMeteorCallForRegistry } from './api/meteorCall'
import { createMeteorTriggersContext } from './api/deviceTriggers/triggersContext'
import { startDeviceTriggersObserver } from './api/deviceTriggers/observer'
import { bindLogoRouter } from './logo'
import { setupPrometheusMetrics } from '@sofie-automation/corelib/dist/prometheus'
import { startCronjobs } from './cronjobs'
import { startTimeJumpDetector } from './systemTime'
import { bindWebManifestRouter } from './webmanifest'
import { startPerformanceMonitor } from './performanceMonitor'
import { createIndexes } from './api/system'
import { startMediaObjectDurationMonitor } from './api/ingest/rundownInput'
import { startStudioMappingsHashObserver } from './api/studio/api'
import { describeRunMode, isInDevelopmentMode, isInTestMode } from './lib'
import { connectMongo } from './collections/mongoConnection'
import { bindServiceMessagesRouter } from './api/serviceMessages/api'
import { bindSystemStatusRouter } from './systemStatus/api'
import { startRundownVersionHashObservers } from './collections'
import { startJobWorkerParent } from './worker/worker'
import { startBlueprintConfigPresetObservers } from './api/blueprintConfigPresets'
import { startExternalMessageQueueStatusMonitor } from './api/ExternalMessageQueue'
import { markAllPeripheralDevicesOffline } from './Connections'
import { createKoaApp } from './api/rest/koa'
import { createHttpServer, listenHttpServer } from './httpServer'
import {
	getSystemStorePath,
	initializeCoreSystem,
	RelevantSystemVersions,
	setupSystemStatusObservers,
	startApmInstrumenting,
	updateLoggerLevel,
} from './coreSystem'
import { CURRENT_SYSTEM_VERSION } from './migration/currentSystemVersion'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

// Build and populate the method registry
const methodRegistry = new MethodRegistry()
registerAllApiMethods(methodRegistry)

// Build and populate the publication registry
const publicationRegistry = new PublicationRegistry()
registerAllPublications(publicationRegistry)

// The registry of live DDP sessions, shared between the DDP server and the performance monitor
const ddpConnectionRegistry = createDdpConnectionRegistry()

/**
 * The lifetime of this process. Long-lived observers started below are bound to this signal, so
 * aborting it releases them all; a graceful-shutdown path can do that rather than relying on the
 * process exiting.
 */
const processLifetime = new AbortController()

;(async () => {
	console.log('process started') // This is a message all Sofie processes log upon startup

	logger.info(`Core starting up`)
	logger.info(`Core system version: "${CURRENT_SYSTEM_VERSION}"`)
	logger.info(`Core running in ${describeRunMode()}`)

	if (global.gc) {
		logger.info(`Manual garbage-collection is enabled`)
	} else {
		logger.warn(
			`Enable garbage-collection by passing --expose_gc to node in prod or set SERVER_NODE_OPTIONS=--expose_gc in dev`
		)
	}

	if (!isInTestMode()) {
		// Ensure the storepath exists
		const storePath = getSystemStorePath()
		logger.info(`Using storePath: ${storePath}`)
		await fs.mkdir(storePath, { recursive: true })
	}

	const versions = await RelevantSystemVersions
	for (const [name, version] of Object.entries<string>(versions)) {
		logger.info(`Core package ${name} version: "${version}"`)
	}

	// Setup MongoDB connection
	await connectMongo()
	createIndexes() // Ensure indexes are created on startup:

	await markAllPeripheralDevicesOffline()
	const startupCoreSystem = await initializeCoreSystem() // Ensure the core system is initialized
	updateLoggerLevel(startupCoreSystem, true)
	startApmInstrumenting(startupCoreSystem)

	bindRestApiRouter(methodRegistry, publicationRegistry)
	bindLogoRouter()
	bindWebManifestRouter()
	bindServiceMessagesRouter()
	bindSystemStatusRouter()

	await startJobWorkerParent()

	if (isInDevelopmentMode()) startupVerifyAllMethods(methodRegistry)

	setupPrometheusMetrics('meteor')

	// Start observing studios for device triggers, dispatching their actions through the method registry
	await startDeviceTriggersObserver(
		createMeteorTriggersContext(makeMeteorCallForRegistry(methodRegistry)),
		processLifetime.signal
	)
	await Promise.all([
		setupSystemStatusObservers(processLifetime.signal),
		startMediaObjectDurationMonitor(processLifetime.signal),
		startStudioMappingsHashObserver(processLifetime.signal),
		startRundownVersionHashObservers(processLifetime.signal),
		startBlueprintConfigPresetObservers(processLifetime.signal),
		startExternalMessageQueueStatusMonitor(processLifetime.signal),
	])

	startCronjobs()
	startPerformanceMonitor(ddpConnectionRegistry)

	// Build the http server and everything mounted on it, then start listening once it is all attached
	const httpServer = createHttpServer(createKoaApp())
	startStandaloneDdpServer(methodRegistry, publicationRegistry, ddpConnectionRegistry, httpServer)
	await listenHttpServer(httpServer)

	// Ensure all the publications were registered at startup
	if (isInDevelopmentMode()) publicationRegistry.verifyAllPublicationsRegistered()

	startTimeJumpDetector()
})().catch((e) => {
	logger.error(`Startup failed: ${stringifyError(e)}`)

	processLifetime.abort(new Error('Startup failed'))

	// eslint-disable-next-line n/no-process-exit
	process.exit(1)
})
