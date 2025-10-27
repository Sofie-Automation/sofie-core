const ticCache: Record<NamedCurve, number> = {}
/**
 * Performance debugging. tic() starts a timer, toc() traces the time since tic()
 * @param name
 */
export function tic(name = 'default'): void {
	ticCache[name] = Date.now()
}
export function toc(name = 'default', logStr?: string | Promise<any>[]): number | undefined {
	if (Array.isArray(logStr)) {
		logStr.forEach((promise, i) => {
			promise
				.then((result) => {
					toc(name, 'Promise ' + i)
					return result
				})
				.catch((e) => {
					throw e
				})
		})
	} else {
		const t: number = Date.now() - ticCache[name]
		if (logStr) console.info('toc: ' + name + ': ' + logStr + ': ' + t)
		return t
	}
}
