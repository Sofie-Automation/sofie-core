import { RawAgent } from './apm'

class Profiler {
	private active = false

	startSpan(_name: string) {
		if (!this.active) return
		return RawAgent.startSpan(_name)
	}

	startTransaction(description: string, name: string) {
		if (!this.active) return
		return RawAgent.startTransaction(description, name)
	}

	setActive(active: boolean) {
		this.active = active
	}
}

const profiler = new Profiler()

export { profiler }
