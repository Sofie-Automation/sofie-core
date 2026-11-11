import { IBlueprintPartOutTransitionExclusive, IBlueprintPieceType } from '@sofie-automation/blueprints-integration'
import {} from 'type-fest'
import { RundownHoldState } from '../../dataModel/RundownPlaylist/RundownPlaylist.js'
import { literal } from '../../lib.js'
import {
	calculatePartTimings,
	CalculateTimingsPiece,
	PartCalculatedTimings,
	resolvePartTransition,
	ResolvedPartTransition,
} from '../timings.js'

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
						false,
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
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part', () => {
					const timings = calculatePartTimings(undefined, true, {}, [], {}, pieceInstancesNoPartPreroll)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 0,
							fromPartRemaining: 0,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{},
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
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						false,
						{
							outTransition: { type: 'additive', duration: 289 },
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
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part outDuration postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						false,
						{
							outTransition: { type: 'additive', duration: 289 },
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
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part autoNextOutTransition', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{
							autoNextOutTransition: {
								type: 'exclusive',
								blockTakeDuration: 0,
								partKeepaliveDuration: 452,
								nextPartContentDelayDuration: 0,
							},
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
							transitionSource: 'autoNextOutTransition',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part autoNextOutTransition postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{
							autoNextOutTransition: {
								type: 'exclusive',
								blockTakeDuration: 0,
								partKeepaliveDuration: 452,
								nextPartContentDelayDuration: 0,
							},
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
							transitionSource: 'autoNextOutTransition',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part autoNextOutTransition and outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{
							autoNextOutTransition: {
								type: 'exclusive',
								blockTakeDuration: 0,
								partKeepaliveDuration: 452,
								nextPartContentDelayDuration: 0,
							},
							outTransition: { type: 'additive', duration: 256 },
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
							transitionSource: 'autoNextOutTransition',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part autoNextOutTransition and outDuration and postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{
							autoNextOutTransition: {
								type: 'exclusive',
								blockTakeDuration: 0,
								partKeepaliveDuration: 452,
								nextPartContentDelayDuration: 0,
							},
							outTransition: { type: 'additive', duration: 256 },
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
							transitionSource: 'autoNextOutTransition',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part autoNextOutTransition and larger additive outDuration (ignored)', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{
							autoNextOutTransition: {
								type: 'exclusive',
								blockTakeDuration: 0,
								partKeepaliveDuration: 452,
								nextPartContentDelayDuration: 0,
							},
							outTransition: { type: 'additive', duration: 2256 },
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
							transitionSource: 'autoNextOutTransition',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part autoNextOutTransition and larger additive outDuration (ignored) postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{
							autoNextOutTransition: {
								type: 'exclusive',
								blockTakeDuration: 0,
								partKeepaliveDuration: 452,
								nextPartContentDelayDuration: 0,
							},
							outTransition: { type: 'additive', duration: 2256 },
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
							transitionSource: 'autoNextOutTransition',
							blockTakeDuration: 0,
						})
					)
				})
			})
			describe('500ms preroll', () => {
				test('no previous part', () => {
					const timings = calculatePartTimings(
						undefined,
						false,
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
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part', () => {
					const timings = calculatePartTimings(undefined, false, {}, [], {}, pieceInstances500msPartPreroll)

					expect(timings).toEqual(
						literal<PartCalculatedTimings>({
							inTransitionStart: null,
							toPartDelay: 500,
							fromPartRemaining: 500,
							fromPartPostroll: 0,
							toPartPostroll: 0,
							fromPartKeepalive: 0,
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part and postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						false,
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
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						false,
						{
							outTransition: { type: 'additive', duration: 289 },
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
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part outDuration postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						false,
						{
							outTransition: { type: 'additive', duration: 289 },
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
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part larger outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						false,
						{
							outTransition: { type: 'additive', duration: 823 },
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
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part larger outDuration and postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						false,
						{
							outTransition: { type: 'additive', duration: 823 },
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
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part autoNextOutTransition', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{
							autoNextOutTransition: {
								type: 'exclusive',
								blockTakeDuration: 0,
								partKeepaliveDuration: 452,
								nextPartContentDelayDuration: 0,
							},
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
							transitionSource: 'autoNextOutTransition',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part autoNextOutTransition postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{
							autoNextOutTransition: {
								type: 'exclusive',
								blockTakeDuration: 0,
								partKeepaliveDuration: 452,
								nextPartContentDelayDuration: 0,
							},
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
							transitionSource: 'autoNextOutTransition',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part autoNextOutTransition and outDuration', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{
							autoNextOutTransition: {
								type: 'exclusive',
								blockTakeDuration: 0,
								partKeepaliveDuration: 452,
								nextPartContentDelayDuration: 0,
							},
							outTransition: { type: 'additive', duration: 256 },
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
							transitionSource: 'autoNextOutTransition',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part autoNextOutTransition and outDuration postroll', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{
							autoNextOutTransition: {
								type: 'exclusive',
								blockTakeDuration: 0,
								partKeepaliveDuration: 452,
								nextPartContentDelayDuration: 0,
							},
							outTransition: { type: 'additive', duration: 256 },
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
							transitionSource: 'autoNextOutTransition',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part autoNextOutTransition and larger additive outDuration (ignored)', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{
							autoNextOutTransition: {
								type: 'exclusive',
								blockTakeDuration: 0,
								partKeepaliveDuration: 452,
								nextPartContentDelayDuration: 0,
							},
							outTransition: { type: 'additive', duration: 2256 },
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
							transitionSource: 'autoNextOutTransition',
							blockTakeDuration: 0,
						})
					)
				})

				test('with previous part autoNextOutTransition and larger additive outDuration (ignored) overlap', () => {
					const timings = calculatePartTimings(
						undefined,
						true,
						{
							autoNextOutTransition: {
								type: 'exclusive',
								blockTakeDuration: 0,
								partKeepaliveDuration: 452,
								nextPartContentDelayDuration: 0,
							},
							outTransition: { type: 'additive', duration: 2256 },
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
							transitionSource: 'autoNextOutTransition',
							blockTakeDuration: 0,
						})
					)
				})
			})
		})

		describe('overrule transition', () => {
			test('no previous part', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
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
						transitionSource: 'none',
						blockTakeDuration: 0,
					})
				)
			})

			test('previous autoNextOutTransition', () => {
				const timings = calculatePartTimings(
					undefined,
					true,
					{
						autoNextOutTransition: {
							type: 'exclusive',
							blockTakeDuration: 0,
							partKeepaliveDuration: 452,
							nextPartContentDelayDuration: 0,
						},
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
						transitionSource: 'autoNextOutTransition',
						blockTakeDuration: 0,
					})
				)
			})

			test('previous autoNextOutTransition postroll', () => {
				const timings = calculatePartTimings(
					undefined,
					true,
					{
						autoNextOutTransition: {
							type: 'exclusive',
							blockTakeDuration: 0,
							partKeepaliveDuration: 452,
							nextPartContentDelayDuration: 0,
						},
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
						transitionSource: 'autoNextOutTransition',
						blockTakeDuration: 0,
					})
				)
			})

			test('previous null exclusive outTransition', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
					{
						outTransition: {
							type: 'exclusive',
							blockTakeDuration: 0,
							partKeepaliveDuration: 0,
							nextPartContentDelayDuration: 0,
						},
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
						transitionSource: 'outTransition',
						blockTakeDuration: 0,
					})
				)
			})

			test('previous null exclusive outTransition postroll', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
					{
						outTransition: {
							type: 'exclusive',
							blockTakeDuration: 0,
							partKeepaliveDuration: 0,
							nextPartContentDelayDuration: 0,
						},
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
						transitionSource: 'outTransition',
						blockTakeDuration: 0,
					})
				)
			})

			test('HOLD complete', () => {
				const timings = calculatePartTimings(
					RundownHoldState.COMPLETE,
					false,
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
						transitionSource: 'inTransition',
						blockTakeDuration: 5000,
					})
				)
			})

			test('HOLD pending', () => {
				const timings = calculatePartTimings(
					RundownHoldState.PENDING,
					false,
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
						transitionSource: 'none',
						blockTakeDuration: 0,
					})
				)
			})

			test('HOLD active', () => {
				const timings = calculatePartTimings(
					RundownHoldState.ACTIVE,
					false,
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
						transitionSource: 'none',
						blockTakeDuration: 0,
					})
				)
			})

			describe('HOLD postroll', () => {
				test('HOLD complete', () => {
					const timings = calculatePartTimings(
						RundownHoldState.COMPLETE,
						false,
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
							transitionSource: 'inTransition',
							blockTakeDuration: 5000,
						})
					)
				})

				test('HOLD pending', () => {
					const timings = calculatePartTimings(
						RundownHoldState.PENDING,
						false,
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
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})

				test('HOLD active', () => {
					const timings = calculatePartTimings(
						RundownHoldState.ACTIVE,
						false,
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
							transitionSource: 'none',
							blockTakeDuration: 0,
						})
					)
				})
			})
		})

		describe('with transition', () => {
			test('high preroll', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
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
						transitionSource: 'inTransition',
						blockTakeDuration: 0,
					})
				)
			})

			test('high preroll and postroll', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
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
						transitionSource: 'inTransition',
						blockTakeDuration: 0,
					})
				)
			})

			test('high content delay', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
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
						transitionSource: 'inTransition',
						blockTakeDuration: 0,
					})
				)
			})

			test('high content delay postroll', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
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
						transitionSource: 'inTransition',
						blockTakeDuration: 0,
					})
				)
			})

			test('previous outtransition', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
					{
						outTransition: { type: 'additive', duration: 200 },
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
						transitionSource: 'inTransition',
						blockTakeDuration: 0,
					})
				)
			})

			test('previous outtransition postroll', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
					{
						outTransition: { type: 'additive', duration: 200 },
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
						transitionSource: 'inTransition',
						blockTakeDuration: 0,
					})
				)
			})

			test('previous high outtransition', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
					{
						outTransition: { type: 'additive', duration: 987 },
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
						transitionSource: 'inTransition',
						blockTakeDuration: 0,
					})
				)
			})

			test('previous high outtransition postroll', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
					{
						outTransition: { type: 'additive', duration: 987 },
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
						transitionSource: 'inTransition',
						blockTakeDuration: 0,
					})
				)
			})
		})
		describe('exclusive transitions', () => {
			const inTransition = {
				blockTakeDuration: 5000,
				previousPartKeepaliveDuration: 5000,
				partContentDelayDuration: 1000,
			}
			const exclusiveOutTransition: IBlueprintPartOutTransitionExclusive = {
				type: 'exclusive',
				blockTakeDuration: 1200,
				partKeepaliveDuration: 800,
				nextPartContentDelayDuration: 300,
			}
			const autoNextOutTransition: IBlueprintPartOutTransitionExclusive = {
				type: 'exclusive',
				blockTakeDuration: 100,
				partKeepaliveDuration: 452,
				nextPartContentDelayDuration: 50,
			}

			test('exclusive outTransition overrides inTransition', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
					{ outTransition: exclusiveOutTransition },
					[],
					{ inTransition },
					pieceInstancesNoPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 300,
						fromPartRemaining: 800,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 800,
						transitionSource: 'outTransition',
						blockTakeDuration: 1200,
					})
				)
			})

			test('exclusive outTransition with preroll larger than content delay', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
					{ outTransition: exclusiveOutTransition },
					pieceInstancesPostroll,
					{ inTransition },
					pieceInstances500msPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 231 + 200 + 800,
						fromPartPostroll: 231,
						toPartPostroll: 0,
						fromPartKeepalive: 800,
						transitionSource: 'outTransition',
						blockTakeDuration: 1200,
					})
				)
			})

			test('autoNextOutTransition overrides outTransition and inTransition', () => {
				const timings = calculatePartTimings(
					undefined,
					true,
					{ autoNextOutTransition, outTransition: exclusiveOutTransition },
					[],
					{ inTransition },
					pieceInstancesNoPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 50,
						fromPartRemaining: 452,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 452,
						transitionSource: 'autoNextOutTransition',
						blockTakeDuration: 100,
					})
				)
			})

			test('autoNextOutTransition ignored for a manual take', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
					{ autoNextOutTransition },
					[],
					{ inTransition },
					pieceInstancesNoPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: 0,
						toPartDelay: 1000,
						fromPartRemaining: 5000,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 5000,
						transitionSource: 'inTransition',
						blockTakeDuration: 5000,
					})
				)
			})

			test('manual take uses the outTransition instead of the autoNextOutTransition', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
					{ autoNextOutTransition, outTransition: exclusiveOutTransition },
					[],
					{ inTransition },
					pieceInstancesNoPartPreroll
				)

				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 300,
						fromPartRemaining: 800,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 800,
						transitionSource: 'outTransition',
						blockTakeDuration: 1200,
					})
				)
			})

			test('HOLD active ignores exclusive transitions, but additive duration applies', () => {
				const timings = calculatePartTimings(
					RundownHoldState.ACTIVE,
					true,
					{ autoNextOutTransition, outTransition: { type: 'additive', duration: 289 } },
					[],
					{ inTransition },
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
						transitionSource: 'none',
						blockTakeDuration: 0,
					})
				)
			})

			test('HOLD active ignores exclusive outTransition', () => {
				const timings = calculatePartTimings(
					RundownHoldState.ACTIVE,
					false,
					{ outTransition: exclusiveOutTransition },
					[],
					{ inTransition },
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
						transitionSource: 'none',
						blockTakeDuration: 0,
					})
				)
			})

			test('additive outTransition with disableNextInTransition', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
					{ outTransition: { type: 'additive', duration: 0, disableNextInTransition: true } },
					[],
					{ inTransition },
					pieceInstances500msPartPreroll
				)

				// Same as the old root-level disableNextInTransition
				expect(timings).toEqual(
					literal<PartCalculatedTimings>({
						inTransitionStart: null,
						toPartDelay: 500,
						fromPartRemaining: 500,
						fromPartPostroll: 0,
						toPartPostroll: 0,
						fromPartKeepalive: 0,
						transitionSource: 'none',
						blockTakeDuration: 0,
					})
				)
			})

			test('additive outTransition with disableNextInTransition and larger duration', () => {
				const timings = calculatePartTimings(
					undefined,
					false,
					{ outTransition: { type: 'additive', duration: 823, disableNextInTransition: true } },
					pieceInstancesPostroll,
					{ inTransition },
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
						transitionSource: 'none',
						blockTakeDuration: 0,
					})
				)
			})
		})
	})

	describe('resolvePartTransition', () => {
		const inTransition = {
			blockTakeDuration: 5000,
			previousPartKeepaliveDuration: 4000,
			partContentDelayDuration: 1000,
		}
		const exclusive: IBlueprintPartOutTransitionExclusive = {
			type: 'exclusive',
			blockTakeDuration: 1200,
			partKeepaliveDuration: 800,
			nextPartContentDelayDuration: 300,
		}

		test('no previous part', () => {
			expect(resolvePartTransition(false, false, undefined, { inTransition })).toEqual(
				literal<ResolvedPartTransition>({
					source: 'none',
					keepalive: 0,
					contentDelay: 0,
					blockTakeDuration: 0,
					playInTransitionPiece: false,
					applyAdditiveOutDuration: false,
				})
			)
		})

		test('in hold', () => {
			expect(resolvePartTransition(true, false, { outTransition: exclusive }, { inTransition })).toEqual(
				literal<ResolvedPartTransition>({
					source: 'none',
					keepalive: 0,
					contentDelay: 0,
					blockTakeDuration: 0,
					playInTransitionPiece: false,
					applyAdditiveOutDuration: true,
				})
			)
		})

		test('inTransition', () => {
			expect(
				resolvePartTransition(
					false,
					false,
					{ outTransition: { type: 'additive', duration: 200 } },
					{ inTransition }
				)
			).toEqual(
				literal<ResolvedPartTransition>({
					source: 'inTransition',
					keepalive: 4000,
					contentDelay: 1000,
					blockTakeDuration: 5000,
					playInTransitionPiece: true,
					applyAdditiveOutDuration: true,
				})
			)
		})

		test('exclusive outTransition', () => {
			expect(resolvePartTransition(false, false, { outTransition: exclusive }, { inTransition })).toEqual(
				literal<ResolvedPartTransition>({
					source: 'outTransition',
					keepalive: 800,
					contentDelay: 300,
					blockTakeDuration: 1200,
					playInTransitionPiece: false,
					applyAdditiveOutDuration: false,
				})
			)
		})

		test('autoNextOutTransition', () => {
			expect(
				resolvePartTransition(
					false,
					true,
					{
						autoNextOutTransition: exclusive,
						outTransition: { type: 'additive', duration: 200 },
					},
					{ inTransition }
				)
			).toEqual(
				literal<ResolvedPartTransition>({
					source: 'autoNextOutTransition',
					keepalive: 800,
					contentDelay: 300,
					blockTakeDuration: 1200,
					playInTransitionPiece: false,
					applyAdditiveOutDuration: false,
				})
			)
		})

		test('autoNextOutTransition is not used for a manual take', () => {
			expect(
				resolvePartTransition(
					false,
					false,
					{
						autoNextOutTransition: exclusive,
						outTransition: { type: 'additive', duration: 200 },
					},
					{ inTransition }
				)
			).toEqual(
				literal<ResolvedPartTransition>({
					source: 'inTransition',
					keepalive: 4000,
					contentDelay: 1000,
					blockTakeDuration: 5000,
					playInTransitionPiece: true,
					applyAdditiveOutDuration: true,
				})
			)
		})

		test('additive outTransition disableNextInTransition', () => {
			expect(
				resolvePartTransition(
					false,
					false,
					{ outTransition: { type: 'additive', duration: 200, disableNextInTransition: true } },
					{ inTransition }
				)
			).toEqual(
				literal<ResolvedPartTransition>({
					source: 'none',
					keepalive: 0,
					contentDelay: 0,
					blockTakeDuration: 0,
					playInTransitionPiece: false,
					applyAdditiveOutDuration: true,
				})
			)
		})

		test('no inTransition', () => {
			expect(resolvePartTransition(false, false, {}, {})).toEqual(
				literal<ResolvedPartTransition>({
					source: 'none',
					keepalive: 0,
					contentDelay: 0,
					blockTakeDuration: 0,
					playInTransitionPiece: false,
					applyAdditiveOutDuration: true,
				})
			)
		})
	})
})
