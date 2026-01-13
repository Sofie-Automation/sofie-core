import React, { JSX } from 'react'
import Tooltip from 'rc-tooltip'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import {
	WarningIconSmall,
	HourglassIconSmall,
	OKIconSmall,
	WarningIconSmallWorkingOnIt,
} from '../../lib/ui/icons/notifications.js'

export const MediaStatusIndicator = React.memo(function MediaStatusIndicator({
	status,
	overlay,
	isWorking,
}: {
	status: PieceStatusCode | undefined
	overlay: string | undefined
	isWorking: boolean
}): JSX.Element | null {
	let icon: JSX.Element | null = null
	switch (status) {
		case PieceStatusCode.OK:
			icon = <OKIconSmall />
			break
		case PieceStatusCode.SOURCE_NOT_READY:
			icon = <HourglassIconSmall />
			break
		case PieceStatusCode.SOURCE_BROKEN:
		case PieceStatusCode.SOURCE_HAS_ISSUES:
		case PieceStatusCode.SOURCE_MISSING:
		case PieceStatusCode.SOURCE_NOT_SET:
		case PieceStatusCode.UNKNOWN:
		case undefined:
		case PieceStatusCode.SOURCE_UNKNOWN_STATE:
			icon = isWorking ? <WarningIconSmallWorkingOnIt /> : <WarningIconSmall />
			break
		default:
			assertNever(status)
			icon = <>Unknown: {status}</>
			break
	}

	const content = <span data-overlay={overlay}>{icon}</span>

	if (!overlay) {
		return content
	}

	return (
		<Tooltip overlay={overlay} trigger={['hover']} placement="top">
			{content}
		</Tooltip>
	)
})
