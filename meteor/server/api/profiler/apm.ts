import { Meteor } from 'meteor/meteor'
// import shimmer from 'shimmer'
import Agent, { AgentConfigOptions } from 'elastic-apm-node'

// const { Session, Subscription, MongoCursor } = require('./meteorx')

// Only the ones of these we use have been copied across.
// The others can be found at https://github.com/Meteor-Community-Packages/meteor-elastic-apm/tree/master/instrumenting
// const instrumentMethods = require('./instrumenting/methods')
// const instrumentHttpOut = require('./instrumenting/http-out')
// const instrumentSession = require('./instrumenting/session')
// const instrumentSubscription = require('./instrumenting/subscription')
// const instrumentDB = require('./instrumenting/db')
// const startMetrics = require('./metrics')

// const hackDB = require('./hacks')

const [framework, version] = Meteor.release.split('@')

Agent.setFramework({
	name: framework,
	version,
	overwrite: true,
})

export const RawAgent = Agent

export function startAgent(config: AgentConfigOptions): void {
	if (config.active !== false) {
		try {
			// Must be called before any other route is registered on WebApp.
			// http-in has been moved to be part of where the koa router is mounted
			// instrumentHttpOut(Agent)

			Agent.start(config)

			// instrumentMethods(Agent, Meteor),
			// instrumentSession(Agent, Session),
			// instrumentSubscription(Agent, Subscription),
			// hackDB() // TODO: what is this doing? https://github.com/Meteor-Community-Packages/meteor-elastic-apm/blob/master/hacks.js
			// instrumentDB replaced by manual wrapping in WrappedAsyncMongoCollection
			// startMetrics(Agent),

			Agent.logger.info('meteor-elastic-apm completed instrumenting')
		} catch (e) {
			Agent.logger.error('Could not start meteor-elastic-apm')
			throw e
		}
	} else {
		Agent.logger.warn('meteor-elastic-apm is not active')
	}
}
