import { PackageContainer } from '../../package-manager/package'

export interface StudioPackageContainer {
	/** List of which peripheraldevices uses this packageContainer */
	deviceIds: string[]
	container: PackageContainer
}
