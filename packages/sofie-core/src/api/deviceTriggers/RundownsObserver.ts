import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundowns } from '../../collections'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PromiseDebounce } from '../../publications/lib/PromiseDebounce'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { logger } from '../../logging'
import { AbortScope, createChildAbort, runOnAbort } from '../../lib/observerLifetime'

const REACTIVITY_DEBOUNCE = 20

/**
 * Called whenever the set of rundowns changes. The signal scopes whatever it starts: it is aborted
 * before the next invocation, and when the observer itself stops.
 */
type ChangedHandler = (rundownIds: RundownId[], invocationSignal: AbortSignal) => Promise<void | (() => void)>

type RundownFields = '_id'
const rundownFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBRundown, RundownFields>>>({
	_id: 1,
})

export class RundownsObserver {
	#rundownIds: Set<RundownId> = new Set<RundownId>()
	readonly #changed: ChangedHandler
	readonly #signal: AbortSignal

	/** The lifetime of whatever the last invocation of `#changed` started */
	#invocation: AbortScope | undefined

	readonly #triggerUpdateRundownContent = new PromiseDebounce(async () => {
		try {
			if (this.#signal.aborted) return

			// End the previous invocation's scope before starting the next
			this.#invocation?.abort()

			const invocation = createChildAbort(this.#signal)
			this.#invocation = invocation

			const cleanup = await this.#changed(this.rundownIds, invocation.signal)

			// If this invocation was superseded, or the observer stopped, while we were awaiting, the
			// signal is already aborted and the cleanup runs immediately
			if (cleanup) runOnAbort(invocation.signal, cleanup)
		} catch (e) {
			logger.error(`Error in RundownsObserver triggerUpdateRundownContent: ${stringifyError(e)}`)
		}
	}, REACTIVITY_DEBOUNCE)

	private constructor(onChanged: ChangedHandler, signal: AbortSignal) {
		this.#changed = onChanged
		this.#signal = signal

		runOnAbort(signal, () => this.#triggerUpdateRundownContent.cancelWaiting())
	}

	static async create(
		playlistId: RundownPlaylistId,
		signal: AbortSignal,
		onChanged: ChangedHandler
	): Promise<RundownsObserver> {
		const observer = new RundownsObserver(onChanged, signal)

		await observer.init(playlistId)

		return observer
	}

	private async init(activePlaylistId: RundownPlaylistId) {
		await Rundowns.observeChanges(
			{
				playlistId: activePlaylistId,
			},
			{
				added: (rundownId) => {
					this.#rundownIds.add(rundownId)
					this.#triggerUpdateRundownContent.trigger()
				},
				removed: (rundownId) => {
					this.#rundownIds.delete(rundownId)
					this.#triggerUpdateRundownContent.trigger()
				},
			},
			{
				projection: rundownFieldSpecifier,
				signal: this.#signal,
			}
		)

		this.#triggerUpdateRundownContent.trigger()
	}

	public get rundownIds(): RundownId[] {
		return Array.from(this.#rundownIds)
	}
}
