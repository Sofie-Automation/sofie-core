const { defineConfig } = require('@meteorjs/rspack')

module.exports = defineConfig((Meteor) => ({
	// Exclude native modules from the bundle (use Meteor runtime)
	...(Meteor.isServer ? Meteor.compileWithMeteor(['threadedclass']) : {}),
}))
