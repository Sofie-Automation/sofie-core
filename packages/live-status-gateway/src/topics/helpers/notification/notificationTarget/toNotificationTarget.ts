import {
	DBNotificationTarget,
	DBNotificationTargetPartInstance,
	DBNotificationTargetPieceInstance,
	DBNotificationTargetRundown,
	DBNotificationTargetRundownPlaylist,
	DBNotificationTargetType,
} from '@sofie-automation/corelib/dist/dataModel/Notifications'
import {
	NotificationTargetPartInstance,
	NotificationTargetPieceInstance,
	NotificationTargetRundown,
	NotificationTargetRundownPlaylist,
	NotificationTargetType,
	NotificationTargetUnknown,
} from '@sofie-automation/live-status-gateway-api'
import { assertNever, literal, unprotectString } from '@sofie-automation/server-core-integration'

type NotificationTarget =
	| NotificationTargetRundown
	| NotificationTargetRundownPlaylist
	| NotificationTargetPartInstance
	| NotificationTargetPieceInstance

export function toNotificationTarget(dbTarget: DBNotificationTarget): NotificationTarget | NotificationTargetUnknown {
	switch (dbTarget.type) {
		case DBNotificationTargetType.PARTINSTANCE:
			return toNotificationTargetPartInstance(dbTarget)
		case DBNotificationTargetType.RUNDOWN:
			return toNotificationTargetRundown(dbTarget)
		case DBNotificationTargetType.PLAYLIST:
			return toNotificationTargetPlaylist(dbTarget)
		case DBNotificationTargetType.PIECEINSTANCE:
			return toNotificationTargetPieceInstance(dbTarget)
		default:
			assertNever(dbTarget)
			return literal<NotificationTargetUnknown>({ type: NotificationTargetType.UNKNOWN })
	}
}

function toNotificationTargetBase(dbTarget: DBNotificationTarget): Pick<NotificationTarget, 'studioId'> {
	return literal<Pick<NotificationTarget, 'studioId'>>({
		studioId: unprotectString(dbTarget.studioId),
	})
}

function toNotificationTargetRundown(dbTarget: DBNotificationTargetRundown): NotificationTargetRundown {
	return literal<NotificationTargetRundown>({
		...toNotificationTargetBase(dbTarget),
		type: NotificationTargetType.RUNDOWN,
		rundownId: unprotectString(dbTarget.rundownId),
	})
}

function toNotificationTargetPartInstance(dbTarget: DBNotificationTargetPartInstance): NotificationTargetPartInstance {
	return literal<NotificationTargetPartInstance>({
		...toNotificationTargetBase(dbTarget),
		type: NotificationTargetType.PART_INSTANCE,
		rundownId: unprotectString(dbTarget.rundownId),
		partInstanceId: unprotectString(dbTarget.partInstanceId),
	})
}

function toNotificationTargetPieceInstance(
	dbTarget: DBNotificationTargetPieceInstance
): NotificationTargetPieceInstance {
	return literal<NotificationTargetPieceInstance>({
		...toNotificationTargetBase(dbTarget),
		type: NotificationTargetType.PIECE_INSTANCE,
		rundownId: unprotectString(dbTarget.rundownId),
		partInstanceId: unprotectString(dbTarget.partInstanceId),
		pieceInstanceId: unprotectString(dbTarget.pieceInstanceId),
	})
}

function toNotificationTargetPlaylist(
	dbTarget: DBNotificationTargetRundownPlaylist
): NotificationTargetRundownPlaylist {
	return literal<NotificationTargetRundownPlaylist>({
		...toNotificationTargetBase(dbTarget),
		type: NotificationTargetType.PLAYLIST,
		playlistId: unprotectString(dbTarget.playlistId),
	})
}
