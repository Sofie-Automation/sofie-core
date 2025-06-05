import { Meteor } from 'meteor/meteor'
import { RundownId, RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging'
import {
	ContentCache,
	partFieldSpecifier,
	rundownPlaylistFieldSpecifier,
	segmentFieldSpecifier,
	StudioFields,
	studioFieldSpecifier,
	StudioSettingsDoc,
} from './reactiveContentCache'
import { Parts, RundownPlaylists, Segments, Studios } from '../../collections'
import { waitForAllObserversReady } from '../lib/lib'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

function convertStudioSettingsDoc(doc: Pick<DBStudio, StudioFields>): StudioSettingsDoc {
	return {
		_id: doc._id,
		settings: applyAndValidateOverrides(doc.settingsWithOverrides).obj,
	}
}

export class RundownContentObserver {
	readonly #cache: ContentCache
	readonly #observers: Meteor.LiveQueryHandle[]

	private constructor(cache: ContentCache, observers: Meteor.LiveQueryHandle[]) {
		this.#cache = cache
		this.#observers = observers
	}

	static async create(
		studioId: StudioId,
		playlistId: RundownPlaylistId,
		rundownIds: RundownId[],
		cache: ContentCache
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)

		const observers = await waitForAllObserversReady([
			Studios.observe(
				{
					_id: studioId,
				},
				{
					added: (doc) => {
						const newDoc = convertStudioSettingsDoc(doc)
						cache.StudioSettings.upsert(doc._id, { $set: newDoc as Partial<Document> })
					},
					changed: (doc) => {
						const newDoc = convertStudioSettingsDoc(doc)
						cache.StudioSettings.upsert(doc._id, { $set: newDoc as Partial<Document> })
					},
					removed: (doc) => {
						cache.StudioSettings.remove(doc._id)
					},
				},
				{
					projection: studioFieldSpecifier,
				}
			),
			RundownPlaylists.observeChanges(
				{
					_id: playlistId,
				},
				cache.RundownPlaylists.link(),
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
			Parts.observeChanges(
				{
					rundownId: {
						$in: rundownIds,
					},
				},
				cache.Parts.link(),
				{
					projection: partFieldSpecifier,
				}
			),
		])

		return new RundownContentObserver(cache, observers)
	}

	public get cache(): ContentCache {
		return this.#cache
	}

	public dispose = (): void => {
		this.#observers.forEach((observer) => observer.stop())
	}
}
