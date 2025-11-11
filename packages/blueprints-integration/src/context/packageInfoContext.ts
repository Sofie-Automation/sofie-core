import type { PackageInfo } from '../packageInfo.js'

export interface IPackageInfoContext {
	/**
	 * Get the PackageInfo items for an ExpectedPackage, if any have been reported by the package manager.
	 * Only info for packages with the `listenToPackageInfoUpdates` property set to true can be returned.
	 * The possible packageIds are scoped based on the ownership of the package.
	 * eg, baseline packages can be accessed when generating the baseline objects, piece/adlib packages can be access when regenerating the segment they are from
	 */
	getPackageInfo: (packageId: string) => Readonly<PackageInfo.Any[]>
	hackGetMediaObjectDuration: (mediaId: string) => Promise<number | undefined>
}
