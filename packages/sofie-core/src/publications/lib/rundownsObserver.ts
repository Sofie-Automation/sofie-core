import type {
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundowns } from '../../collections'
import { PromiseDebounce } from './PromiseDebounce'
import type { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import type { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { logger } from '../../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { AbortScope, createChildAbort } from '../../lib/observerLifetime'

const REACTIVITY_DEBOUNCE = 20

/**
 * Called whenever the set of rundowns changes, with the signal scoping whatever it starts: that signal is
 * aborted before the next invocation, and when the observer itself stops.
 */
type ChangedHandler = (rundownIds: RundownId[], invocationSignal: AbortSignal) => Promise<void>

/**
 * A mongo observer/query for the RundownIds in a playlist.
 * Note: Updates are debounced to avoid rapid updates firing
 */
export class RundownsObserver {
	#rundownIds: Set<RundownId> = new Set<RundownId>()
	readonly #changed: ChangedHandler
	readonly #signal: AbortSignal

	/** The lifetime of whatever the last invocation of `#changed` started */
	#invocation: AbortScope | undefined

	readonly #triggerUpdateRundownContent: PromiseDebounce

	private constructor(onChanged: ChangedHandler, signal: AbortSignal) {
		this.#changed = onChanged
		this.#signal = signal

		this.#triggerUpdateRundownContent = new PromiseDebounce(
			async () => {
				try {
					// End the previous invocation's scope before starting the next
					this.#invocation?.abort()

					const invocation = createChildAbort(this.#signal)
					this.#invocation = invocation

					await this.#changed(this.rundownIds, invocation.signal)
				} catch (e) {
					logger.error(`Error in RundownsObserver triggerUpdateRundownContent: ${stringifyError(e)}`)
				}
			},
			REACTIVITY_DEBOUNCE,
			signal
		)
	}

	static async createForPlaylist(
		studioId: StudioId,
		playlistId: RundownPlaylistId,
		signal: AbortSignal,
		onChanged: ChangedHandler
	): Promise<RundownsObserver> {
		const observer = new RundownsObserver(onChanged, signal)

		await observer.init({
			playlistId,
			studioId,
		})

		return observer
	}

	static async createForPeripheralDevice(
		// studioId: StudioId, // TODO - this?
		deviceId: PeripheralDeviceId,
		signal: AbortSignal,
		onChanged: ChangedHandler
	): Promise<RundownsObserver> {
		const observer = new RundownsObserver(onChanged, signal)

		await observer.init({
			'source.type': 'nrcs',
			'source.peripheralDeviceId': deviceId,
		})

		return observer
	}

	private async init(query: MongoQuery<Rundown>) {
		await Rundowns.observe(
			query,
			{
				added: (doc) => {
					this.#rundownIds.add(doc._id)
					this.#triggerUpdateRundownContent.trigger()
				},
				changed: (doc) => {
					this.#rundownIds.add(doc._id)
					this.#triggerUpdateRundownContent.trigger()
				},
				removed: (doc) => {
					this.#rundownIds.delete(doc._id)
					this.#triggerUpdateRundownContent.trigger()
				},
			},
			{
				projection: {
					_id: 1,
				},
				signal: this.#signal,
			}
		)

		this.#triggerUpdateRundownContent.trigger()
	}

	public get rundownIds(): RundownId[] {
		return Array.from(this.#rundownIds)
	}
}
