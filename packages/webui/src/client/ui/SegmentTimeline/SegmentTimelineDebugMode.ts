let DEBUG_MODE = false
;(window as any)['setDebugMode'] = (d: boolean) => {
	DEBUG_MODE = d
}
export { DEBUG_MODE }
