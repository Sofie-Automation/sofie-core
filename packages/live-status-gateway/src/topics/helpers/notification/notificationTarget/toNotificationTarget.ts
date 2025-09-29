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
} from '@sofie-automation/live-status-gateway-api'
import { literal, unprotectString } from '@sofie-automation/server-core-integration'

type NotificationTarget =
	| NotificationTargetRundown
	| NotificationTargetRundownPlaylist
	| NotificationTargetPartInstance
	| NotificationTargetPieceInstance

export function toNotificationTarget(dbTarget: DBNotificationTarget): NotificationTarget {
	switch (dbTarget.type) {
		case DBNotificationTargetType.PARTINSTANCE:
			return toNotificationTargetPartInstance(dbTarget)
		case DBNotificationTargetType.RUNDOWN:
			return toNotificationTargetRundown(dbTarget)
		case DBNotificationTargetType.PLAYLIST:
			return toNotificationTargetPlaylist(dbTarget)
		case DBNotificationTargetType.PIECEINSTANCE:
			return toNotificationTargetPieceInstance(dbTarget)
	}
}

function toNotificationTargetBase(dbTarget: DBNotificationTarget): Pick<NotificationTarget, 'type' | 'studioId'> {
	return literal<Pick<NotificationTarget, 'type' | 'studioId'>>({
		type: toNotificationTargetType(dbTarget.type),
		studioId: unprotectString(dbTarget.studioId),
	})
}

function toNotificationTargetType(dbTargetType: DBNotificationTargetType): NotificationTargetType {
	switch (dbTargetType) {
		case DBNotificationTargetType.PARTINSTANCE:
			return NotificationTargetType.PART_INSTANCE
		case DBNotificationTargetType.PIECEINSTANCE:
			return NotificationTargetType.PART_INSTANCE
		case DBNotificationTargetType.RUNDOWN:
			return NotificationTargetType.RUNDOWN
		case DBNotificationTargetType.PLAYLIST:
			return NotificationTargetType.PLAYLIST
	}
}

function toNotificationTargetRundown(dbTarget: DBNotificationTargetRundown): NotificationTargetRundown {
	return literal<NotificationTargetRundown>({
		...toNotificationTargetBase(dbTarget),
		rundownId: unprotectString(dbTarget.rundownId),
	})
}

function toNotificationTargetPartInstance(dbTarget: DBNotificationTargetPartInstance): NotificationTargetPartInstance {
	return literal<NotificationTargetPartInstance>({
		...toNotificationTargetRundown({
			type: DBNotificationTargetType.RUNDOWN,
			studioId: dbTarget.studioId,
			rundownId: dbTarget.rundownId,
		}),
		type: NotificationTargetType.PART_INSTANCE,
		partInstanceId: unprotectString(dbTarget.partInstanceId),
	})
}

function toNotificationTargetPieceInstance(
	dbTarget: DBNotificationTargetPieceInstance
): NotificationTargetPieceInstance {
	return literal<NotificationTargetPieceInstance>({
		...toNotificationTargetPartInstance({
			type: DBNotificationTargetType.PARTINSTANCE,
			studioId: dbTarget.studioId,
			rundownId: dbTarget.rundownId,
			partInstanceId: dbTarget.partInstanceId,
		}),
		type: NotificationTargetType.PIECE_INSTANCE,
		pieceInstanceId: unprotectString(dbTarget.pieceInstanceId),
	})
}

function toNotificationTargetPlaylist(
	dbTarget: DBNotificationTargetRundownPlaylist
): NotificationTargetRundownPlaylist {
	return literal<NotificationTargetRundownPlaylist>({
		...toNotificationTargetBase(dbTarget),
		playlistId: unprotectString(dbTarget.playlistId),
	})
}
