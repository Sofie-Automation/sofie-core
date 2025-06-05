import React from 'react'
import Escape from './../lib/Escape'

interface IProps {
	shown: boolean
	displayOn?: 'document' | 'viewport'
	children?: React.ReactNode
}

export const FloatingInspector: React.FC<IProps> = function (props: IProps) {
	return props.shown ? <Escape to={props.displayOn ?? 'document'}>{props.children}</Escape> : null
}
