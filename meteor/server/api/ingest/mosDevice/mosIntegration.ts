import { MOS } from '@sofie-automation/corelib'
import { logger } from '../../../logging'
import { fetchStudioIdFromDevice, generateRundownSource, runIngestOperation } from '../lib'
import { parseMosString } from './lib'
import { MethodContext } from '../../methodContext'
import { profiler } from '../../profiler'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { checkAccessAndGetPeripheralDevice } from '../../../security/check'

const apmNamespace = 'mosIntegration'

export namespace MosIntegration {
	export async function mosRoCreate(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		rundown: MOS.IMOSRunningOrder
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoCreate', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(id, token, context)
		const studioId = await fetchStudioIdFromDevice(peripheralDevice)

		const rundownExternalId = parseMosString(rundown.ID)

		logger.info(`mosRoCreate "${rundown.ID}"`)
		logger.debug(rundown)

		await runIngestOperation(studioId, IngestJobs.MosRundown, {
			rundownExternalId: rundownExternalId,
			isUpdateOperation: false,
			mosRunningOrder: rundown,
			rundownSource: generateRundownSource(peripheralDevice),
		})
		transaction?.end()
	}

	export async function mosRoReplace(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		rundown: MOS.IMOSRunningOrder
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoReplace', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(id, token, context)
		const studioId = await fetchStudioIdFromDevice(peripheralDevice)

		const rundownExternalId = parseMosString(rundown.ID)

		logger.info(`mosRoReplace "${rundown.ID}"`)
		logger.debug(rundown)

		await runIngestOperation(studioId, IngestJobs.MosRundown, {
			rundownExternalId: rundownExternalId,
			isUpdateOperation: false,
			mosRunningOrder: rundown,
			rundownSource: generateRundownSource(peripheralDevice),
		})

		transaction?.end()
	}

	export async function mosRoDelete(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		rundownId: MOS.IMOSString128
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoDelete', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(id, token, context)
		const studioId = await fetchStudioIdFromDevice(peripheralDevice)

		const rundownExternalId = parseMosString(rundownId)

		logger.info(`mosRoDelete "${rundownId}"`)

		await runIngestOperation(studioId, IngestJobs.RemoveRundown, {
			rundownExternalId,
		})

		transaction?.end()
	}

	export async function mosRoMetadata(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		rundownData: MOS.IMOSRunningOrderBase
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoMetadata', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(id, token, context)
		const studioId = await fetchStudioIdFromDevice(peripheralDevice)

		const rundownExternalId = parseMosString(rundownData.ID)

		logger.info(`mosRoMetadata "${rundownData.ID}"`)
		logger.debug(rundownData)

		await runIngestOperation(studioId, IngestJobs.MosRundownMetadata, {
			rundownExternalId: rundownExternalId,
			mosRunningOrderBase: rundownData,
			rundownSource: generateRundownSource(peripheralDevice),
		})

		transaction?.end()
	}

	export async function mosRoStatus(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		status: MOS.IMOSRunningOrderStatus
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoStatus', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(id, token, context)
		const studioId = await fetchStudioIdFromDevice(peripheralDevice)

		const rundownExternalId = parseMosString(status.ID)

		logger.info(`mosRoStatus "${rundownExternalId}"`)
		logger.debug(status)

		await runIngestOperation(studioId, IngestJobs.MosRundownStatus, {
			rundownExternalId: rundownExternalId,
			status: status.Status,
		})

		transaction?.end()
	}

	export async function mosRoStoryStatus(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		status: MOS.IMOSStoryStatus
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoStoryStatus', apmNamespace)

		await checkAccessAndGetPeripheralDevice(id, token, context)

		logger.debug(`mosRoStoryStatus NOT SUPPORTED "${status.ID}"`)
		logger.debug(status)

		transaction?.end()
	}

	export async function mosRoStoryInsert(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSROStory>
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoStoryInsert', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(id, token, context)
		const studioId = await fetchStudioIdFromDevice(peripheralDevice)

		const rundownExternalId = parseMosString(Action.RunningOrderID)

		logger.info(`mosRoStoryInsert before "${Action.StoryID}" Stories: ${Stories.map((s) => s.ID)}`)
		logger.debug(Action, Stories)

		await runIngestOperation(studioId, IngestJobs.MosInsertStory, {
			rundownExternalId: rundownExternalId,
			insertBeforeStoryId: Action.StoryID,
			replace: false,
			newStories: Stories,
		})

		transaction?.end()
	}
	export async function mosRoStoryReplace(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSROStory>
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoStoryReplace', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(id, token, context)
		const studioId = await fetchStudioIdFromDevice(peripheralDevice)

		const rundownExternalId = parseMosString(Action.RunningOrderID)

		logger.info(`mosRoStoryReplace "${Action.StoryID}" Stories: ${Stories.map((s) => s.ID)}`)
		logger.debug(Action, Stories)

		await runIngestOperation(studioId, IngestJobs.MosInsertStory, {
			rundownExternalId: rundownExternalId,
			insertBeforeStoryId: Action.StoryID,
			replace: true,
			newStories: Stories,
		})

		transaction?.end()
	}
	export async function mosRoStoryMove(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSString128>
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoStoryMove', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(id, token, context)
		const studioId = await fetchStudioIdFromDevice(peripheralDevice)

		const rundownExternalId = parseMosString(Action.RunningOrderID)

		logger.info(`mosRoStoryMove "${Action.StoryID}" Stories: ${Stories}`)

		await runIngestOperation(studioId, IngestJobs.MosMoveStory, {
			rundownExternalId: rundownExternalId,
			insertBeforeStoryId: Action.StoryID,
			stories: Stories,
		})

		transaction?.end()
	}

