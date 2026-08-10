export function setVideoElementPosition(
	vEl: HTMLVideoElement,
	timePosition: number,
	itemDuration: number,
	seek: number,
	loop: boolean
): void {
	let targetTime = timePosition + seek
	if (loop && vEl.duration > 0) {
		const loopWindowMs = itemDuration > 0 ? Math.min(vEl.duration * 1000, itemDuration) : vEl.duration * 1000
		targetTime = ((targetTime % loopWindowMs) + loopWindowMs) % loopWindowMs
	} else if (itemDuration > 0) {
		targetTime = Math.max(0, Math.min(targetTime, itemDuration))
	}
	vEl.currentTime = targetTime / 1000
}
