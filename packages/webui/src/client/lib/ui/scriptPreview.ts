const BREAK_SCRIPT_BREAKPOINT = 620
const SCRIPT_PART_LENGTH = 250

interface ScriptPreview {
	startOfScript: string
	endOfScript: string
	breakScript: boolean
}

export function getScriptPreview(fullScript: string): ScriptPreview {
	let startOfScript = fullScript
	let cutLength = startOfScript.length
	if (startOfScript.length > SCRIPT_PART_LENGTH) {
		startOfScript = startOfScript.substring(0, startOfScript.substr(0, SCRIPT_PART_LENGTH).lastIndexOf(' '))
		cutLength = startOfScript.length
	}
	let endOfScript = fullScript
	if (endOfScript.length > SCRIPT_PART_LENGTH) {
		endOfScript = endOfScript.substring(
			endOfScript.indexOf(' ', Math.max(cutLength, endOfScript.length - SCRIPT_PART_LENGTH)),
			endOfScript.length
		)
	}

	const breakScript = fullScript.length > BREAK_SCRIPT_BREAKPOINT

	return {
		startOfScript,
		endOfScript,
		breakScript,
	}
}
