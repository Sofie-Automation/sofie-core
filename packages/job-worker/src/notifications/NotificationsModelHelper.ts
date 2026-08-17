import { getCurrentTime } from '../lib/index.js'
import type { JobContext } from '../jobs/index.js'
import type { INotificationsModel, INotificationTarget, INotificationWithTarget } from './NotificationsModel.js'
import {
	DBNotificationTarget,
	DBNotificationTargetType,
	type DBNotificationObj,
} from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { getHash } from '@sofie-automation/corelib/dist/hash'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	assertNever,
	clone,
	deleteAllUndefinedProperties,
	flatten,
	omit,
	type Complete,
} from '@sofie-automation/corelib/dist/lib'
import { StudioId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { isEqual } from 'underscore'
import type { MongoBulkWriteOperation } from '../db/collections.js'

interface NotificationsLoadState {
	dbNotifications: ReadonlyMap<string, DBNotificationObj> | null
	updatedNotifications: Map<string, Omit<DBNotificationObj, 'created' | 'modified'> | null>

	removeAllMissing: boolean
}

export class NotificationsModelHelper implements INotificationsModel {
	readonly #context: JobContext
	readonly #categoryPrefix: string
	readonly #playlistId: RundownPlaylistId | null

	readonly #notificationsByCategory = new Map<string, NotificationsLoadState>()

	constructor(context: JobContext, categoryPrefix: string, playlistId: RundownPlaylistId | null) {
		this.#context = context
		this.#categoryPrefix = categoryPrefix
		this.#playlistId = playlistId
	}

	#getFullCategoryName(category: string): string {
		return `${this.#categoryPrefix}:${category}`
	}

	async #getAllNotificationsRaw(
		notificationsForCategory: NotificationsLoadState,
		category: string
	): Promise<ReadonlyMap<string, DBNotificationObj> | null> {
		if (!notificationsForCategory.dbNotifications) {
			const dbNotifications = await this.#context.directCollections.Notifications.findFetch({
				// Ensure notifiations are owned by the current studio
				'relatedTo.studioId': this.#context.studioId,
				// Limit to the current category
				category: this.#getFullCategoryName(category),
			})

			const dbNotificationMap = new Map<string, DBNotificationObj>()

			// Interleave into the store, for any which haven't already been updated
			for (const dbNotification of dbNotifications) {
				dbNotificationMap.set(dbNotification.localId, dbNotification)
			}

			// Indicate that this is now fully loaded in memory
			notificationsForCategory.dbNotifications = dbNotificationMap

			return dbNotificationMap
		}

		return null
	}

	async getAllNotifications(category: string): Promise<INotificationWithTarget[]> {
		const notificationsForCategory = this.#getOrCreateCategoryEntry(category)

		await this.#getAllNotificationsRaw(notificationsForCategory, category)

		const allLocalIds = new Set<string>([
			...Array.from(notificationsForCategory.updatedNotifications.keys()),
			...(notificationsForCategory.dbNotifications
				? Array.from(notificationsForCategory.dbNotifications.keys())
				: []),
		])

		const allNotifications: INotificationWithTarget[] = []
		for (const localId of allLocalIds) {
			const notification = notificationsForCategory.updatedNotifications.has(localId)
				? notificationsForCategory.updatedNotifications.get(localId)
				: notificationsForCategory.dbNotifications?.get(localId)

			const relatedTo = notification && translateRelatedToFromDbType(notification.relatedTo)
			if (!relatedTo) continue

			allNotifications.push({
				id: notification.localId,
				severity: notification.severity,
				message: notification.message,
				relatedTo: relatedTo,
			})
		}

		return allNotifications
	}

	clearNotification(category: string, notificationId: string): void {
		const notificationsForCategory = this.#getOrCreateCategoryEntry(category)

		// The notification may or may not be loaded, but this indicates that to the saving that we intend to delete it
		notificationsForCategory.updatedNotifications.set(notificationId, null)
	}

	setNotification(category: string, notification: INotificationWithTarget): void {
		const notificationsForCategory = this.#getOrCreateCategoryEntry(category)

		const fullCategory = this.#getFullCategoryName(category)

		// Clone and strip all undefined properties
		const newNotification = clone({
			_id: protectString(getHash(`${this.#context.studioId}:${fullCategory}:${notification.id}`)),
			category: fullCategory,
			localId: notification.id,
			severity: notification.severity,
			message: notification.message,
			relatedTo: translateRelatedToIntoDbType(this.#context.studioId, this.#playlistId, notification.relatedTo),
		} satisfies Complete<Omit<DBNotificationObj, 'created' | 'modified'>>)
		deleteAllUndefinedProperties(newNotification)

		notificationsForCategory.updatedNotifications.set(notification.id, newNotification)
	}

	clearAllNotifications(category: string): void {
		const notificationsForCategory = this.#getOrCreateCategoryEntry(category)

		// Tell this store that any documents not in the `updatedNotifications` should be deleted
		notificationsForCategory.removeAllMissing = true

		// Clear any known in memory notifications
		notificationsForCategory.updatedNotifications.clear()
	}

	#getOrCreateCategoryEntry(category: string): NotificationsLoadState {
		let notificationsForCategory = this.#notificationsByCategory.get(category)
		if (!notificationsForCategory) {
			notificationsForCategory = {
				dbNotifications: null,
				updatedNotifications: new Map(),

				removeAllMissing: false,
			}
			this.#notificationsByCategory.set(category, notificationsForCategory)
		}
		return notificationsForCategory
	}

	/** Whether any notification changes are pending that have not yet been saved to the database */
	get hasChanges(): boolean {
		for (const notificationsForCategory of this.#notificationsByCategory.values()) {
			if (categoryHasChanges(notificationsForCategory)) return true
		}
		return false
	}

	async saveAllToDatabase(): Promise<void> {
		// Quick return if there is nothing to save
		if (this.#notificationsByCategory.size === 0) return

		const now = getCurrentTime()

		const allUpdates = flatten(
			await Promise.all(
				Array.from(this.#notificationsByCategory).map(async ([category, notificationsForCategory]) => {
					/**
					 * This isn't the most efficient, to be loading all the notifications for every modified category,
					 * but it's a lot simpler than an optimal solution. The documents should be small and compact, so it should be quick enough.
					 */

					const dbNotifications =
						notificationsForCategory.dbNotifications ??
						(await this.#getAllNotificationsRaw(notificationsForCategory, category))

					const allLocalIds = new Set<string>([
						...Array.from(notificationsForCategory.updatedNotifications.keys()),
						...(dbNotifications ? Array.from(dbNotifications.keys()) : []),
					])

					const updates: MongoBulkWriteOperation<DBNotificationObj>[] = []
					const localIdsToKeep: string[] = []
					const localIdsToDelete: string[] = []
					for (const localId of allLocalIds) {
						const updatedNotification = notificationsForCategory.updatedNotifications.get(localId)
						const dbNotification = dbNotifications?.get(localId)

						// Marked for deletion
						if (updatedNotification === null) {
							if (dbNotification) {
								// This notification has been deleted
								localIdsToDelete.push(localId)
							}
							continue
						}

						// No change made, keep it
						if (updatedNotification === undefined) {
							if (!notificationsForCategory.removeAllMissing) {
								localIdsToKeep.push(localId)
							}
							continue
						}

						localIdsToKeep.push(localId)

						if (
							!dbNotification ||
							!isEqual(omit(dbNotification, 'created', 'modified'), updatedNotification)
						) {
							updates.push({
								replaceOne: {
									filter: {
										_id: updatedNotification._id,
									},
									replacement: {
										...updatedNotification,
										created: dbNotification?.created ?? now,
										modified: now,
									},
									upsert: true,
								},
							})
						}
					}

					if (notificationsForCategory.removeAllMissing) {
						updates.push({
							deleteMany: {
								filter: {
									'relatedTo.studioId': this.#context.studioId,
									category: this.#getFullCategoryName(category),
									localId: { $nin: localIdsToKeep },
								},
							},
						})
					} else if (localIdsToDelete.length > 0) {
						// Some documents were deleted
						updates.push({
							deleteMany: {
								filter: {
									'relatedTo.studioId': this.#context.studioId,
									category: this.#getFullCategoryName(category),
									localId: { $in: localIdsToDelete },
								},
							},
						})
					}

					return updates
				})
			)
		)

		this.#notificationsByCategory.clear()

		if (allUpdates.length > 0) {
			await this.#context.directCollections.Notifications.bulkWrite(allUpdates)
		}
	}
}