	export async function mosRoStoryDelete(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSROAction,
		Stories: Array<MOS.IMOSString128>
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoStoryDelete', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(id, token, context)
		const studioId = await fetchStudioIdFromDevice(peripheralDevice)

		const rundownExternalId = parseMosString(Action.RunningOrderID)

		logger.info(`mosRoStoryDelete "${rundownExternalId}" Stories: ${Stories}`)

		await runIngestOperation(studioId, IngestJobs.MosDeleteStory, {
			rundownExternalId: rundownExternalId,
			stories: Stories,
		})

		transaction?.end()
	}

	export async function mosRoStorySwap(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSROAction,
		StoryID0: MOS.IMOSString128,
		StoryID1: MOS.IMOSString128
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoStorySwap', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(id, token, context)
		const studioId = await fetchStudioIdFromDevice(peripheralDevice)

		const rundownExternalId = parseMosString(Action.RunningOrderID)

		logger.info(`mosRoStorySwap "${StoryID0}", "${StoryID1}"`)

		await runIngestOperation(studioId, IngestJobs.MosSwapStory, {
			rundownExternalId: rundownExternalId,
			story0: StoryID0,
			story1: StoryID1,
		})

		transaction?.end()
	}

	export async function mosRoReadyToAir(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSROReadyToAir
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoReadyToAir', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(id, token, context)
		const studioId = await fetchStudioIdFromDevice(peripheralDevice)

		const rundownExternalId = parseMosString(Action.ID)

		logger.info(`mosRoReadyToAir "${rundownExternalId}"`)
		logger.debug(Action)

		await runIngestOperation(studioId, IngestJobs.MosRundownReadyToAir, {
			rundownExternalId: rundownExternalId,
			status: Action.Status,
		})

		transaction?.end()
	}

	export async function mosRoFullStory(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		story: MOS.IMOSROFullStory
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoFullStory', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(id, token, context)
		const studioId = await fetchStudioIdFromDevice(peripheralDevice)

		logger.info(`mosRoFullStory "${story.ID}"`)

		await runIngestOperation(studioId, IngestJobs.MosFullStory, {
			rundownExternalId: parseMosString(story.RunningOrderId),
			story: story,
		})

		transaction?.end()
	}

	/**
	 * Unimplemented item methods.
	 * An item is an object within a Part. These do not directly map to a Piece
	 */
	export async function mosRoItemDelete(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		Items: Array<MOS.IMOSString128>
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoItemDelete', apmNamespace)

		await checkAccessAndGetPeripheralDevice(id, token, context)

		logger.warn(`mosRoItemDelete NOT SUPPORTED "${Action.StoryID}"`)
		logger.debug(Action, Items)

		transaction?.end()
	}

	export async function mosRoItemStatus(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		status: MOS.IMOSItemStatus
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoItemStatus', apmNamespace)

		await checkAccessAndGetPeripheralDevice(id, token, context)

		logger.warn(`mosRoItemStatus NOT SUPPORTED "${status.ID}"`)
		logger.debug(status)

		transaction?.end()
	}

	export async function mosRoItemInsert(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSItem>
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoItemInsert', apmNamespace)

		await checkAccessAndGetPeripheralDevice(id, token, context)

		logger.warn(`mosRoItemInsert NOT SUPPORTED "${Action.ItemID}"`)
		logger.debug(Action, Items)

		transaction?.end()
	}

	export async function mosRoItemReplace(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSItem>
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoItemReplace', apmNamespace)

		await checkAccessAndGetPeripheralDevice(id, token, context)

		logger.warn(`mosRoItemReplace NOT SUPPORTED "${Action.ItemID}"`)
		logger.debug(Action, Items)

		transaction?.end()
	}

	export async function mosRoItemMove(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSString128>
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoItemMove', apmNamespace)

		await checkAccessAndGetPeripheralDevice(id, token, context)

		logger.warn(`mosRoItemMove NOT SUPPORTED "${Action.ItemID}"`)
		logger.debug(Action, Items)

		transaction?.end()
	}

	export async function mosRoItemSwap(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		ItemID0: MOS.IMOSString128,
		ItemID1: MOS.IMOSString128
	): Promise<void> {
		const transaction = profiler.startTransaction('mosRoItemSwap', apmNamespace)

		await checkAccessAndGetPeripheralDevice(id, token, context)

		logger.warn(`mosRoItemSwap NOT SUPPORTED "${ItemID0}", "${ItemID1}"`)
		logger.debug(Action, ItemID0, ItemID1)

		transaction?.end()
	}
}
