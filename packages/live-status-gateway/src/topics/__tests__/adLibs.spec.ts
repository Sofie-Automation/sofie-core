import { protectString, unprotectString } from '@sofie-automation/server-core-integration'
import {
	makeMockHandlers,
	makeMockLogger,
	makeMockSubscriber,
	makeTestParts,
	makeTestPlaylist,
	makeTestShowStyleBase,
} from './utils.js'
import { AdLibsTopic } from '../adLibsTopic.js'
import { ShowStyleBaseExt } from '../../collections/showStyleBaseHandler.js'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { AdLibsEvent } from '@sofie-automation/live-status-gateway-api'

function makeTestAdLibActions(): AdLibAction[] {
	return [
		{
			_id: protectString('ACTION_0'),
			actionId: 'ACTION_0',
			partId: protectString('part0'),
			rundownId: protectString('RUNDOWN_0'),
			display: {
				content: {},
				label: { key: 'An Action' },
				sourceLayerId: 'layer0',
				outputLayerId: 'pgm',
				tags: ['adlib_tag'],
			},
			externalId: 'NCS_ACTION_0',
			userData: {},
			userDataManifest: {},
			publicData: { a: 'b' },
		},
	]
}

function makeTestGlobalAdLibActions(): RundownBaselineAdLibAction[] {
	return [
		{
			_id: protectString('GLOBAL_ACTION_0'),
			actionId: 'GLOBAL_ACTION_0',
			rundownId: protectString('RUNDOWN_0'),
			display: {
				content: {},
				label: { key: 'A Global Action' },
				sourceLayerId: 'layer0',
				outputLayerId: 'pgm',
				tags: ['global_adlib_tag'],
			},
			externalId: 'NCS_GLOBAL_ACTION_0',
			userData: {},
			userDataManifest: {},
			publicData: { c: 'd' },
		},
	]
}

describe('AdLibsTopic', () => {
	it('notifies subscribers', async () => {
		const handlers = makeMockHandlers()
		const topic = new AdLibsTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		handlers.playlistHandler.notify(playlist)

		const parts = makeTestParts()
		handlers.partsHandler.notify(parts)

		const testShowStyleBase = makeTestShowStyleBase()
		handlers.showStyleBaseHandler.notify(testShowStyleBase as ShowStyleBaseExt)

		const testAdLibActions = makeTestAdLibActions()
		handlers.adLibActionsHandler.notify(testAdLibActions)

		const testGlobalAdLibActions = makeTestGlobalAdLibActions()
		handlers.globalAdLibActionsHandler.notify(testGlobalAdLibActions)

		// TODO: AdLibPieces and Global AdLibPieces

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: AdLibsEvent = {
			event: 'adLibs',
			rundownPlaylistId: unprotectString(playlist._id),
			adLibs: [
				{
					actionType: [],
					id: 'ACTION_0',
					name: 'An Action',
					outputLayer: 'PGM',
					sourceLayer: 'Layer 0',
					tags: ['adlib_tag'],
					publicData: { a: 'b' },
					segmentId: 'segment0',
					partId: 'part0',
				},
			],
			globalAdLibs: [
				{
					actionType: [],
					id: 'GLOBAL_ACTION_0',
					name: 'A Global Action',
					outputLayer: 'PGM',
					sourceLayer: 'Layer 0',
					tags: ['global_adlib_tag'],
					publicData: { c: 'd' },
				},
			],
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(expectedStatus)
	})
})