/**
 * Whether the operations queued for a category will result in any modification to the database.
 * If the database state hasn't been loaded, the effect of the queued operations is unknown so they are assumed to be
 * changes.
 */
function categoryHasChanges(notificationsForCategory: NotificationsLoadState): boolean {
	const { dbNotifications, updatedNotifications, removeAllMissing } = notificationsForCategory

	// Nothing has been queued
	if (updatedNotifications.size === 0 && !removeAllMissing) return false

	// The database state is unknown, so assume the queued operations will change something
	if (!dbNotifications) return true

	for (const [localId, updatedNotification] of updatedNotifications) {
		const dbNotification = dbNotifications.get(localId)

		if (updatedNotification === null) {
			// Marked for deletion, which is only a change if it exists in the database
			if (dbNotification) return true
		} else if (!dbNotification || !isEqual(omit(dbNotification, 'created', 'modified'), updatedNotification)) {
			return true
		}
	}

	if (removeAllMissing) {
		// Any notification in the database which isn't being kept will be deleted
		for (const localId of dbNotifications.keys()) {
			if (!updatedNotifications.get(localId)) return true
		}
	}

	return false
}

function translateRelatedToIntoDbType(
	studioId: StudioId,
	playlistId: RundownPlaylistId | null,
	relatedTo: INotificationTarget
): DBNotificationTarget {
	switch (relatedTo.type) {
		case 'playlist':
			if (!playlistId) throw new Error('Cannot create a playlist related notification without a playlist')
			return { type: DBNotificationTargetType.PLAYLIST, studioId, playlistId }
		case 'rundown':
			return {
				type: DBNotificationTargetType.RUNDOWN,
				studioId,
				rundownId: relatedTo.rundownId,
			}
		case 'partInstance':
			return {
				type: DBNotificationTargetType.PARTINSTANCE,
				studioId,
				rundownId: relatedTo.rundownId,
				partInstanceId: relatedTo.partInstanceId,
			}
		case 'pieceInstance':
			return {
				type: DBNotificationTargetType.PIECEINSTANCE,
				studioId,
				rundownId: relatedTo.rundownId,
				partInstanceId: relatedTo.partInstanceId,
				pieceInstanceId: relatedTo.pieceInstanceId,
			}
		default:
			assertNever(relatedTo)
			throw new Error(`Unknown relatedTo type: ${relatedTo}`)
	}
}

function translateRelatedToFromDbType(relatedTo: DBNotificationTarget): INotificationTarget | null {
	switch (relatedTo.type) {
		case DBNotificationTargetType.PLAYLIST:
			return { type: 'playlist' }
		case DBNotificationTargetType.RUNDOWN:
			return {
				type: 'rundown',
				rundownId: relatedTo.rundownId,
			}
		case DBNotificationTargetType.PARTINSTANCE:
			return {
				type: 'partInstance',
				rundownId: relatedTo.rundownId,
				partInstanceId: relatedTo.partInstanceId,
			}
		case DBNotificationTargetType.PIECEINSTANCE:
			return {
				type: 'pieceInstance',
				rundownId: relatedTo.rundownId,
				partInstanceId: relatedTo.partInstanceId,
				pieceInstanceId: relatedTo.pieceInstanceId,
			}
		// case DBNotificationTargetType.EVERYWHERE:
		// case DBNotificationTargetType.STUDIO:
		// case DBNotificationTargetType.SEGMENT:
		// case DBNotificationTargetType.PART:
		// case DBNotificationTargetType.PIECE:
		// return null
		default:
			assertNever(relatedTo)
			return null
	}
}
