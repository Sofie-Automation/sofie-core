import { ExpectedPackage, PackageContainer, PackageContainerOnPackage } from './package.js'
import { ExpectedPackageId, PeripheralDeviceId, RundownId, RundownPlaylistId } from '../core/model/Ids.js'
import { ProtectedString } from '../lib/protectedString.js'
import { ReadonlyDeep } from 'type-fest'

export interface PackageManagerPlayoutContext {
	_id: PeripheralDeviceId

	activePlaylist: PackageManagerActivePlaylist | null
	activeRundowns: PackageManagerActiveRundown[]
}

export interface PackageManagerActivePlaylist {
	_id: RundownPlaylistId
	active: boolean
	rehearsal: boolean
}
export interface PackageManagerActiveRundown {
	_id: RundownId
	_rank: number
}

export interface PackageManagerPackageContainers {
	_id: PeripheralDeviceId

	packageContainers: { [containerId: string]: PackageContainer }
}

export type PackageManagerExpectedPackageId = ProtectedString<'PackageManagerExpectedPackage'>

export type PackageManagerExpectedPackageBase = ReadonlyDeep<Omit<ExpectedPackage.Base, '_id'>> & {
	_id: ExpectedPackageId
}

export interface PackageManagerExpectedPackage {
	/** Unique id of the expectedPackage */
	_id: PackageManagerExpectedPackageId

	expectedPackage: PackageManagerExpectedPackageBase
	/** Lower should be done first. If not set, the priority is considered as low priority */
	priority: number | null
	sources: PackageContainerOnPackage[]
	targets: PackageContainerOnPackage[]
	playoutDeviceId: PeripheralDeviceId
}
