import React, { useContext, useRef } from 'react'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { IPreviewPopUpSession, PreviewPopUpContext } from '../../PreviewPopUp/PreviewPopUpContext.js'

interface IProps {
	className?: string
	part: DBPart
	align?: 'start' | 'center' | 'end'
}

export function InvalidPartCover({ className, part }: Readonly<IProps>): JSX.Element {
	const element = React.createRef<HTMLDivElement>()

	const previewContext = useContext(PreviewPopUpContext)
	const previewSession = useRef<IPreviewPopUpSession | null>(null)

	function onMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
		if (!element.current) {
			return
		}

		if (part.invalidReason?.message && !previewSession.current) {
			previewSession.current = previewContext.requestPreview(e.target as HTMLDivElement, [
				{
					type: 'warning',
					content: part.invalidReason?.message,
				},
			])
		}
	}

	function onMouseLeave() {
		if (previewSession.current) {
			previewSession.current.close()
			previewSession.current = null
		}
	}

	return (
		<div className={className} ref={element} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
			{/* TODOD - add back hover with warnings */}
		</div>
	)
}
