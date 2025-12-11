import type { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PlaylistLock, RundownLock } from '../../jobs/lock.js'
import { logger } from '../../logging.js'

export class PlaylistLockImpl extends PlaylistLock {
	#isLocked = true

	public constructor(
		playlistId: RundownPlaylistId,
		private readonly doRelease: () => Promise<void>
	) {
		super(playlistId)
	}

	get isLocked(): boolean {
		return this.#isLocked
	}

	async release(): Promise<void> {
		if (!this.#isLocked) {
			logger.warn(`PlaylistLock: Already released "${this.playlistId}"`)
		} else {
			logger.silly(`PlaylistLock: Releasing "${this.playlistId}"`)

			this.#isLocked = false

			await this.doRelease()

			logger.silly(`PlaylistLock: Released "${this.playlistId}"`)

			if (this.deferedFunctions.length > 0) {
				for (const fcn of this.deferedFunctions) {
					await fcn()
				}
			}
		}
	}
}

export class RundownLockImpl extends RundownLock {
	#isLocked = true

	public constructor(
		rundownId: RundownId,
		private readonly doRelease: () => Promise<void>
	) {
		super(rundownId)
	}

	get isLocked(): boolean {
		return this.#isLocked
	}

	async release(): Promise<void> {
		if (!this.#isLocked) {
			logger.warn(`RundownLock: Already released "${this.rundownId}"`)
		} else {
			logger.silly(`RundownLock: Releasing "${this.rundownId}"`)

			this.#isLocked = false

			await this.doRelease()

			logger.silly(`RundownLock: Released "${this.rundownId}"`)

			if (this.deferedFunctions.length > 0) {
				for (const fcn of this.deferedFunctions) {
					await fcn()
				}
			}
		}
	}
}
