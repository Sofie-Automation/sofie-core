import React, { useState } from 'react'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { InvalidFloatingInspector } from '../../FloatingInspectors/InvalidFloatingInspector'

interface IProps {
	className?: string
	part: DBPart
	align?: 'start' | 'center' | 'end'
}

export function InvalidPartCover({ className, part, align }: Readonly<IProps>): JSX.Element {
	const element = React.createRef<HTMLDivElement>()
	const [hover, setHover] = useState(false)
	const [position, setPosition] = useState({ left: 0, top: 0, width: 0, right: 0 })

	function onMouseEnter() {
		if (!element.current) {
			return
		}

		setHover(true)
		const rect = element.current.getBoundingClientRect()
		setPosition({
			top: rect.top + window.scrollY,
			left: rect.left + window.scrollX,
			right: rect.right + window.scrollX,
			width: rect.width,
		})
	}

	function onMouseLeave() {
		setHover(false)
	}

	return (
		<div className={className} ref={element} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
			<InvalidFloatingInspector
				part={part}
				showMiniInspector={hover}
				itemElement={element.current}
				position={{
					top: position.top,
					left: position.left,
					anchor: align ?? 'start',
					position: 'top',
				}}
			/>
		</div>
	)
}
