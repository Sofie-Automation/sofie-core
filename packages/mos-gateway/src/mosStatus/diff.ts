import { IMOSObjectStatus } from '@mos-connection/connector'
import type { MosDeviceStatusesConfig } from '@sofie-automation/shared-lib/dist/generated/MosGatewayDevicesTypes'
import {
	IngestPartNotifyItemReady,
	IngestPartPlaybackStatus,
	IngestRundownActiveStatus,
	type IngestPartStatus,
	type IngestRundownStatus,
} from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'

export const MOS_STATUS_UNKNOWN = '' as IMOSObjectStatus // Force the status to be empty, which isn't a valid state in the enum

export type SomeStatusEntry = StoryStatusEntry | ItemStatusEntry

export interface ItemStatusEntry {
	type: 'item'
	rundownExternalId: string
	storyId: string
	itemId: string
	mosStatus: IMOSObjectStatus
}

export interface StoryStatusEntry {
	type: 'story'
	rundownExternalId: string
	storyId: string
	mosStatus: IMOSObjectStatus
}

export function diffStatuses(
	config: MosDeviceStatusesConfig,
	previousStatuses: IngestRundownStatus | undefined,
	newStatuses: IngestRundownStatus | undefined
): SomeStatusEntry[] {
	const rundownExternalId = previousStatuses?.externalId ?? newStatuses?.externalId

	if ((!previousStatuses && !newStatuses) || !rundownExternalId) return []

	const statuses: SomeStatusEntry[] = []

	const previousStories = buildStoriesMap(previousStatuses)
	const newStories = buildStoriesMap(newStatuses)

	// Process any removed stories first
	for (const [storyId, story] of previousStories) {
		if (!newStories.has(storyId)) {
			// The story has been removed
			statuses.push({
				type: 'story',
				rundownExternalId,
				storyId,
				mosStatus: MOS_STATUS_UNKNOWN,
			})

			// Clear any items too
			for (const itemStatus of story.itemsReady) {
				statuses.push({
					type: 'item',
					rundownExternalId,
					storyId,
					itemId: itemStatus.externalId,
					mosStatus: MOS_STATUS_UNKNOWN,
				})
			}
		}
	}

	// Then any remaining stories in order
	for (const [storyId, status] of newStories) {
		const previousStatus = previousStories.get(storyId)

		const newMosStatus = buildMosStatus(config, status.playbackStatus, status.isReady, newStatuses?.active)
		if (
			newMosStatus !== null &&
			(!previousStatus ||
				buildMosStatus(
					config,
					previousStatus.playbackStatus,
					previousStatus.isReady,
					previousStatuses?.active
				) !== newMosStatus)
		) {
			statuses.push({
				type: 'story',
				rundownExternalId,
				storyId,
				mosStatus: newMosStatus,
			})
		}

		const allItemIds = new Set<string>()
		const previousItemStatuses = new Map<string, IngestPartNotifyItemReady>()
		const newItemStatuses = new Map<string, IngestPartNotifyItemReady>()

		for (const itemStatus of previousStatus?.itemsReady ?? []) {
			previousItemStatuses.set(itemStatus.externalId, itemStatus)
			allItemIds.add(itemStatus.externalId)
		}
		for (const itemStatus of status.itemsReady) {
			newItemStatuses.set(itemStatus.externalId, itemStatus)
			allItemIds.add(itemStatus.externalId)
		}

		// Diff each item in the story
		for (const itemId of allItemIds) {
			const newItemStatus = newItemStatuses.get(itemId)
			const previousItemStatus = previousItemStatuses.get(itemId)

			const newMosStatus = newItemStatus
				? buildMosStatus(config, status.playbackStatus, newItemStatus.ready, newStatuses?.active)
				: null
			const previousMosStatus =
				previousItemStatus && previousStatus
					? buildMosStatus(
							config,
							previousStatus.playbackStatus,
							previousItemStatus.ready,
							previousStatuses?.active
						)
					: null

			if ((newMosStatus !== null || previousMosStatus !== null) && previousMosStatus !== newMosStatus) {
				statuses.push({
					type: 'item',
					rundownExternalId,
					storyId,
					itemId,
					mosStatus: newMosStatus ?? MOS_STATUS_UNKNOWN,
				})
			}
		}
	}

	return statuses
}

function buildStoriesMap(state: IngestRundownStatus | undefined): Map<string, IngestPartStatus> {
	const stories = new Map<string, IngestPartStatus>()

	if (state) {
		for (const segment of state.segments) {
			for (const part of segment.parts) {
				stories.set(part.externalId, part)
			}
		}
	}

	return stories
}

function buildMosStatus(
	config: MosDeviceStatusesConfig,
	playbackStatus: IngestPartPlaybackStatus,
	isReady: boolean | null | undefined,
	active: IngestRundownActiveStatus | undefined
): IMOSObjectStatus | null {
	if (active === IngestRundownActiveStatus.INACTIVE) return MOS_STATUS_UNKNOWN
	if (active === IngestRundownActiveStatus.REHEARSAL && !config.sendInRehearsal) return null

	switch (playbackStatus) {
		case IngestPartPlaybackStatus.PLAY:
			return IMOSObjectStatus.PLAY
		case IngestPartPlaybackStatus.STOP:
			return IMOSObjectStatus.STOP
		default:
			switch (isReady) {
				case true:
					return IMOSObjectStatus.READY
				case false:
					return IMOSObjectStatus.NOT_READY
				default:
					return MOS_STATUS_UNKNOWN
			}
	}
}
