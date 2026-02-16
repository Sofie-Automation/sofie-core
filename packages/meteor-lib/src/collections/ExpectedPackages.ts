import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { assertNever, literal } from '@sofie-automation/corelib/dist/lib'
import deepExtend from 'deep-extend'
import {
	htmlTemplateGetSteps,
	htmlTemplateGetFileNamesFromSteps,
} from '@sofie-automation/shared-lib/dist/package-manager/helpers'
import { ReadonlyDeep } from 'type-fest'
import { StudioPackageContainerSettings } from '@sofie-automation/shared-lib/dist/core/model/PackageContainer'

export function getPreviewPackageSettings(
	expectedPackage: ExpectedPackage.Any
): ExpectedPackage.SideEffectPreviewSettings | undefined {
	if (expectedPackage.type === ExpectedPackage.PackageType.MEDIA_FILE) {
		const packagePath = expectedPackage.content.filePath
		if (packagePath) return { path: packagePath + '_preview.webm' }
		return undefined
	} else if (expectedPackage.type === ExpectedPackage.PackageType.QUANTEL_CLIP) {
		const packagePath = expectedPackage.content.guid || expectedPackage.content.title
		if (packagePath) return { path: packagePath + '_preview.webm' }
		return undefined
	} else if (expectedPackage.type === ExpectedPackage.PackageType.JSON_DATA) {
		return undefined // Not supported
	} else if (expectedPackage.type === ExpectedPackage.PackageType.HTML_TEMPLATE) {
		const steps = htmlTemplateGetSteps(expectedPackage.version)
		const o = htmlTemplateGetFileNamesFromSteps(steps)
		if (o.mainRecording) return { path: o.mainRecording }
		return undefined
	} else {
		assertNever(expectedPackage)
		return undefined
	}
}
export function getThumbnailPackageSettings(
	expectedPackage: ExpectedPackage.Any
): ExpectedPackage.SideEffectThumbnailSettings | undefined {
	if (expectedPackage.type === ExpectedPackage.PackageType.MEDIA_FILE) {
		const packagePath = expectedPackage.content.filePath
		if (packagePath) return { path: packagePath + '_thumbnail.png' }
		return undefined
	} else if (expectedPackage.type === ExpectedPackage.PackageType.QUANTEL_CLIP) {
		const packagePath = expectedPackage.content.guid || expectedPackage.content.title
		if (packagePath) return { path: packagePath + '_thumbnail.png' }
		return undefined
	} else if (expectedPackage.type === ExpectedPackage.PackageType.JSON_DATA) {
		return undefined // Not supported
	} else if (expectedPackage.type === ExpectedPackage.PackageType.HTML_TEMPLATE) {
		// temporary implementation:
		const steps = htmlTemplateGetSteps(expectedPackage.version)
		const o = htmlTemplateGetFileNamesFromSteps(steps)
		if (o.mainScreenShot) return { path: o.mainScreenShot }
		return undefined
	} else {
		assertNever(expectedPackage)
		return undefined
	}
}
export function getSideEffect(
	expectedPackage: ReadonlyDeep<ExpectedPackage.Base>,
	packageContainerSettings: StudioPackageContainerSettings
): ExpectedPackage.Base['sideEffect'] {
	return deepExtend(
		{},
		literal<ExpectedPackage.Base['sideEffect']>({
			previewContainerId: packageContainerSettings.previewContainerIds[0], // just pick the first. Todo: something else?
			thumbnailContainerId: packageContainerSettings.thumbnailContainerIds[0], // just pick the first. Todo: something else?
			previewPackageSettings: getPreviewPackageSettings(expectedPackage as ExpectedPackage.Any),
			thumbnailPackageSettings: getThumbnailPackageSettings(expectedPackage as ExpectedPackage.Any),
		}),
		expectedPackage.sideEffect
	)
}

export function getExpectedPackageFileName(expectedPackage: ExpectedPackage.Any): string | undefined {
	if (expectedPackage.type === ExpectedPackage.PackageType.MEDIA_FILE) {
		return expectedPackage.content.filePath
	} else if (expectedPackage.type === ExpectedPackage.PackageType.QUANTEL_CLIP) {
		return expectedPackage.content.guid || expectedPackage.content.title
	} else if (expectedPackage.type === ExpectedPackage.PackageType.JSON_DATA) {
		return undefined // Not supported
	} else if (expectedPackage.type === ExpectedPackage.PackageType.HTML_TEMPLATE) {
		return expectedPackage.content.path
	} else {
		assertNever(expectedPackage)
		return undefined
	}
}
