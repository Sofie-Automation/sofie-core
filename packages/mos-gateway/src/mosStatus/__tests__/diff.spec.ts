import { protectString } from '@sofie-automation/server-core-integration'
import {
	IngestPartPlaybackStatus,
	IngestRundownActiveStatus,
	IngestRundownStatus,
} from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'
import { diffStatuses, ItemStatusEntry, MOS_STATUS_UNKNOWN, StoryStatusEntry } from '../diff.js'
import type { MosDeviceStatusesConfig } from '@sofie-automation/shared-lib/dist/generated/MosGatewayDevicesTypes'
import { IMOSObjectStatus } from '@mos-connection/connector'

describe('diffStatuses', () => {
	const defaultConfig: MosDeviceStatusesConfig = {
		enabled: true,
		sendInRehearsal: true,
		onlySendPlay: false,
	}
	const singlePartRundown: IngestRundownStatus = {
		_id: protectString('rundown0'),
		externalId: 'external0',
		active: IngestRundownActiveStatus.ACTIVE,
		segments: [
			{
				externalId: 'segment0',
				parts: [
					{
						externalId: 'part0',
						isReady: true,
						itemsReady: [],
						playbackStatus: IngestPartPlaybackStatus.UNKNOWN,
					},
				],
			},
		],
	}

	test('diff no changes', () => {
		const diff = diffStatuses(defaultConfig, singlePartRundown, singlePartRundown)
		expect(diff).toHaveLength(0)
	})

	test('part playback changes', () => {
		const partPlayingState = structuredClone(singlePartRundown)
		partPlayingState.segments[0].parts[0].playbackStatus = IngestPartPlaybackStatus.PLAY

		{
			// change to play
			const diff = diffStatuses(defaultConfig, singlePartRundown, partPlayingState)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'story',
				rundownExternalId: 'external0',
				storyId: 'part0',
				mosStatus: IMOSObjectStatus.PLAY,
			} satisfies StoryStatusEntry)
		}

		{
			const partStoppedState = structuredClone(partPlayingState)
			partStoppedState.segments[0].parts[0].playbackStatus = IngestPartPlaybackStatus.STOP

			// change to stop
			const diff = diffStatuses(defaultConfig, partPlayingState, partStoppedState)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'story',
				rundownExternalId: 'external0',
				storyId: 'part0',
				mosStatus: IMOSObjectStatus.STOP,
			} satisfies StoryStatusEntry)
		}

		{
			const partClearState = structuredClone(partPlayingState)
			partClearState.segments[0].parts[0].playbackStatus = IngestPartPlaybackStatus.UNKNOWN

			// change to clear
			const diff = diffStatuses(defaultConfig, partPlayingState, partClearState)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'story',
				rundownExternalId: 'external0',
				storyId: 'part0',
				mosStatus: IMOSObjectStatus.READY,
			} satisfies StoryStatusEntry)
		}
	})

	test('part ready changes', () => {
		const partNotReadyState = structuredClone(singlePartRundown)
		partNotReadyState.segments[0].parts[0].isReady = false

		{
			// change to not ready
			const diff = diffStatuses(defaultConfig, singlePartRundown, partNotReadyState)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'story',
				rundownExternalId: 'external0',
				storyId: 'part0',
				mosStatus: IMOSObjectStatus.NOT_READY,
			} satisfies StoryStatusEntry)
		}

		{
			// change to ready
			const diff = diffStatuses(defaultConfig, partNotReadyState, singlePartRundown)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'story',
				rundownExternalId: 'external0',
				storyId: 'part0',
				mosStatus: IMOSObjectStatus.READY,
			} satisfies StoryStatusEntry)
		}

		{
			const partClearState = structuredClone(partNotReadyState)
			partClearState.segments[0].parts[0].isReady = null

			// change to unknown
			const diff = diffStatuses(defaultConfig, partNotReadyState, partClearState)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'story',
				rundownExternalId: 'external0',
				storyId: 'part0',
				mosStatus: MOS_STATUS_UNKNOWN,
			} satisfies StoryStatusEntry)
		}
	})

	test('part added to rundown', () => {
		const extraPartState = structuredClone(singlePartRundown)
		extraPartState.segments[0].parts.push({
			externalId: 'part1',
			isReady: false,
			itemsReady: [],
			playbackStatus: IngestPartPlaybackStatus.UNKNOWN,
		})

		{
			const diff = diffStatuses(defaultConfig, singlePartRundown, extraPartState)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'story',
				rundownExternalId: 'external0',
				storyId: 'part1',
				mosStatus: IMOSObjectStatus.NOT_READY,
			} satisfies StoryStatusEntry)
		}
	})

	test('part removed from rundown', () => {
		const extraPartState = structuredClone(singlePartRundown)
		extraPartState.segments[0].parts.push({
			externalId: 'part1',
			isReady: false,
			itemsReady: [],
			playbackStatus: IngestPartPlaybackStatus.UNKNOWN,
		})

		{
			const diff = diffStatuses(defaultConfig, extraPartState, singlePartRundown)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'story',
				rundownExternalId: 'external0',
				storyId: 'part1',
				mosStatus: MOS_STATUS_UNKNOWN,
			} satisfies StoryStatusEntry)
		}
	})

	test('rundown becomes inactive', () => {
		const inactiveState = structuredClone(singlePartRundown)
		inactiveState.active = IngestRundownActiveStatus.INACTIVE

		{
			const diff = diffStatuses(defaultConfig, singlePartRundown, inactiveState)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'story',
				rundownExternalId: 'external0',
				storyId: 'part0',
				mosStatus: MOS_STATUS_UNKNOWN,
			} satisfies StoryStatusEntry)
		}
	})

	test('rundown becomes active', () => {
		const inactiveState = structuredClone(singlePartRundown)
		inactiveState.active = IngestRundownActiveStatus.INACTIVE

		{
			const diff = diffStatuses(defaultConfig, inactiveState, singlePartRundown)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'story',
				rundownExternalId: 'external0',
				storyId: 'part0',
				mosStatus: IMOSObjectStatus.READY,
			} satisfies StoryStatusEntry)
		}
	})

	test('rundown becomes rehearsal', () => {
		const inactiveState = structuredClone(singlePartRundown)
		inactiveState.active = IngestRundownActiveStatus.INACTIVE
		const rehearsalState = structuredClone(singlePartRundown)
		rehearsalState.active = IngestRundownActiveStatus.REHEARSAL

		{
			// send during rehearsal
			const diff = diffStatuses(defaultConfig, inactiveState, rehearsalState)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'story',
				rundownExternalId: 'external0',
				storyId: 'part0',
				mosStatus: IMOSObjectStatus.READY,
			} satisfies StoryStatusEntry)
		}

		{
			// no send during rehearsal
			const disableRehearsalConfig = {
				...defaultConfig,
				sendInRehearsal: false,
			}
			const diff = diffStatuses(disableRehearsalConfig, inactiveState, rehearsalState)
			expect(diff).toHaveLength(0)
		}
	})

	test('add items', () => {
		{
			const itemsState = structuredClone(singlePartRundown)
			itemsState.segments[0].parts[0].itemsReady.push({ externalId: 'item0', ready: true })

			const diff = diffStatuses(defaultConfig, singlePartRundown, itemsState)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'item',
				rundownExternalId: 'external0',
				storyId: 'part0',
				itemId: 'item0',
				mosStatus: IMOSObjectStatus.READY,
			} satisfies ItemStatusEntry)
		}

		{
			const itemsState = structuredClone(singlePartRundown)
			itemsState.segments[0].parts[0].itemsReady.push({ externalId: 'item0', ready: false })

			const diff = diffStatuses(defaultConfig, singlePartRundown, itemsState)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'item',
				rundownExternalId: 'external0',
				storyId: 'part0',
				itemId: 'item0',
				mosStatus: IMOSObjectStatus.NOT_READY,
			} satisfies ItemStatusEntry)
		}

		{
			const itemsState = structuredClone(singlePartRundown)
			// itemsState.segments[0].parts[0].itemsReady.item0 = undefined

			const diff = diffStatuses(defaultConfig, singlePartRundown, itemsState)
			expect(diff).toHaveLength(0)
		}
	})

	test('remove items', () => {
		{
			const itemsState = structuredClone(singlePartRundown)
			itemsState.segments[0].parts[0].itemsReady.push({ externalId: 'item0', ready: true })

			const diff = diffStatuses(defaultConfig, itemsState, singlePartRundown)
			expect(diff).toHaveLength(1)
			expect(diff[0]).toEqual({
				type: 'item',
				rundownExternalId: 'external0',
				storyId: 'part0',
				itemId: 'item0',
				mosStatus: MOS_STATUS_UNKNOWN,
			} satisfies ItemStatusEntry)
		}

		{
			const itemsState = structuredClone(singlePartRundown)
			// itemsState.segments[0].parts[0].itemsReady.item0 = undefined

			const diff = diffStatuses(defaultConfig, itemsState, singlePartRundown)
			expect(diff).toHaveLength(0)
		}
	})

	test('change item state', () => {
		const itemsState = structuredClone(singlePartRundown)
		itemsState.segments[0].parts[0].itemsReady.push({ externalId: 'item0', ready: true })

		const items2State = structuredClone(itemsState)
		items2State.segments[0].parts[0].itemsReady[0].ready = false

		const diff = diffStatuses(defaultConfig, itemsState, items2State)
		expect(diff).toHaveLength(1)
		expect(diff[0]).toEqual({
			type: 'item',
			rundownExternalId: 'external0',
			storyId: 'part0',
			itemId: 'item0',
			mosStatus: IMOSObjectStatus.NOT_READY,
		} satisfies ItemStatusEntry)
	})
})
