import { TranslationsBundleId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TranslationsBundle } from '../collections/TranslationsBundles'
import { ClientAPI } from './client'

export interface CollectionCleanupResult {
	[index: string]: {
		collectionName: string
		docsToRemove: number
	}
}

export interface BenchmarkResult {
	mongoWriteSmall: number
	mongoWriteBig: number
	mongoRead: number
	mongoIndexedRead: number
	cpuCalculations: number
	cpuStringifying: number
}
export interface SystemBenchmarkResults {
	description: string
	results: BenchmarkResult
}

export interface SystemAPI {
	cleanupIndexes(actuallyRemoveOldIndexes: boolean): Promise<any>
	cleanupOldData(actuallyRemoveOldData: boolean): Promise<CollectionCleanupResult | string>

	runCronjob(): Promise<void>
	doSystemBenchmark(): Promise<SystemBenchmarkResults>

	getTranslationBundle(bundleId: TranslationsBundleId): Promise<ClientAPI.ClientResponse<TranslationsBundle>>
	generateSingleUseToken(): Promise<ClientAPI.ClientResponse<string>>
}

export enum SystemAPIMethods {
	'cleanupIndexes' = 'system.cleanupIndexes',
	'cleanupOldData' = 'system.cleanupOldData',
	'runCronjob' = 'system.runCronjob',
	'doSystemBenchmark' = 'system.doSystemBenchmark',
	'getTranslationBundle' = 'system.getTranslationBundle',
	'generateSingleUseToken' = 'system.generateSingleUseToken',
}
