import {
	PlayoutExecuteChangeOperationProps,
	UserExecuteChangeOperationProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { JobContext } from '../jobs/index.js'
import { UpdateIngestRundownResult, runIngestUpdateOperationBase } from './runOperation.js'
import { IngestChangeType } from '@sofie-automation/blueprints-integration'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString.js'

export async function handleUserExecuteChangeOperation(
	context: JobContext,
	data: UserExecuteChangeOperationProps
): Promise<void> {
	await runIngestUpdateOperationBase(context, data, async (nrcsIngestObjectCache) => {
		const nrcsIngestRundown = nrcsIngestObjectCache.fetchRundown()
		if (!nrcsIngestRundown) throw new Error(`Rundown "${data.rundownExternalId}" not found`)

		return {
			ingestRundown: nrcsIngestRundown,
			changes: {
				source: IngestChangeType.User,
				operation: data.operation as unknown as any,
				operationTarget: data.operationTarget,
			},
		} satisfies UpdateIngestRundownResult
	})
}

export async function handlePlayoutExecuteChangeOperation(
	context: JobContext,
	data: PlayoutExecuteChangeOperationProps
): Promise<void> {
	await runIngestUpdateOperationBase(context, data, async (nrcsIngestObjectCache) => {
		const nrcsIngestRundown = nrcsIngestObjectCache.fetchRundown()
		if (!nrcsIngestRundown) throw new Error(`Rundown "${data.rundownExternalId}" not found`)

		return {
			ingestRundown: nrcsIngestRundown,
			changes: {
				source: IngestChangeType.Playout,
				currentSegmentId: unprotectString(data.segmentId),
				currentPartId: unprotectString(data.partId),
				operation: data.operation as unknown as any,
			},
		} satisfies UpdateIngestRundownResult
	})
}
