declare type KeyboardLayoutMap = Map<string, string>

declare type KeyboardLayoutEvents = 'layoutchange'

declare interface Keyboard {
	getLayoutMap(): Promise<KeyboardLayoutMap>
	addEventListener(type: KeyboardLayoutEvents, listener: EventListener): void
	removeEventListener(type: KeyboardLayoutEvents, listener: EventListener): void
	lock(keyCodes?: string[]): Promise<undefined>
}

declare interface Navigator {
	keyboard: Keyboard
}
