import {
	ExpectedPackageDB,
	ExpectedPackageDBBase,
	ExpectedPackageFromRundown,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { JobContext } from '../../jobs/index.js'
import { ExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Filter as FilterQuery } from 'mongodb'
import { PackageInfo } from '@sofie-automation/blueprints-integration'
import { unprotectObjectArray } from '@sofie-automation/corelib/dist/protectedString'
import { ExpectedPackageForIngestModel, IngestModelReadonly } from '../../ingest/model/IngestModel.js'
import { ReadonlyDeep } from 'type-fest'

/**
 * This is a helper class to simplify exposing packageInfo to various places in the blueprints
 */
export class WatchedPackagesHelper {
	private readonly packages = new Map<ExpectedPackageId, ReadonlyDeep<ExpectedPackageDB>>()

	private constructor(
		packages: ReadonlyDeep<ExpectedPackageDB[]>,
		private readonly packageInfos: ReadonlyDeep<PackageInfoDB[]>
	) {
		for (const pkg of packages) {
			this.packages.set(pkg._id, pkg)
		}
	}

	/**
	 * Create a helper with no packages. This should be used where the api is in place, but the update flow hasnt been implemented yet so we don't want to expose any data
	 */
	static empty(_context: JobContext): WatchedPackagesHelper {
		return new WatchedPackagesHelper([], [])
	}

	/**
	 * Create a helper, and populate it with data from the database
	 * @param studioId The studio this is for
	 * @param filter A mongo query to specify the packages that should be included
	 */
	static async create<T extends ExpectedPackageDBBase = ExpectedPackageDBBase>(
		context: JobContext,
		filter: FilterQuery<Omit<T, 'studioId'>>
	): Promise<WatchedPackagesHelper> {
		// Load all the packages and the infos that are watched
		const watchedPackages = await context.directCollections.ExpectedPackages.findFetch({
			...filter,
			studioId: context.studioId,
		} as any) // TODO: don't use any here
		const watchedPackageInfos = await context.directCollections.PackageInfos.findFetch({
			studioId: context.studioId,
			packageId: { $in: watchedPackages.map((p) => p._id) },
		})

		return new WatchedPackagesHelper(watchedPackages, watchedPackageInfos)
	}

	/**
	 * Create a helper, and populate it with data from an IngestModel
	 * @param studioId The studio this is for
	 * @param ingestModel Model to fetch data for
	 */
	static async createForIngestRundown(
		context: JobContext,
		ingestModel: IngestModelReadonly
	): Promise<WatchedPackagesHelper> {
		const packages: ReadonlyDeep<ExpectedPackageForIngestModel>[] = []

		packages.push(...ingestModel.expectedPackagesForRundownBaseline)

		for (const segment of ingestModel.getAllSegments()) {
			for (const part of segment.parts) {
				packages.push(...part.expectedPackages)
			}
		}

		return this.#createFromPackages(
			context,
			packages.filter((pkg) => !!pkg.listenToPackageInfoUpdates)
		)
	}

	/**
	 * Create a helper, and populate it with data from an IngestModel
	 * @param studioId The studio this is for
	 * @param ingestModel Model to fetch data for
	 * @param segmentExternalIds ExternalId of Segments to be loaded
	 */
	static async createForIngestSegments(
		context: JobContext,
		ingestModel: IngestModelReadonly,
		segmentExternalIds: string[]
	): Promise<WatchedPackagesHelper> {
		const packages: ReadonlyDeep<ExpectedPackageFromRundown>[] = []

		for (const externalId of segmentExternalIds) {
			const segment = ingestModel.getSegmentByExternalId(externalId)
			if (!segment) continue // First ingest of the Segment

			for (const part of segment.parts) {
				packages.push(...part.expectedPackages)
			}
		}

		return this.#createFromPackages(
			context,
			packages.filter((pkg) => !!pkg.listenToPackageInfoUpdates)
		)
	}

	static async #createFromPackages(context: JobContext, packages: ReadonlyDeep<ExpectedPackageDB>[]) {
		// Load all the packages and the infos that are watched
		const watchedPackageInfos =
			packages.length > 0
				? await context.directCollections.PackageInfos.findFetch({
						studioId: context.studio._id,
						packageId: { $in: packages.map((p) => p._id) },
					})
				: []

		return new WatchedPackagesHelper(packages, watchedPackageInfos)
	}

	/**
	 * Create a new helper with a subset of the data in the current helper.
	 * This is useful so that all the data for a rundown can be loaded at the start of an ingest operation, and then subsets can be taken for particular blueprint methods without needing to do more db operations.
	 * @param func A filter to check if each package should be included
	 */
	filter(_context: JobContext, func: (pkg: ReadonlyDeep<ExpectedPackageDB>) => boolean): WatchedPackagesHelper {
		const watchedPackages: ReadonlyDeep<ExpectedPackageDB>[] = []
		for (const pkg of this.packages.values()) {
			if (func(pkg)) watchedPackages.push(pkg)
		}

		const newPackageIds = new Set(watchedPackages.map((p) => p._id))
		const watchedPackageInfos = this.packageInfos.filter((info) => newPackageIds.has(info.packageId))

		return new WatchedPackagesHelper(watchedPackages, watchedPackageInfos)
	}

	getPackage(packageId: ExpectedPackageId): ReadonlyDeep<ExpectedPackageDB> | undefined {
		return this.packages.get(packageId)
	}

	getPackageInfo(packageId: string): Readonly<Array<PackageInfo.Any>> {
		for (const pkg of this.packages.values()) {
			if (pkg.blueprintPackageId === packageId) {
				const info = this.packageInfos.filter((p) => p.packageId === pkg._id)
				return unprotectObjectArray(info)
			}
		}

		return []
	}
}
