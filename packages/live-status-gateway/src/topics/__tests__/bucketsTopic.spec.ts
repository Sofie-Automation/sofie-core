import { protectString } from '@sofie-automation/server-core-integration'
import {
	makeMockHandlers,
	makeMockLogger,
	makeMockSubscriber,
	makeTestParts,
	makeTestPlaylist,
	makeTestShowStyleBase,
} from './utils.js'
import { ShowStyleBaseExt } from '../../collections/showStyleBaseHandler.js'
import { BucketsTopic } from '../bucketsTopic.js'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { RundownImportVersions } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { BucketAdLib, BucketAdLibIngestInfo } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { BucketsEvent } from '@sofie-automation/live-status-gateway-api'

describe('BucketsTopic', () => {
	it('notifies subscribers', async () => {
		const handlers = makeMockHandlers()
		const topic = new BucketsTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		handlers.playlistHandler.notify(playlist)

		const parts = makeTestParts()
		handlers.partsHandler.notify(parts)

		const testShowStyleBase = makeTestShowStyleBase()
		handlers.showStyleBaseHandler.notify(testShowStyleBase as ShowStyleBaseExt)

		const testBuckets = makeTestBuckets()
		handlers.bucketsHandler.notify(testBuckets)

		const testAdLibActions = makeTestAdLibActions()
		handlers.bucketAdLibActionsHandler.notify(testAdLibActions)

		const testGlobalAdLibActions = makeTestAdLibs()
		handlers.bucketAdLibsHandler.notify(testGlobalAdLibActions)

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: BucketsEvent = {
			event: 'buckets',
			buckets: [
				{
					id: 'BUCKET_0',
					name: 'A Bucket',
					adLibs: [
						{
							actionType: [],
							id: 'ADLIB_0',
							name: 'Bucket AdLib',
							outputLayer: 'PGM',
							sourceLayer: 'Layer 0',
							tags: ['adlib_tag'],
							publicData: { c: 'd' },
							externalId: 'BUCKET_ADLIB_0',
						},
						{
							actionType: [],
							id: 'ACTION_0',
							name: 'Bucket Action',
							outputLayer: 'PGM',
							sourceLayer: 'Layer 0',
							tags: ['adlib_action_tag'],
							publicData: { a: 'b' },
							externalId: 'BUCKET_ACTION_0',
						},
					],
				},
			],
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(expectedStatus)
	})
})

function makeTestAdLibActions(): BucketAdLibAction[] {
	return [
		{
			_id: protectString('ACTION_0'),
			actionId: 'ACTION_0',
			bucketId: protectString('BUCKET_0'),
			studioId: protectString('STUDIO_0'),
			importVersions: {} as RundownImportVersions,
			ingestInfo: {} as BucketAdLibIngestInfo,
			showStyleBaseId: protectString('SHOWSTYLE_0'),
			showStyleVariantId: null,
			display: {
				content: {},
				label: { key: 'Bucket Action' },
				sourceLayerId: 'layer0',
				outputLayerId: 'pgm',
				tags: ['adlib_action_tag'],
			},
			externalId: 'BUCKET_ACTION_0',
			userData: {},
			userDataManifest: {},
			publicData: { a: 'b' },
		},
	]
}

function makeTestAdLibs(): BucketAdLib[] {
	return [
		{
			_id: protectString('ADLIB_0'),
			bucketId: protectString('BUCKET_0'),
			studioId: protectString('STUDIO_0'),
			importVersions: {} as RundownImportVersions,
			ingestInfo: {} as BucketAdLibIngestInfo,
			showStyleBaseId: protectString('SHOWSTYLE_0'),
			showStyleVariantId: null,
			externalId: 'BUCKET_ADLIB_0',
			_rank: 0,
			content: {},
			lifespan: PieceLifespan.WithinPart,
			name: 'Bucket AdLib',
			outputLayerId: 'pgm',
			sourceLayerId: 'layer0',
			publicData: { c: 'd' },
			timelineObjectsString: protectString(''),
			tags: ['adlib_tag'],
		},
	]
}

function makeTestBuckets(): Bucket[] {
	return [
		{
			_id: protectString('BUCKET_0'),
			studioId: protectString('STUDIO_0'),
			_rank: 0,
			name: 'A Bucket',
			buttonHeightScale: 1,
			buttonWidthScale: 1,
		},
	]
}
