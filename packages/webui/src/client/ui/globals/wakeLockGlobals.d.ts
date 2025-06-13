type WakeLockType = 'screen'

declare type WakeLockSentinel = {
	release(): void
	readonly released: boolean
	readonly type: WakeLockType
}

declare interface WakeLock {
	request(type: WakeLockType): Promise<WakeLockSentinel>
}

declare interface Navigator {
	wakeLock?: WakeLock
}
