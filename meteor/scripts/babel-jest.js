const babelJest = require('babel-jest')

module.exports = babelJest.default.createTransformer({
	plugins: [
		'@babel/plugin-transform-modules-commonjs',
		// Some workspace deps (e.g. server-core-integration) ship ESM that uses `export * as ns from`;
		// transform-modules-commonjs alone can't lower that, so include the namespace-from transform.
		'@babel/plugin-transform-export-namespace-from',
	],
	babelrc: false,
	configFile: false,
})
