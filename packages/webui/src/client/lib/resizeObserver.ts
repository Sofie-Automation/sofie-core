export function onElementResize(
	el: HTMLElement,
	clb: (entries: ResizeObserverEntry[], observer: ResizeObserver) => void
): ResizeObserver {
	const resizeObserver = new ResizeObserver(clb)
	resizeObserver.observe(el)
	return resizeObserver
}

export function offElementResize(resizeObserver: ResizeObserver, el: HTMLElement): void {
	resizeObserver.unobserve(el)
}
