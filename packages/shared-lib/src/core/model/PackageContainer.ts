import { PackageContainer } from '../../package-manager/package.js'

export interface StudioPackageContainer {
	/** List of which peripheraldevices uses this packageContainer */
	deviceIds: string[]
	container: PackageContainer
}

export interface StudioPackageContainerSettings {
	previewContainerIds: string[]
	thumbnailContainerIds: string[]
}
