import { IBlueprintPieceType } from '@sofie-automation/blueprints-integration'
import {} from 'type-fest'
import { RundownHoldState } from '../../dataModel/RundownPlaylist.js'
import { literal } from '../../lib.js'
import { calculatePartTimings, CalculateTimingsPiece, PartCalculatedTimings } from '../timings.js'

describe('Part Playout Timings', () => {
	describe('calculatePartTimings', () => {
		const pieceInstancesPostroll: CalculateTimingsPiece[] = [
			{
				enable: { start: 0 },
				postrollDuration: 231,
				pieceType: IBlueprintPieceType.Normal,
			},
			{
				enable: { start: 0 },
				pieceType: IBlueprintPieceType.Normal,
			},
			{
				enable: { start: 500, duration: 5000 },
				postrollDuration: 436,
				pieceType: IBlueprintPieceType.Normal,
			},
		]
		const pieceInstancesNoPartPreroll: CalculateTimingsPiece[] = [
			{
				enable: { start: 0 },
				prerollDuration: 0,
				pieceType: IBlueprintPieceType.Normal,
			},
			{
				enable: { start: 5000 },
				prerollDuration: 1000,
				pieceType: IBlueprintPieceType.Normal,
			},
			{
				enable: { start: 0 },
				prerollDuration: 500, // Ignored
				pieceType: IBlueprintPieceType.InTransition,
			},
		]
		const pieceInstances500msPartPreroll: CalculateTimingsPiece[] = [
			{
				enable: { start: 0 },
				prerollDuration: 500,
				pieceType: IBlueprintPieceType.Normal,
			},
			{
				enable: { start: 0 },
				prerollDuration: 150,
				pieceType: IBlueprintPieceType.Normal,
			},
			{
				enable: { start: 5000 },
				prerollDuration: 1000,
				pieceType: IBlueprintPieceType.Normal,
			},
			{
				enable: { start: 0 },
				prerollDuration: 500, // Ignored
				pieceType: IBlueprintPieceType.InTransition,
			},
		]

		describe('no transition', () => {
			describe('no preroll', () => {
				test('no previous part', () => {
					const timings = calculatePartTimings(
						undefined,
						undefined,
						undefined,
						{},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 0,
							fromPartRemaining: 0,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('with previous part', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
						},
						[],
						{},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 0,
							fromPartRemaining: 0,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('with previous part postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
						},
						pieceInstancesPostroll,
						{},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 0,
							fromPartRemaining: 231,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('with previous part outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							outTransition: { duration: 289 },
						},
						[],
						{},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 289,
							fromPartRemaining: 289,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('with previous part outDuration postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							outTransition: { duration: 289 },
						},
						pieceInstancesPostroll,
						{},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 289,
							fromPartRemaining: 231 + 289,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('with previous part autonextoverlap', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
							autoNextOverlap: 452,
						},
						[],
						{},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 0,
							fromPartRemaining: 452,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 452,
						})
					)
				})

				test('with previous part autonextoverlap postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
							autoNextOverlap: 452,
						},
						pieceInstancesPostroll,
						{},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 0,
							fromPartRemaining: 231 + 452,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 452,
						})
					)
				})

				test('with previous part autonextoverlap and outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
							autoNextOverlap: 452,
							outTransition: { duration: 256 },
						},
						[],
						{},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 0,
							fromPartRemaining: 452,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 452,
						})
					)
				})

				test('with previous part autonextoverlap and outDuration and postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
							autoNextOverlap: 452,
							outTransition: { duration: 256 },
						},
						pieceInstancesPostroll,
						{},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 0,
							fromPartRemaining: 231 + 452,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 452,
						})
					)
				})

				test('with previous part autonextoverlap and larger outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
							autoNextOverlap: 452,
							outTransition: { duration: 2256 },
						},
						[],
						{},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 2256 - 452,
							fromPartRemaining: 2256,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 452,
						})
					)
				})

				test('with previous part autonextoverlap and larger outDuration postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
							autoNextOverlap: 452,
							outTransition: { duration: 2256 },
						},
						pieceInstancesPostroll,
						{},
						pieceInstancesNoPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 2256 - 452,
							fromPartRemaining: 231 + 2256,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 452,
						})
					)
				})
			})
			describe('500ms preroll', () => {
				test('no previous part', () => {
					const timings = calculatePartTimings(
						undefined,
						undefined,
						undefined,
						{},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 500,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('with previous part', () => {
					const timings = calculatePartTimings(undefined, {}, [], {}, pieceInstances500msPartPreroll)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 500,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('with previous part and postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						{},
						pieceInstancesPostroll,
						{},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 231 + 500,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('with previous part outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							outTransition: { duration: 289 },
						},
						[],
						{},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 500,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('with previous part outDuration postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							outTransition: { duration: 289 },
						},
						pieceInstancesPostroll,
						{},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 231 + 500,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('with previous part larger outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							outTransition: { duration: 823 },
						},
						[],
						{},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 823,
							fromPartRemaining: 823,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('with previous part larger outDuration and postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							outTransition: { duration: 823 },
						},
						pieceInstancesPostroll,
						{},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 823,
							fromPartRemaining: 231 + 823,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('with previous part autonextoverlap', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
							autoNextOverlap: 452,
						},
						[],
						{},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 500 + 452,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 452,
						})
					)
				})

				test('with previous part autonextoverlap postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
							autoNextOverlap: 452,
						},
						pieceInstancesPostroll,
						{},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 231 + 500 + 452,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 452,
						})
					)
				})

				test('with previous part autonextoverlap and outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
							autoNextOverlap: 452,
							outTransition: { duration: 256 },
						},
						[],
						{},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 500 + 452,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 452,
						})
					)
				})

				test('with previous part autonextoverlap and outDuration postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
							autoNextOverlap: 452,
							outTransition: { duration: 256 },
						},
						pieceInstancesPostroll,
						{},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 231 + 500 + 452,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 452,
						})
					)
				})

				test('with previous part autonextoverlap and larger outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
							autoNextOverlap: 452,
							outTransition: { duration: 2256 },
						},
						[],
						{},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 2256 - 452,
							fromPartRemaining: 2256,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 452,
						})
					)
				})

				test('with previous part autonextoverlap and larger outDuration overlap', () => {
					const timings = calculatePartTimings(
						undefined,
						{
							autoNext: true,
							autoNextOverlap: 452,
							outTransition: { duration: 2256 },
						},
						pieceInstancesPostroll,
						{},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 2256 - 452,
							fromPartRemaining: 231 + 2256,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 452,
						})
					)
				})
			})
		})

		describe('overrule transition', () => {
			test('no previous part', () => {
				const timings = calculatePartTimings(
					undefined,
					undefined,
					undefined,
					{
						inTransition: {
							blockTakeDuration: 5000,
							previousPartKeepaliveDuration: 5000,
							partContentDelayDuration: 1000,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 500,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 0,
					})
				)
			})

			test('previous autonextoverlap', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						autoNext: true,
						autoNextOverlap: 452,
					},
					[],
					{
						inTransition: {
							blockTakeDuration: 5000,
							previousPartKeepaliveDuration: 5000,
							partContentDelayDuration: 1000,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 500 + 452,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 452,
					})
				)
			})

			test('previous autonextoverlap postroll', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						autoNext: true,
						autoNextOverlap: 452,
					},
					pieceInstancesPostroll,
					{
						inTransition: {
							blockTakeDuration: 5000,
							previousPartKeepaliveDuration: 5000,
							partContentDelayDuration: 1000,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 231 + 500 + 452,
						fromPartPostroll: 231,
						toPartPostroll: 0,
						fromPartKeepalive: 452,
					})
				)
			})

			test('previous disableNextInTransition', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						disableNextInTransition: true,
					},
					[],
					{
						inTransition: {
							blockTakeDuration: 5000,
							previousPartKeepaliveDuration: 5000,
							partContentDelayDuration: 1000,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 500,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 0,
					})
				)
			})

			test('previous disableNextInTransition postroll', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						disableNextInTransition: true,
					},
					pieceInstancesPostroll,
					{
						inTransition: {
							blockTakeDuration: 5000,
							previousPartKeepaliveDuration: 5000,
							partContentDelayDuration: 1000,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 231 + 500,
						fromPartPostroll: 231,
						toPartPostroll: 0,
						fromPartKeepalive: 0,
					})
				)
			})

			test('HOLD complete', () => {
				const timings = calculatePartTimings(
					RundownHoldState.COMPLETE,
					{},
					[],
					{
						inTransition: {
							blockTakeDuration: 5000,
							previousPartKeepaliveDuration: 5000,
							partContentDelayDuration: 1000,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 0,
						toPartDelay: 1000,
						fromPartRemaining: 5000,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 5000,
					})
				)
			})

			test('HOLD pending', () => {
				const timings = calculatePartTimings(
					RundownHoldState.PENDING,
					{},
					[],
					{
						inTransition: {
							blockTakeDuration: 5000,
							previousPartKeepaliveDuration: 5000,
							partContentDelayDuration: 1000,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 500,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 0,
					})
				)
			})

			test('HOLD active', () => {
				const timings = calculatePartTimings(
					RundownHoldState.ACTIVE,
					{},
					[],
					{
						inTransition: {
							blockTakeDuration: 5000,
							previousPartKeepaliveDuration: 5000,
							partContentDelayDuration: 1000,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 500,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 0,
					})
				)
			})

			describe('HOLD postroll', () => {
				test('HOLD complete', () => {
					const timings = calculatePartTimings(
						RundownHoldState.COMPLETE,
						{},
						pieceInstancesPostroll,
						{
							inTransition: {
								blockTakeDuration: 5000,
								previousPartKeepaliveDuration: 5000,
								partContentDelayDuration: 1000,
							},
						},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: 0,
							toPartDelay: 1000,
							fromPartRemaining: 231 + 5000,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 5000,
						})
					)
				})

				test('HOLD pending', () => {
					const timings = calculatePartTimings(
						RundownHoldState.PENDING,
						{},
						pieceInstancesPostroll,
						{
							inTransition: {
								blockTakeDuration: 5000,
								previousPartKeepaliveDuration: 5000,
								partContentDelayDuration: 1000,
							},
						},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 231 + 500,
							fromPartPostroll: 231,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
						})
					)
				})

				test('HOLD active', () => {
					const timings = calculatePartTimings(
						RundownHoldState.ACTIVE,
						{},
						pieceInstancesPostroll,
						{
							inTransition: {
								blockTakeDuration: 5000,
								previousPartKeepaliveDuration: 5000,
								partContentDelayDuration: 1000,
							},
						},
						pieceInstances500msPartPreroll
					)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 231 + 500,
							fromPartPostroll: 231 + 0,
							toPartPostroll: 0 + 0,
							fromPartKeepalive: 0,
						})
					)
				})
			})
		})

		describe('with transition', () => {
			test('high preroll', () => {
				const timings = calculatePartTimings(
					undefined,
					{},
					[],
					{
						inTransition: {
							blockTakeDuration: 0, // unused
							previousPartKeepaliveDuration: 628,
							partContentDelayDuration: 345,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 500 - 345,
						toPartDelay: 500,
						fromPartRemaining: 500 - 345 + 628,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 628,
					})
				)
			})

			test('high preroll and postroll', () => {
				const timings = calculatePartTimings(
					undefined,
					{},
					pieceInstancesPostroll,
					{
						inTransition: {
							blockTakeDuration: 0, // unused
							previousPartKeepaliveDuration: 628,
							partContentDelayDuration: 345,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 500 - 345,
						toPartDelay: 500,
						fromPartRemaining: 231 + 500 - 345 + 628,
						fromPartPostroll: 231,
						toPartPostroll: 0,
						fromPartKeepalive: 628,
					})
				)
			})

			test('high content delay', () => {
				const timings = calculatePartTimings(
					undefined,
					{},
					[],
					{
						inTransition: {
							blockTakeDuration: 0, // unused
							previousPartKeepaliveDuration: 628,
							partContentDelayDuration: 987,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 0,
						toPartDelay: 987,
						fromPartRemaining: 628,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 628,
					})
				)
			})

			test('high content delay postroll', () => {
				const timings = calculatePartTimings(
					undefined,
					{},
					pieceInstancesPostroll,
					{
						inTransition: {
							blockTakeDuration: 0, // unused
							previousPartKeepaliveDuration: 628,
							partContentDelayDuration: 987,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 0,
						toPartDelay: 987,
						fromPartRemaining: 231 + 628,
						fromPartPostroll: 231,
						toPartPostroll: 0,
						fromPartKeepalive: 628,
					})
				)
			})

			test('previous outtransition', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						outTransition: { duration: 200 },
					},
					[],
					{
						inTransition: {
							blockTakeDuration: 0, // unused
							previousPartKeepaliveDuration: 628,
							partContentDelayDuration: 345,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 500 - 345,
						toPartDelay: 500,
						fromPartRemaining: 500 - 345 + 628,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 628,
					})
				)
			})

			test('previous outtransition postroll', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						outTransition: { duration: 200 },
					},
					pieceInstancesPostroll,
					{
						inTransition: {
							blockTakeDuration: 0, // unused
							previousPartKeepaliveDuration: 628,
							partContentDelayDuration: 345,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 500 - 345,
						toPartDelay: 500,
						fromPartRemaining: 231 + 500 - 345 + 628,
						fromPartPostroll: 231,
						toPartPostroll: 0,
						fromPartKeepalive: 628,
					})
				)
			})

			test('previous high outtransition', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						outTransition: { duration: 987 },
					},
					[],
					{
						inTransition: {
							blockTakeDuration: 0, // unused
							previousPartKeepaliveDuration: 628,
							partContentDelayDuration: 345,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 987 - 628,
						toPartDelay: 987 - 628 + 345,
						fromPartRemaining: 987,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 628,
					})
				)
			})

			test('previous high outtransition postroll', () => {
				const timings = calculatePartTimings(
					undefined,
					{
						outTransition: { duration: 987 },
					},
					pieceInstancesPostroll,
					{
						inTransition: {
							blockTakeDuration: 0, // unused
							previousPartKeepaliveDuration: 628,
							partContentDelayDuration: 345,
						},
					},
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 987 - 628,
						toPartDelay: 987 - 628 + 345,
						fromPartRemaining: 231 + 987,
						fromPartPostroll: 231,
						toPartPostroll: 0,
						fromPartKeepalive: 628,
					})
				)
			})
		})
	})
})
