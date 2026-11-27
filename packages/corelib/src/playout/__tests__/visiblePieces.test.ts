import { PieceInstance } from '../../dataModel/PieceInstance.js'
import {
	createPartCurrentTimes,
	getVisiblePieceInstances,
	isVisibleOver,
	PieceInstanceWithTimings,
	processAndPrunePieceInstanceTimings,
	resolvePrunedPieceInstance,
} from '../processAndPrune.js'
import { protectString } from '../../protectedString.js'
import { SourceLayers } from '../../dataModel/ShowStyleBase.js'
import { ISourceLayer, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { LegacyPieceLifespan, PieceLifespanInfo } from '@sofie-automation/shared-lib/dist/core/model/Rundown'

const PART_STARTED = 10000
const NOW = PART_STARTED + 5000

const sourceLayers: SourceLayers = {
	camera: { _id: 'camera', _rank: 0, name: 'Camera', type: SourceLayerType.CAMERA } as ISourceLayer,
	graphics: { _id: 'graphics', _rank: 1, name: 'Graphics', type: SourceLayerType.GRAPHICS } as ISourceLayer,
}

function makePieceInstance(
	id: string,
	lifespan: PieceLifespanInfo,
	start: number,
	options: { sourceLayerId?: string; continued?: boolean; virtual?: boolean; duration?: number } = {}
): PieceInstance {
	return {
		_id: protectString(id),
		rundownId: protectString('rundown0'),
		partInstanceId: protectString('partInstance0'),
		playlistActivationId: protectString('activation0'),
		piece: {
			_id: protectString(`${id}_piece`),
			externalId: id,
			name: id,
			startPartId: protectString('part0'),
			sourceLayerId: options.sourceLayerId ?? 'camera',
			outputLayerId: 'pgm',
			lifespan,
			enable: { start, duration: options.duration },
			content: {},
			timelineObjectsString: protectString(''),
			pieceType: 'normal' as PieceInstance['piece']['pieceType'],
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

/** The pieces on air now, as the PieceInstancesHandler finds them */
function getOnAirIds(pieceInstances: PieceInstance[]): string[] {
	const partTimes = createPartCurrentTimes(NOW, PART_STARTED)
	const pruned = processAndPrunePieceInstanceTimings(sourceLayers, pieceInstances, partTimes, false)
	const playing = pruned.flatMap((pieceInstance) => {
		const { resolvedStart, resolvedDuration } = resolvePrunedPieceInstance(partTimes, pieceInstance)
		const isPlaying =
			resolvedStart <= partTimes.nowInPart &&
			(resolvedDuration == null || resolvedStart + resolvedDuration > partTimes.nowInPart)
		return isPlaying ? [{ pieceInstance, resolvedStart }] : []
	})
	return getVisiblePieceInstances(playing)
		.filter((pieceInstance) => !pieceInstance.piece.virtual)
		.map((pieceInstance) => String(pieceInstance._id))
}

describe('getVisiblePieceInstances', () => {
	test.each([LegacyPieceLifespan.OutOnSegmentEnd, LegacyPieceLifespan.OutOnRundownEnd])(
		'hides a continued %s infinite while a part piece covers it',
		(hostLifespan) => {
			const host = makePieceInstance('host', hostLifespan, 0, { continued: true })
			const guest = makePieceInstance('guest', LegacyPieceLifespan.WithinPart, 1000)

			expect(getOnAirIds([host, guest])).toEqual(['guest'])
		}
	)

	test('shows the covered infinite again once the covering piece has ended', () => {
		const host = makePieceInstance('host', LegacyPieceLifespan.OutOnSegmentEnd, 0, { continued: true })
		const guest = makePieceInstance('guest', LegacyPieceLifespan.WithinPart, 1000, { duration: 2000 })

		expect(getOnAirIds([host, guest])).toEqual(['host'])
	})

	test('hides a persisting infinite covered by a narrower persisting one', () => {
		const host = makePieceInstance(
			'host',
			{ scope: 'rundown', presence: 'forward-scope', whenCovered: 'persist' },
			0,
			{
				continued: true,
			}
		)
		const guest = makePieceInstance(
			'guest',
			{ scope: 'segment', presence: 'forward-scope', whenCovered: 'persist' },
			1000
		)

		expect(getOnAirIds([host, guest])).toEqual(['guest'])
	})

	test('a virtual covering an infinite leaves nothing on air on its layer', () => {
		const host = makePieceInstance('host', LegacyPieceLifespan.OutOnSegmentEnd, 0, { continued: true })
		const clear = makePieceInstance('clear', LegacyPieceLifespan.WithinPart, 1000, { virtual: true })

		expect(getOnAirIds([host, clear])).toEqual([])
	})

	test('keeps the pieces on other layers', () => {
		const host = makePieceInstance('host', LegacyPieceLifespan.OutOnSegmentEnd, 0, { continued: true })
		const guest = makePieceInstance('guest', LegacyPieceLifespan.WithinPart, 1000)
		const lowerThird = makePieceInstance('lowerThird', LegacyPieceLifespan.OutOnSegmentEnd, 0, {
			sourceLayerId: 'graphics',
			continued: true,
		})

		expect(getOnAirIds([host, guest, lowerThird]).sort()).toEqual(['guest', 'lowerThird'])
	})

	test('picks the latest started piece when the priorities are equal', () => {
		const make = (id: string, resolvedStart: number) => ({
			pieceInstance: {
				...makePieceInstance(id, LegacyPieceLifespan.WithinPart, resolvedStart),
				priority: 5,
			} as PieceInstanceWithTimings,
			resolvedStart,
		})

		expect(getVisiblePieceInstances([make('later', 2000), make('earlier', 1000)]).map((p) => p._id)).toEqual([
			'later',
		])
	})
})

describe('isVisibleOver', () => {
	test('a higher priority piece is shown, whenever it started', () => {
		expect(isVisibleOver({ priority: 5, start: 0 }, { priority: 2, start: 1000 })).toBe(true)
		expect(isVisibleOver({ priority: 2, start: 1000 }, { priority: 5, start: 0 })).toBe(false)
	})

	test('the latest started piece is shown when the priorities are equal', () => {
		expect(isVisibleOver({ priority: 5, start: 1000 }, { priority: 5, start: 0 })).toBe(true)
		expect(isVisibleOver({ priority: 5, start: 0 }, { priority: 5, start: 1000 })).toBe(false)
	})
})
