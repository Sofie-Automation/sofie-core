import _ from 'underscore'
import { check } from '../lib/check'
import { logger } from '../logging'
import { registerClassToMeteorMethods } from '../methods'
import { NewRundownAPI, RundownAPIMethods } from '@sofie-automation/meteor-lib/dist/api/rundown'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { PackageInfo } from '../coreSystem'
import { IngestActions } from './ingest/actions'
import {
	ReloadRundownPlaylistResponse,
	TriggerReloadDataResponse,
} from '@sofie-automation/meteor-lib/dist/api/userActions'
import { MethodContextAPI, MethodContext } from './methodContext'
import { runIngestOperation } from './ingest/lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { VerifiedRundownForUserAction, VerifiedRundownPlaylistForUserAction } from '../security/check'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprints, Rundowns, ShowStyleBases, ShowStyleVariants, Studios } from '../collections'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'

export namespace ServerRundownAPI {
	/** Remove an individual rundown */
	export async function removeRundown(rundown: VerifiedRundownForUserAction): Promise<void> {
		await runIngestOperation(rundown.studioId, IngestJobs.UserRemoveRundown, {
			rundownId: rundown._id,
			force: true,
		})
	}

	export async function unsyncRundown(rundown: VerifiedRundownForUserAction): Promise<void> {
		await runIngestOperation(rundown.studioId, IngestJobs.UserUnsyncRundown, {
			rundownId: rundown._id,
		})
	}
	/** Resync all rundowns in a rundownPlaylist */
	export async function resyncRundownPlaylist(
		playlist: VerifiedRundownPlaylistForUserAction
	): Promise<ReloadRundownPlaylistResponse> {
		logger.info('resyncRundownPlaylist ' + playlist._id)

		const rundowns = await Rundowns.findFetchAsync({ playlistId: playlist._id })
		const responses = await Promise.all(
			rundowns.map(async (rundown) => {
				return {
					rundownId: rundown._id,
					response: await IngestActions.reloadRundown(rundown),
				}
			})
		)

		return {
			rundownsResponses: responses,
		}
	}

	export async function resyncRundown(rundown: VerifiedRundownForUserAction): Promise<TriggerReloadDataResponse> {
		return IngestActions.reloadRundown(rundown)
	}
}

export namespace ClientRundownAPI {
	export async function rundownPlaylistNeedsResync(
		_context: MethodContext,
		playlistId: RundownPlaylistId
	): Promise<string[]> {
		check(playlistId, String)
		triggerWriteAccessBecauseNoCheckNecessary()

		const rundowns = await Rundowns.findFetchAsync(
			{
				playlistId: playlistId,
			},
			{
				sort: { _id: 1 },
			}
		)

		const errors = await Promise.all(
			rundowns.map(async (rundown) => {
				if (!rundown.importVersions) return 'unknown'

				if (rundown.importVersions.core !== PackageInfo.version) return 'coreVersion'

				const showStyleVariant = (await ShowStyleVariants.findOneAsync(rundown.showStyleVariantId, {
					projection: {
						_id: 1,
						_rundownVersionHash: 1,
					},
				})) as Pick<DBShowStyleVariant, '_id' | '_rundownVersionHash'>
				if (!showStyleVariant) return 'missing showStyleVariant'
				if (rundown.importVersions.showStyleVariant !== (showStyleVariant._rundownVersionHash || 0))
					return 'showStyleVariant'

				const showStyleBase = (await ShowStyleBases.findOneAsync(rundown.showStyleBaseId, {
					projection: {
						_id: 1,
						_rundownVersionHash: 1,
						blueprintId: 1,
					},
				})) as Pick<DBShowStyleBase, '_id' | '_rundownVersionHash' | 'blueprintId'>
				if (!showStyleBase) return 'missing showStyleBase'
				if (rundown.importVersions.showStyleBase !== (showStyleBase._rundownVersionHash || 0))
					return 'showStyleBase'

				const blueprint = (await Blueprints.findOneAsync(showStyleBase.blueprintId, {
					projection: {
						_id: 1,
						blueprintVersion: 1,
					},
				})) as Pick<Blueprint, '_id' | 'blueprintVersion'>
				if (!blueprint.blueprintVersion) return 'missing blueprint'
				if (rundown.importVersions.blueprint !== (blueprint.blueprintVersion || 0)) return 'blueprint'

				const studio = (await Studios.findOneAsync(rundown.studioId, {
					projection: {
						_id: 1,
						_rundownVersionHash: 1,
					},
				})) as Pick<DBStudio, '_id' | '_rundownVersionHash'>
				if (!studio) return 'missing studio'
				if (rundown.importVersions.studio !== (studio._rundownVersionHash || 0)) return 'studio'
			})
		)

		return _.compact(errors)
	}
}

class ServerRundownAPIClass extends MethodContextAPI implements NewRundownAPI {
	async rundownPlaylistNeedsResync(playlistId: RundownPlaylistId) {
		return ClientRundownAPI.rundownPlaylistNeedsResync(this, playlistId)
	}
}
registerClassToMeteorMethods(RundownAPIMethods, ServerRundownAPIClass, false)
