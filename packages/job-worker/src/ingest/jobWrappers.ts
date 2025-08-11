import { IngestPropsBase } from '@sofie-automation/corelib/dist/worker/ingest'
import { JobContext } from '../jobs/index.js'
import {
	IngestUpdateOperationFunction,
	UpdateIngestRundownResult,
	runCustomIngestUpdateOperation,
	runIngestUpdateOperation,
} from './runOperation.js'
import { CommitIngestData } from './lock.js'
import { IngestModel } from './model/IngestModel.js'
import { IngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import { SofieIngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/SofieIngestDataCache'

/**
 * Wrap a mos specific ingest job to be an ingest update operation, with a provided function which runs a precheck and returns the final ingestRundown mutator
 * @param fcn Function to generate the ingestRundown mutator
 */
export function wrapMosIngestJob<TData extends IngestPropsBase>(
	fcn: (context: JobContext, data: TData) => IngestUpdateOperationFunction | null
): (context: JobContext, data: TData) => Promise<void> {
	return async (context, data) => {
		const executeFcn = fcn(context, data)
		if (!executeFcn) return

		await runIngestUpdateOperation(context, data, (ingestRundown) => {
			if (ingestRundown && ingestRundown.type !== 'mos') {
				throw new Error(`Rundown "${data.rundownExternalId}" is not a MOS rundown`)
			}

			return executeFcn(ingestRundown)
		})
	}
}

/**
 * Wrap an ingest job to be an ingest update operation, with a provided function which can mutate the ingestRundown
 * @param fcn Function to mutate the ingestRundown
 */
export function wrapGenericIngestJob<TData extends IngestPropsBase>(
	fcn: (
		context: JobContext,
		data: TData,
		oldIngestRundown: IngestRundownWithSource | undefined
	) => UpdateIngestRundownResult
): (context: JobContext, data: TData) => Promise<void> {
	return async (context, data) => {
		await runIngestUpdateOperation(context, data, (ingestRundown) => fcn(context, data, ingestRundown))
	}
}

/**
 * Wrap an ingest job to be an ingest update operation, with a provided function which runs a precheck and returns the final ingestRundown mutator
 * @param fcn Function to generate the ingestRundown mutator
 */
export function wrapGenericIngestJobWithPrecheck<TData extends IngestPropsBase>(
	fcn: (context: JobContext, data: TData) => IngestUpdateOperationFunction | null
): (context: JobContext, data: TData) => Promise<void> {
	return async (context, data) => {
		const executeFcn = fcn(context, data)
		if (!executeFcn) return

		await runIngestUpdateOperation(context, data, (ingestRundown) => executeFcn(ingestRundown))
	}
}

/**
 * Wrap an ingest job to be an ingest update operation, with a provided function to run the job to modify the IngestModel
 * @param fcn Function to mutate the IngestModel
 */
export function wrapCustomIngestJob<TData extends IngestPropsBase>(
	fcn: (
		context: JobContext,
		data: TData,
		ingestModel: IngestModel,
		ingestRundown: SofieIngestRundownWithSource
	) => Promise<CommitIngestData | null>
): (context: JobContext, data: TData) => Promise<void> {
	return async (context, data) => {
		await runCustomIngestUpdateOperation(context, data, async (_context, ingestModel, ingestRundown) => {
			return fcn(context, data, ingestModel, ingestRundown)
		})
	}
}
