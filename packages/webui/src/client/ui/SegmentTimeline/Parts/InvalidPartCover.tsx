import React, { useContext, useRef } from 'react'
import type { PartInvalidReason } from '@sofie-automation/corelib/dist/dataModel/Part'
import { type IPreviewPopUpSession, PreviewPopUpContext } from '../../PreviewPopUp/PreviewPopUpContext.js'

interface IProps {
	className?: string
	/**
	 * The effective invalidReason to display.
	 * Can be from Part (planned) or PartInstance (runtime).
	 */
	invalidReason: PartInvalidReason | undefined
}

export function InvalidPartCover({ className, invalidReason }: Readonly<IProps>): JSX.Element {
	const element = React.createRef<HTMLDivElement>()

	const previewContext = useContext(PreviewPopUpContext)
	const previewSession = useRef<IPreviewPopUpSession | null>(null)

	function onMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
		if (!element.current) {
			return
		}

		if (invalidReason?.message && !previewSession.current) {
			previewSession.current = previewContext.requestPreview(e.target as HTMLDivElement, [
				{
					type: 'warning',
					content: invalidReason.message,
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
