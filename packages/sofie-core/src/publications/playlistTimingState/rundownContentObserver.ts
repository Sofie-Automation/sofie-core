import {
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import {
	ContentCache,
	rundownPlaylistFieldSpecifier,
	segmentFieldSpecifier,
	StudioFields,
	studioFieldSpecifier,
	StudioSettingsDoc,
} from './reactiveContentCache'
import { RundownPlaylists, Segments, Studios } from '../../collections'
import { waitForAllObserversReady } from '../lib/lib'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import type { LiveQueryHandleSync } from '../../lib/lib'
import { observeUIParts } from '../partsUI/publication'
import { observeUIPartInstances } from '../partInstancesUI/publication'
import { PromiseDebounce } from '../lib/PromiseDebounce'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

const ACTIVATION_DEBOUNCE = 20

function convertStudioSettingsDoc(doc: Pick<DBStudio, StudioFields>): StudioSettingsDoc {
	return {
		_id: doc._id,
		settings: applyAndValidateOverrides(doc.settingsWithOverrides).obj,
	}
}

export class RundownContentObserver {
	readonly #cache: ContentCache
	readonly #observers: LiveQueryHandleSync[]
	readonly #partInstancesObserver: PartInstancesForActivationObserver

	private constructor(
		cache: ContentCache,
		observers: LiveQueryHandleSync[],
		partInstancesObserver: PartInstancesForActivationObserver
	) {
		this.#cache = cache
		this.#observers = observers
		this.#partInstancesObserver = partInstancesObserver
	}

	static async create(
		studioId: StudioId,
		playlistId: RundownPlaylistId,
		rundownIds: RundownId[],
		cache: ContentCache,
		onChanged: () => void
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)

		// PartInstances are published per playlist activation, so the subscription has to follow it
		const partInstancesObserver = new PartInstancesForActivationObserver(cache, onChanged)

		const observers = await waitForAllObserversReady([
			Studios.observe(
				{
					_id: studioId,
				},
				{
					added: (doc) => {
						cache.StudioSettings.replace(convertStudioSettingsDoc(doc))
					},
					changed: (doc) => {
						cache.StudioSettings.replace(convertStudioSettingsDoc(doc))
					},
					removed: (doc) => {
						cache.StudioSettings.remove(doc._id)
					},
				},
				{
					projection: studioFieldSpecifier,
				}
			),
			RundownPlaylists.observe(
				{
					_id: playlistId,
				},
				{
					added: (doc) => {
						cache.RundownPlaylists.replace(doc)
						partInstancesObserver.setActivation(doc.activationId)
					},
					changed: (doc) => {
						cache.RundownPlaylists.replace(doc)
						partInstancesObserver.setActivation(doc.activationId)
					},
					removed: (doc) => {
						cache.RundownPlaylists.remove(doc._id)
						partInstancesObserver.setActivation(undefined)
					},
				},
				{
					projection: rundownPlaylistFieldSpecifier,
				}
			),
			Segments.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.Segments.link(),
				{
					projection: segmentFieldSpecifier,
				}
			),
			// The Parts and PartInstances are taken from the UI publications rather than the
			// collections, because those are the ones the UI shows. A QuickLoop with
			// forced auto-next rewrites expectedDuration there, so reading the raw collections would
			// produce different numbers to the ones on screen.
			observeUIParts(playlistId, cache.Parts, onChanged),
		])

		return new RundownContentObserver(cache, observers, partInstancesObserver)
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public dispose = (): void => {
		this.#partInstancesObserver.dispose()
		this.#observers.forEach((observer) => observer.stop())
	}
}

/**
 * Maintains the cache's PartInstances from the UI PartInstances publication, resubscribing when the
 * playlist activation changes and holding none while the playlist is inactive.
 */
export class PartInstancesForActivationObserver {
	readonly #cache: ContentCache
	readonly #onChanged: () => void

	#activationId: RundownPlaylistActivationId | undefined
	#observer: LiveQueryHandleSync | undefined
	#disposed = false

	readonly #resubscribe = new PromiseDebounce(async () => {
		try {
			this.#observer?.stop()
			this.#observer = undefined
			this.#cache.PartInstances.remove({})

			if (this.#disposed || !this.#activationId) {
				this.#onChanged()
				return
			}

			this.#observer = await observeUIPartInstances(
				this.#activationId,
				this.#cache.PartInstances,
				this.#onChanged
			)

			if (this.#disposed) {
				this.#observer.stop()
				this.#observer = undefined
			}
		} catch (e) {
			logger.error(`Error in PartInstancesForActivationObserver: ${stringifyError(e)}`)
		}
	}, ACTIVATION_DEBOUNCE)

	constructor(cache: ContentCache, onChanged: () => void) {
		this.#cache = cache
		this.#onChanged = onChanged
	}

	setActivation(activationId: RundownPlaylistActivationId | undefined): void {
		if (this.#activationId === activationId) return
		this.#activationId = activationId

		this.#resubscribe.trigger()
	}

	dispose(): void {
		this.#disposed = true
		this.#resubscribe.cancelWaiting()
		this.#observer?.stop()
		this.#observer = undefined
	}
}
