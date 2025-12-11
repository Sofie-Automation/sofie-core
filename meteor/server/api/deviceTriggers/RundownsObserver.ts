import { Meteor } from 'meteor/meteor'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundowns } from '../../collections'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PromiseDebounce } from '../../publications/lib/PromiseDebounce'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { logger } from '../../logging'

const REACTIVITY_DEBOUNCE = 20

type ChangedHandler = (rundownIds: RundownId[]) => Promise<() => void>

type RundownFields = '_id'
const rundownFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBRundown, RundownFields>>>({
	_id: 1,
})

export class RundownsObserver {
	#rundownsLiveQuery!: Meteor.LiveQueryHandle
	#rundownIds: Set<RundownId> = new Set<RundownId>()
	#changed: ChangedHandler | undefined
	#cleanup: (() => void) | undefined

	#disposed = false

	readonly #triggerUpdateRundownContent = new PromiseDebounce(async () => {
		try {
			if (this.#disposed) return

			if (!this.#changed) return
			this.#cleanup?.()

			const changed = this.#changed
			this.#cleanup = await changed(this.rundownIds)

			if (this.#disposed) this.#cleanup?.()
		} catch (e) {
			logger.error(`Error in RundownsObserver triggerUpdateRundownContent: ${stringifyError(e)}`)
		}
	}, REACTIVITY_DEBOUNCE)

	private constructor(onChanged: ChangedHandler) {
		this.#changed = onChanged
	}

	static async create(playlistId: RundownPlaylistId, onChanged: ChangedHandler): Promise<RundownsObserver> {
		const observer = new RundownsObserver(onChanged)

		await observer.init(playlistId)

		return observer
	}

	private async init(activePlaylistId: RundownPlaylistId) {
		this.#rundownsLiveQuery = await Rundowns.observeChanges(
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
			}
		)

		this.#triggerUpdateRundownContent.trigger()
	}

	public get rundownIds(): RundownId[] {
		return Array.from(this.#rundownIds)
	}

	public stop = (): void => {
		this.#disposed = true

		this.#triggerUpdateRundownContent.cancelWaiting()
		this.#rundownsLiveQuery.stop()
		this.#changed = undefined
		this.#cleanup?.()
	}
}
