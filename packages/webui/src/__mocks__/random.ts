export class RandomMock {
	static mockIds: Array<string> = []
	static mockI = 9000

	static id(): string {
		let id = this.mockIds.shift()
		if (!id) id = 'randomId' + RandomMock.mockI++
		return id
	}
	/** Returns a "mocked random" number 0-1 */
	static number(): number {
		return (RandomMock.mockI++ / 1.6180339887) % 1
	}
}
export function setup(): any {
	return {
		Random: RandomMock,
		nanoid: RandomMock.id.bind(RandomMock),
		customAlphabet: () => RandomMock.id.bind(RandomMock),
	}
}

export function restartRandomId(): void {
	RandomMock.mockI = 9000
	RandomMock.mockIds = []
}

export function resetRandomId(): void {
	// move the iterator forward and tie to next 1000
	// This will help with making the random id more consistend in tests
	RandomMock.mockI += 500
	RandomMock.mockI += 1000 - (RandomMock.mockI % 1000)
}
