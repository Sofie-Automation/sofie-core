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

	private constructor(cache: ContentCache) {
		this.#cache = cache
	}

	static async create(
		studioId: StudioId,
		playlistId: RundownPlaylistId,
		rundownIds: RundownId[],
		cache: ContentCache,
		signal: AbortSignal
	): Promise<RundownContentObserver> {
		logger.silly(`Creating RundownContentObserver for rundowns "${rundownIds.join(',')}"`)

		await Promise.all([
			Studios.observe(
				{
					_id: studioId,
				},
				{
					added: (doc) => {
						const newDoc = convertStudioSettingsDoc(doc)
						cache.StudioSettings.replace(newDoc)
					},
					changed: (doc) => {
						const newDoc = convertStudioSettingsDoc(doc)
						cache.StudioSettings.replace(newDoc)
					},
					removed: (doc) => {
						cache.StudioSettings.remove(doc._id)
					},
				},
				{
					projection: studioFieldSpecifier,
					signal,
				}
			),
			RundownPlaylists.observeChanges(
				{
					_id: playlistId,
				},
				cache.RundownPlaylists.link(),
				{
					projection: rundownPlaylistFieldSpecifier,
					signal,
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
					signal,
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
					signal,
				}
			),
		])

		return new RundownContentObserver(cache)
	}

	public get cache(): ContentCache {
		return this.#cache
	}
}
