import * as React from 'react'
/** Add typings for custom css-variables */
export interface CSSProperties extends React.CSSProperties {
	'--invalid-reason-color-opaque': string
	'--invalid-reason-color-transparent': string
}
