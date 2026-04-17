import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { ActivePlaylistTimingMode } from '@sofie-automation/live-status-gateway-api'
import { assertNever } from '@sofie-automation/shared-lib/dist/lib/lib'

export function translatePlaylistTimingType(type: PlaylistTimingType): ActivePlaylistTimingMode {
	switch (type) {
		case PlaylistTimingType.None:
			return ActivePlaylistTimingMode.NONE
		case PlaylistTimingType.BackTime:
			return ActivePlaylistTimingMode.BACK_MINUS_TIME
		case PlaylistTimingType.ForwardTime:
			return ActivePlaylistTimingMode.FORWARD_MINUS_TIME
		default:
			assertNever(type)
			// Cast and return the value anyway, so that the application works
			return type as any as ActivePlaylistTimingMode
	}
}
