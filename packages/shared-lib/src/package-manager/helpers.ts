import { ExpectedPackage } from './package.js'

// Note: These functions are copied from Package Manager

type Steps = Required<ExpectedPackage.ExpectedPackageHtmlTemplate['version']>['steps']

export function htmlTemplateGetSteps(version: ExpectedPackage.ExpectedPackageHtmlTemplate['version']): Steps {
	let steps: Steps
	if (version.casparCG) {
		// Generate a set of steps for standard CasparCG templates
		const casparData = version.casparCG.data
		const casparDataJSON = typeof casparData === 'string' ? casparData : JSON.stringify(casparData)
		steps = [
			{ do: 'waitForLoad' },
			{ do: 'takeScreenshot', fileName: 'idle.png' },
			{ do: 'startRecording', fileName: 'preview.webm' },
			{ do: 'executeJs', js: `update(${casparDataJSON})` },
			{ do: 'executeJs', js: `play()` },
			{ do: 'sleep', duration: 1000 },
			{ do: 'takeScreenshot', fileName: 'play.png' },
			{ do: 'executeJs', js: `stop()` },
			{ do: 'sleep', duration: 1000 },
			{ do: 'takeScreenshot', fileName: 'stop.png' },
			{ do: 'stopRecording' },
			{ do: 'cropRecording', fileName: 'preview-cropped.webm' },
		]
	} else {
		steps = version.steps || []
	}
	return steps
}
export function htmlTemplateGetFileNamesFromSteps(steps: Steps): {
	/** List of all file names that will be output from in the steps */
	fileNames: string[]
	/** The "main file", ie the file that will carry the main metadata */
	mainFileName: string | undefined
	/** File name of the main (first) screenshot */
	mainScreenShot: string | undefined
	/** File name of the main (first) recording */
	mainRecording: string | undefined
} {
	const fileNames: string[] = []
	let mainFileName: string | undefined = undefined
	let mainScreenShot: string | undefined = undefined
	let mainRecording: string | undefined = undefined

	for (const step of steps) {
		if (step.do === 'takeScreenshot') {
			fileNames.push(step.fileName)
			if (!mainFileName) mainFileName = step.fileName
			if (!mainScreenShot) mainScreenShot = step.fileName
		} else if (step.do === 'startRecording') {
			fileNames.push(step.fileName)
			mainFileName = step.fileName
			if (!mainRecording) mainRecording = step.fileName
		} else if (step.do === 'cropRecording') {
			fileNames.push(step.fileName)
		}
	}
	return { fileNames, mainFileName, mainScreenShot, mainRecording }
}
