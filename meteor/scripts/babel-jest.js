const babelJest = require('babel-jest')

module.exports = babelJest.default.createTransformer({
	plugins: ['@babel/plugin-transform-modules-commonjs'],
	babelrc: false,
	configFile: false,
})
