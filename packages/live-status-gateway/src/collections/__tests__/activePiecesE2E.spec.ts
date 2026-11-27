import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { LegacyPieceLifespan, PieceLifespanInfo } from '@sofie-automation/shared-lib/dist/core/model/Rundown'
import { PieceInstancesHandler } from '../pieceInstancesHandler.js'
import { ActivePiecesTopic } from '../../topics/activePiecesTopic.js'
import { CoreHandler } from '../../coreHandler.js'
import { CollectionHandlers } from '../../liveStatusServer.js'
import { ShowStyleBaseExt } from '../showStyleBaseHandler.js'
import { makeMockHandlers, makeMockLogger, makeMockSubscriber, makeTestPlaylist } from '../../topics/__tests__/utils.js'

const CURRENT_PART_INSTANCE_ID = 'CURRENT_PART_INSTANCE'

function makePieceInstance(
	id: string,
	name: string,
	lifespan: PieceLifespanInfo,
	start: number,
	options: { continued?: boolean; virtual?: boolean; duration?: number } = {}
): PieceInstance {
	return {
		_id: protectString(id),
		rundownId: protectString('RUNDOWN_1'),
		partInstanceId: protectString(CURRENT_PART_INSTANCE_ID),
		playlistActivationId: protectString('ACTIVATION'),
		piece: {
			_id: protectString(`${id}_piece`),
			externalId: id,
			name,
			startPartId: protectString('part0'),
			sourceLayerId: 'camera',
			outputLayerId: 'pgm',
			lifespan,
			enable: { start, duration: options.duration },
			content: {},
			timelineObjectsString: protectString(''),
			pieceType: 'normal',
			invalid: false,
			virtual: options.virtual,
		},
		infinite: options.continued
			? {
					infiniteInstanceId: protectString(`${id}_infinite`),
					infiniteInstanceIndex: 1,
					infinitePieceId: protectString(`${id}_piece`),
					fromPreviousPart: true,
				}
			: undefined,
	} as PieceInstance
}

/** Runs the real PieceInstancesHandler and ActivePiecesTopic, with the PieceInstances served by a fake core */
async function getActivePiecesSent(pieceInstances: PieceInstance[]): Promise<string[]> {
	const fakeCollection = {
		find: (selector: { partInstanceId: string }) =>
			pieceInstances.filter((p) => String(p.partInstanceId) === selector.partInstanceId),
	}
	const fakeCoreHandler = {
		studioId: protectString('STUDIO_1'),
		core: { getCollection: () => fakeCollection },
		setupSubscription: async () => 'SUBSCRIPTION',
		setupObserver: () => ({ stop: () => undefined }),
		unsubscribe: () => undefined,
	} as unknown as CoreHandler

	const logger = makeMockLogger()
	const handlers = makeMockHandlers()
	const pieceInstancesHandler = new PieceInstancesHandler(logger, fakeCoreHandler)
	pieceInstancesHandler.init(handlers)
	const topic = new ActivePiecesTopic(logger, {
		...handlers,
		pieceInstancesHandler,
	} as unknown as CollectionHandlers)

	const showStyleBase: Partial<ShowStyleBaseExt> = {
		sourceLayers: {
			camera: { _id: 'camera', _rank: 0, name: 'Camera', type: SourceLayerType.CAMERA } as ISourceLayer,
		},
		sourceLayerNamesById: new Map([['camera', 'Camera']]),
		outputLayerNamesById: new Map([['pgm', 'PGM']]),
	}
	handlers.showStyleBaseHandler.notify(showStyleBase as ShowStyleBaseExt)
	handlers.partInstancesHandler.notify({
		previous: [],
		current: {
			_id: protectString(CURRENT_PART_INSTANCE_ID),
			timings: { plannedStartedPlayback: Date.now() - 5000 },
		},
	} as any)

	const playlist = makeTestPlaylist()
	playlist.activationId = protectString('ACTIVATION')
	playlist.currentPartInfo = {
		consumesQueuedSegmentId: false,
		manuallySelected: false,
		partInstanceId: protectString(CURRENT_PART_INSTANCE_ID),
		rundownId: playlist.rundownIdsInOrder[0],
	}
	handlers.playlistHandler.notify(playlist)

	// Let the subscription resolve and the throttled updates run
	await new Promise((resolve) => setTimeout(resolve, 300))

	const subscriber = makeMockSubscriber()
	topic.addSubscriber(subscriber)
	const messages = subscriber.send.mock.calls.map((call) => JSON.parse(call[0] as string))
	const last = messages[messages.length - 1]
	pieceInstancesHandler.close()
	return last.activePieces.map((piece: { name: string }) => piece.name)
}

describe('activePieces, through the PieceInstancesHandler', () => {
	test('a Guest Video part piece covering a continued Host Video infinite is the only active piece', async () => {
		expect(
			await getActivePiecesSent([
				makePieceInstance('host', 'Host Video', LegacyPieceLifespan.OutOnSegmentEnd, 0, { continued: true }),
				makePieceInstance('guest', 'Guest Video', LegacyPieceLifespan.WithinPart, 1000),
			])
		).toEqual(['Guest Video'])
	})

	test('the Host Video is active again once the Guest Video has ended', async () => {
		expect(
			await getActivePiecesSent([
				makePieceInstance('host', 'Host Video', LegacyPieceLifespan.OutOnSegmentEnd, 0, { continued: true }),
				makePieceInstance('guest', 'Guest Video', LegacyPieceLifespan.WithinPart, 1000, { duration: 2000 }),
			])
		).toEqual(['Host Video'])
	})

	test('a virtual covering the Host Video leaves nothing active', async () => {
		expect(
			await getActivePiecesSent([
				makePieceInstance('host', 'Host Video', LegacyPieceLifespan.OutOnSegmentEnd, 0, { continued: true }),
				makePieceInstance('clear', 'Clear', LegacyPieceLifespan.WithinPart, 1000, { virtual: true }),
			])
		).toEqual([])
	})
})
