// eslint-disable-next-line n/no-extraneous-import
import babelJest from 'babel-jest'

export default babelJest.default.createTransformer({
	plugins: ['@babel/plugin-transform-modules-commonjs'],
	babelrc: false,
	configFile: false,
})
