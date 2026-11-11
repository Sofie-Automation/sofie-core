import type { RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import type { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import {
	REFERENCE_PLAYLIST_ID,
	REFERENCE_RUNDOWN_ID,
	referenceRundown,
	type ReferenceRundown,
	type RundownVariant,
} from '@sofie-automation/corelib/dist/testing/referenceRundown'
import type { MockJobContext } from './context.js'
import { defaultRundown, defaultRundownPlaylist } from './defaultCollectionObjects.js'
import { setupMockShowStyleCompound } from './presetCollections.js'

/**
 * Insert the reference rundown, with the changes a variant names, into the mock collections.
 *
 * The rundown itself, its clock helpers and its ids are corelib's, in
 * `@sofie-automation/corelib/dist/testing/referenceRundown`. The playlist and the rundown document are made here from
 * the mock studio and show style, so that the playout jobs find what they need; the segments and parts are corelib's.
 */
export async function setupReferenceRundown(
	context: MockJobContext,
	options: {
		timing: RundownPlaylistTiming
		variant?: RundownVariant
		/** A rundown of the reference form, in place of the reference rundown with the variant's changes */
		rundown?: ReferenceRundown
	}
): Promise<void> {
	const { rundowns, segments, parts } = options.rundown ?? referenceRundown(options.variant)
	if (rundowns.length !== 1 || rundowns[0]._id !== REFERENCE_RUNDOWN_ID) {
		throw new Error('A rundown of the reference form has one rundown, with the reference rundown id')
	}

	const showStyle = await setupMockShowStyleCompound(context)

	await context.mockCollections.RundownPlaylists.insertOne({
		...defaultRundownPlaylist(REFERENCE_PLAYLIST_ID, context.studioId),
		name: 'Reference playlist',
		timing: options.timing,
		rundownIdsInOrder: [REFERENCE_RUNDOWN_ID],
	})

	const rundown: DBRundown = {
		...defaultRundown(
			'referenceRundown',
			context.studioId,
			null,
			REFERENCE_PLAYLIST_ID,
			showStyle._id,
			showStyle.showStyleVariantId
		),
		_id: REFERENCE_RUNDOWN_ID,
		name: 'Reference rundown',
	}
	await context.mockCollections.Rundowns.insertOne(rundown)

	for (const segment of segments) await context.mockCollections.Segments.insertOne(segment)
	for (const part of parts) await context.mockCollections.Parts.insertOne(part)
}
