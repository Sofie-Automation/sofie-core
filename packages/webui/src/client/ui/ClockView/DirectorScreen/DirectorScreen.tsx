import ClassNames from 'classnames'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PartUi } from '../../SegmentTimeline/SegmentTimelineContainer.js'
import { DBRundownPlaylist, ABSessionAssignment } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import {
	useSubscription,
	useSubscriptions,
	useTracker,
	withTracker,
} from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { getCurrentTime } from '../../../lib/systemTime.js'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { PieceIconContainer } from '../ClockViewPieceIcons/ClockViewPieceIcon.js'
import { PieceNameContainer } from '../ClockViewPieceIcons/ClockViewPieceName.js'
import { Timediff } from '../Timediff.js'
import { RundownUtils } from '../../../lib/rundown.js'
import { PieceLifespan, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PieceFreezeContainer } from '../ClockViewPieceIcons/ClockViewFreezeCount.js'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import {
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIShowStyleBases, UIStudios } from '../../Collections.js'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { PieceInstances, RundownPlaylists, Rundowns, ShowStyleVariants } from '../../../collections/index.js'
import { RundownPlaylistCollectionUtil } from '../../../collections/rundownPlaylistUtil.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { useSetDocumentClass } from '../../util/useSetDocumentClass.js'
import { useRundownAndShowStyleIdsForPlaylist } from '../../util/useRundownAndShowStyleIdsForPlaylist.js'
import { RundownPlaylistClientUtil } from '../../../lib/rundownPlaylistUtil.js'
import { CurrentPartOrSegmentRemaining } from '../../RundownView/RundownTiming/CurrentPartOrSegmentRemaining.js'

import { AdjustLabelFit } from '../../util/AdjustLabelFit.js'
import { AutoNextStatus } from '../../RundownView/RundownTiming/AutoNextStatus.js'
import { useTranslation } from 'react-i18next'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance.js'
import { DirectorScreenTop } from './DirectorScreenTop.js'
import { useTiming } from '../../RundownView/RundownTiming/withTiming.js'

interface SegmentUi extends DBSegment {
	items: Array<PartUi>
}

/**
 * Determines whether a piece instance should display its AB resolver channel assignment on the Director screen.
 * Checks piece-level override first, then falls back to show style configuration.
 * Note: Future screens (presenter, camera) will have their own showOn* flags when implemented.
 */
function shouldDisplayAbChannel(
	pieceInstance: PieceInstance,
	showStyleBase: UIShowStyleBase,
	config?: DBShowStyleBase['abChannelDisplay']
): boolean {
	// Check piece-level override first (from blueprint)
	const piece = pieceInstance.piece as any
	if (piece.displayAbChannel !== undefined) {
		return piece.displayAbChannel
	}

	// If no config, use sensible defaults but don't show (screen flag defaults to false)
	const effectiveConfig: NonNullable<DBShowStyleBase['abChannelDisplay']> = config ?? {
		// Default: guess VT and LIVE_SPEAK types
		sourceLayerIds: [],
		sourceLayerTypes: [SourceLayerType.VT, SourceLayerType.LIVE_SPEAK],
		outputLayerIds: [],

		// But don't show by default
		showOnDirectorScreen: false,
	}

	// Check if display is enabled for director screen
	if (!effectiveConfig.showOnDirectorScreen) return false

	const sourceLayer = showStyleBase.sourceLayers?.[pieceInstance.piece.sourceLayerId]

	// Check if output layer filter is specified and doesn't match
	if (effectiveConfig.outputLayerIds.length > 0) {
		if (!effectiveConfig.outputLayerIds.includes(pieceInstance.piece.outputLayerId)) {
			return false
		}
	}

	// Check source layer filters (ID or Type)
	// If both filters are empty, show all pieces (no filtering)
	const hasSourceLayerIdFilter = effectiveConfig.sourceLayerIds.length > 0
	const hasSourceLayerTypeFilter = effectiveConfig.sourceLayerTypes.length > 0

	if (!hasSourceLayerIdFilter && !hasSourceLayerTypeFilter) {
		return true
	}

	// Check if source layer ID is explicitly listed
	if (hasSourceLayerIdFilter && effectiveConfig.sourceLayerIds.includes(pieceInstance.piece.sourceLayerId)) {
		return true
	}

	// Check sourceLayer type match
	if (hasSourceLayerTypeFilter && sourceLayer?.type && effectiveConfig.sourceLayerTypes.includes(sourceLayer.type)) {
		return true
	}

	return false
}

interface TimeMap {
	[key: string]: number
}

interface DirectorScreenProps {
	studioId: StudioId
	playlistId: RundownPlaylistId
	segmentLiveDurations?: TimeMap
}
export interface DirectorScreenTrackedProps {
	studio: UIStudio | undefined
	playlist: DBRundownPlaylist | undefined
	rundowns: Rundown[]
	segments: Array<SegmentUi>
	currentSegment: SegmentUi | undefined
	currentPartInstance: PartUi | undefined
	nextSegment: SegmentUi | undefined
	nextPartInstance: PartUi | undefined
	currentShowStyleBaseId: ShowStyleBaseId | undefined
	currentShowStyleBase: UIShowStyleBase | undefined
	currentShowStyleVariantId: ShowStyleVariantId | undefined
	currentShowStyleVariant: DBShowStyleVariant | undefined
	nextShowStyleBaseId: ShowStyleBaseId | undefined
	showStyleBaseIds: ShowStyleBaseId[]
	rundownIds: RundownId[]
	partInstanceToCountTimeFrom: PartInstance | undefined
}

function getShowStyleBaseIdSegmentPartUi(
	partInstance: PartInstance,
	playlist: DBRundownPlaylist,
	orderedSegmentsAndParts: {
		segments: DBSegment[]
		parts: DBPart[]
	},
	rundownsToShowstyles: Map<RundownId, ShowStyleBaseId>,
	currentPartInstance: PartInstance | undefined,
	nextPartInstance: PartInstance | undefined
): {
	showStyleBaseId: ShowStyleBaseId | undefined
	showStyleBase: UIShowStyleBase | undefined
	showStyleVariantId: ShowStyleVariantId | undefined
	showStyleVariant: DBShowStyleVariant | undefined
	segment: SegmentUi | undefined
	partInstance: PartUi | undefined
} {
	let studioId: StudioId | undefined = undefined
	let showStyleBaseId: ShowStyleBaseId | undefined = undefined
	let studio: UIStudio | undefined = undefined
	let showStyleBase: UIShowStyleBase | undefined = undefined
	let showStyleVariantId: ShowStyleVariantId | undefined = undefined
	let showStyleVariant: DBShowStyleVariant | undefined = undefined
	let segment: SegmentUi | undefined = undefined
	let partInstanceUi: PartUi | undefined = undefined

	const currentRundown = Rundowns.findOne(partInstance.rundownId, {
		fields: {
			_id: 1,
			showStyleBaseId: 1,
			showStyleVariantId: 1,
			name: 1,
			timing: 1,
		},
	})
	studioId = currentRundown?.studioId
	showStyleBaseId = currentRundown?.showStyleBaseId
	showStyleVariantId = currentRundown?.showStyleVariantId

	const segmentIndex = orderedSegmentsAndParts.segments.findIndex((s) => s._id === partInstance.segmentId)
	if (currentRundown && segmentIndex >= 0) {
		const rundownOrder = RundownPlaylistCollectionUtil.getRundownOrderedIDs(playlist)
		const rundownIndex = rundownOrder.indexOf(partInstance.rundownId)
		studio = UIStudios.findOne(studioId)
		showStyleBase = UIShowStyleBases.findOne(showStyleBaseId)
		showStyleVariant = ShowStyleVariants.findOne(showStyleVariantId)

		if (showStyleBase) {
			// This registers a reactive dependency on infinites-capping pieces, so that the segment can be
			// re-evaluated when a piece like that appears.

			const o = RundownUtils.getResolvedSegment(
				showStyleBase,
				studio,
				playlist,
				currentRundown,
				orderedSegmentsAndParts.segments[segmentIndex],
				new Set(orderedSegmentsAndParts.segments.map((s) => s._id).slice(0, segmentIndex)),
				rundownOrder.slice(0, rundownIndex),
				rundownsToShowstyles,
				orderedSegmentsAndParts.parts.map((part) => part._id),
				currentPartInstance,
				nextPartInstance,
				true,
				true
			)

			segment = {
				...o.segmentExtended,
				items: o.parts,
			}

			partInstanceUi = o.parts.find((part) => part.instance._id === partInstance._id)
		}
	}

	return {
		showStyleBaseId: showStyleBaseId,
		showStyleBase,
		showStyleVariantId,
		showStyleVariant,
		segment: segment,
		partInstance: partInstanceUi,
	}
}

const getDirectorScreenReactive = (props: DirectorScreenProps): DirectorScreenTrackedProps => {
	const studio = UIStudios.findOne(props.studioId)

	let playlist: DBRundownPlaylist | undefined

	if (props.playlistId)
		playlist = RundownPlaylists.findOne(props.playlistId, {
			fields: {
				lastIncorrectPartPlaybackReported: 0,
				modified: 0,
				previousPersistentState: 0,
				rundownRanksAreSetInSofie: 0,
				// Note: Do not exclude assignedAbSessions/trackedAbSessions so they stay reactive
				restoredFromSnapshotId: 0,
			},
		})

	const segments: Array<SegmentUi> = []
	let showStyleBaseIds: ShowStyleBaseId[] = []
	let rundowns: Rundown[] = []
	let rundownIds: RundownId[] = []

	let currentSegment: SegmentUi | undefined = undefined
	let currentPartInstanceUi: PartUi | undefined = undefined
	let currentShowStyleBaseId: ShowStyleBaseId | undefined = undefined
	let currentShowStyleBase: UIShowStyleBase | undefined = undefined
	let currentShowStyleVariantId: ShowStyleVariantId | undefined = undefined
	let currentShowStyleVariant: DBShowStyleVariant | undefined = undefined

	let nextSegment: SegmentUi | undefined = undefined
	let nextPartInstanceUi: PartUi | undefined = undefined
	let nextShowStyleBaseId: ShowStyleBaseId | undefined = undefined
	let partInstanceToCountTimeFromUi: PartInstance | undefined = undefined

	if (playlist) {
		rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(playlist)

		const orderedSegmentsAndParts = RundownPlaylistClientUtil.getSegmentsAndPartsSync(playlist)
		rundownIds = rundowns.map((rundown) => rundown._id)
		const rundownsToShowstyles: Map<RundownId, ShowStyleBaseId> = new Map()
		for (const rundown of rundowns) {
			rundownsToShowstyles.set(rundown._id, rundown.showStyleBaseId)
		}

		showStyleBaseIds = rundowns.map((rundown) => rundown.showStyleBaseId)
		const { currentPartInstance, nextPartInstance, partInstanceToCountTimeFrom } =
			RundownPlaylistClientUtil.getSelectedPartInstances(playlist)

		partInstanceToCountTimeFromUi = partInstanceToCountTimeFrom

		const partInstance = currentPartInstance ?? nextPartInstance
		if (partInstance) {
			// This is to register a reactive dependency on Rundown-spanning PieceInstances, that we may miss otherwise.
			PieceInstances.find({
				rundownId: {
					$in: rundownIds,
				},
				dynamicallyInserted: {
					$exists: true,
				},
				'infinite.fromPreviousPart': false,
				'piece.lifespan': {
					$in: [PieceLifespan.OutOnRundownEnd, PieceLifespan.OutOnRundownChange, PieceLifespan.OutOnShowStyleEnd],
				},
				reset: {
					$ne: true,
				},
			}).fetch()

			if (currentPartInstance) {
				const current = getShowStyleBaseIdSegmentPartUi(
					currentPartInstance,
					playlist,
					orderedSegmentsAndParts,
					rundownsToShowstyles,
					currentPartInstance,
					nextPartInstance
				)
				currentSegment = current.segment
				currentPartInstanceUi = current.partInstance
				currentShowStyleBaseId = current.showStyleBaseId
				currentShowStyleBase = current.showStyleBase
				currentShowStyleVariantId = current.showStyleVariantId
				currentShowStyleVariant = current.showStyleVariant
			}

			if (nextPartInstance) {
				const next = getShowStyleBaseIdSegmentPartUi(
					nextPartInstance,
					playlist,
					orderedSegmentsAndParts,
					rundownsToShowstyles,
					currentPartInstance,
					nextPartInstance
				)
				nextSegment = next.segment
				nextPartInstanceUi = next.partInstance
				nextShowStyleBaseId = next.showStyleBaseId
			}
		}
	}

	return {
		studio,
		segments,
		playlist,
		rundowns,
		showStyleBaseIds,
		rundownIds,
		currentSegment,
		currentPartInstance: currentPartInstanceUi,
		currentShowStyleBaseId,
		currentShowStyleBase,
		currentShowStyleVariantId,
		currentShowStyleVariant,
		nextSegment,
		nextPartInstance: nextPartInstanceUi,
		nextShowStyleBaseId,
		partInstanceToCountTimeFrom: partInstanceToCountTimeFromUi,
	}
}

function useDirectorScreenSubscriptions(props: DirectorScreenProps): void {
	useSubscription(MeteorPubSub.uiStudio, props.studioId)

	const playlist = useTracker(
		() =>
			RundownPlaylists.findOne(props.playlistId, {
				fields: {
					_id: 1,
					activationId: 1,
				},
			}) as Pick<DBRundownPlaylist, '_id' | 'activationId'> | undefined,
		[props.playlistId]
	)

	useSubscription(CorelibPubSub.rundownsInPlaylists, playlist ? [playlist._id] : [])

	const { rundownIds, showStyleBaseIds, showStyleVariantIds } = useRundownAndShowStyleIdsForPlaylist(playlist?._id)

	useSubscription(CorelibPubSub.segments, rundownIds, {})
	useSubscription(CorelibPubSub.parts, rundownIds, null)
	useSubscription(MeteorPubSub.uiPartInstances, playlist?.activationId ?? null)
	useSubscriptions(
		MeteorPubSub.uiShowStyleBase,
		showStyleBaseIds.map((id) => [id])
	)
	useSubscription(CorelibPubSub.showStyleVariants, null, showStyleVariantIds)
	useSubscription(MeteorPubSub.rundownLayouts, showStyleBaseIds)

	const {
		currentPartInstance,
		nextPartInstance,
		partInstanceToCountTimeFrom: firstTakenPartInstance,
	} = useTracker(
		() => {
			const playlist = RundownPlaylists.findOne(props.playlistId, {
				fields: {
					_id: 1,
					currentPartInfo: 1,
					nextPartInfo: 1,
					previousPartInfo: 1,
				},
			}) as Pick<DBRundownPlaylist, '_id' | 'currentPartInfo' | 'nextPartInfo' | 'previousPartInfo'> | undefined

			if (playlist) {
				return RundownPlaylistClientUtil.getSelectedPartInstances(playlist)
			} else {
				return {
					currentPartInstance: undefined,
					nextPartInstance: undefined,
					previousPartInstance: undefined,
					partInstanceToCountTimeFrom: undefined,
				}
			}
		},
		[props.playlistId],
		{
			currentPartInstance: undefined,
			nextPartInstance: undefined,
			previousPartInstance: undefined,
			partInstanceToCountTimeFrom: undefined,
		}
	)

	useSubscriptions(CorelibPubSub.pieceInstances, [
		currentPartInstance && [[currentPartInstance.rundownId], [currentPartInstance._id], {}],
		nextPartInstance && [[nextPartInstance.rundownId], [nextPartInstance._id], {}],
		firstTakenPartInstance && [[firstTakenPartInstance.rundownId], [firstTakenPartInstance._id], {}],
	])
}

function DirectorScreenWithSubscription(props: DirectorScreenProps & DirectorScreenTrackedProps): JSX.Element {
	useDirectorScreenSubscriptions(props)

	return <DirectorScreenRender {...props} />
}

function DirectorScreenRender({
	playlist,
	segments,
	currentShowStyleBaseId,
	currentShowStyleBase,
	nextShowStyleBaseId,
	playlistId,
	currentPartInstance,
	currentSegment,
	nextPartInstance,
	nextSegment,
	rundownIds,
	partInstanceToCountTimeFrom,
}: Readonly<DirectorScreenProps & DirectorScreenTrackedProps>) {
	useSetDocumentClass('dark', 'xdark')
	const { t } = useTranslation()

	useTiming()

	// Compute current and next clip player ids (for pieces with AB sessions)
	const currentClipPlayer: string | undefined = useTracker(() => {
		if (!currentPartInstance || !currentShowStyleBase || !playlist?.assignedAbSessions) return undefined
		const config = currentShowStyleBase.abChannelDisplay
		const instances = PieceInstances.find({
			partInstanceId: currentPartInstance.instance._id,
			reset: { $ne: true },
		}).fetch()
		for (const pi of instances) {
			// Use configuration to determine if this piece should display AB channel
			if (!shouldDisplayAbChannel(pi, currentShowStyleBase, config)) continue
			const ab = pi.piece.abSessions
			if (!ab || ab.length === 0) continue
			for (const s of ab) {
				const pool = playlist.assignedAbSessions?.[s.poolName]
				if (!pool) continue
				const matches: ABSessionAssignment[] = []
				for (const key in pool) {
					const a = pool[key]
					if (a && a.sessionName === s.sessionName) matches.push(a)
				}
				const live = matches.find((m) => !m.lookahead)
				const la = matches.find((m) => m.lookahead)
				if (live) return String(live.playerId)
				if (la) return String(la.playerId)
			}
		}
		return undefined
	}, [currentPartInstance?.instance._id, currentShowStyleBase?._id, playlist?.assignedAbSessions])

	const nextClipPlayer: string | undefined = useTracker(() => {
		if (!nextPartInstance || !nextShowStyleBaseId || !playlist?.assignedAbSessions) return undefined
		// We need the ShowStyleBase to resolve sourceLayer types
		const ssb = UIShowStyleBases.findOne(nextShowStyleBaseId)
		if (!ssb) return undefined
		const config = ssb.abChannelDisplay
		const instances = PieceInstances.find({
			partInstanceId: nextPartInstance.instance._id,
			reset: { $ne: true },
		}).fetch()
		for (const pi of instances) {
			// Use configuration to determine if this piece should display AB channel
			if (!shouldDisplayAbChannel(pi, ssb, config)) continue
			const ab = pi.piece.abSessions
			if (!ab || ab.length === 0) continue
			for (const s of ab) {
				const pool = playlist.assignedAbSessions?.[s.poolName]
				if (!pool) continue
				const matches: ABSessionAssignment[] = []
				for (const key in pool) {
					const a = pool[key]
					if (a && a.sessionName === s.sessionName) matches.push(a)
				}
				const live = matches.find((m) => !m.lookahead)
				const la = matches.find((m) => m.lookahead)
				if (live) return String(live.playerId)
				if (la) return String(la.playerId)
			}
		}
		return undefined
	}, [nextPartInstance?.instance._id, nextShowStyleBaseId, playlist?.assignedAbSessions])

	if (playlist && playlistId && segments) {
		const expectedStart = PlaylistTiming.getExpectedStart(playlist.timing) || 0

		// Show countdown if it is the first segment and the current part is untimed:
		const currentSegmentIsFirst = currentSegment?._rank === 0
		const isFirstPieceAndNoDuration =
			(currentSegmentIsFirst && currentPartInstance?.instance.part.untimed) ||
			(currentSegment === undefined && nextPartInstance?.instance.part.untimed)

		// Precompute player icon elements to avoid nested ternaries in JSX
		let currentPlayerEl: JSX.Element | null = null
		if (currentClipPlayer) {
			const pid = String(currentClipPlayer).toUpperCase()
			// Check if it's a single alphanumeric character (0-9, A-Z)
			if (/^[A-Z0-9]$/.test(pid)) {
				currentPlayerEl = (
					<span className="director-screen__body__part__player">
						<img
							className="player-icon"
							src={`/icons/channels/${pid}.svg`}
							alt={t('Server {{id}}', { id: currentClipPlayer })}
						/>
					</span>
				)
			} else {
				currentPlayerEl = (
					<span className="director-screen__body__part__player">
						{t('Server')}: {currentClipPlayer}
					</span>
				)
			}
		}

		let nextPlayerEl: JSX.Element | null = null
		if (nextClipPlayer) {
			const pid = String(nextClipPlayer).toUpperCase()
			// Check if it's a single alphanumeric character (0-9, A-Z)
			if (/^[A-Z0-9]$/.test(pid)) {
				nextPlayerEl = (
					<span className="director-screen__body__part__player">
						<img
							className="player-icon"
							src={`/icons/channels/${pid}.svg`}
							alt={t('Server {{id}}', { id: nextClipPlayer })}
						/>
					</span>
				)
			} else {
				nextPlayerEl = (
					<span className="director-screen__body__part__player">
						{t('Server')}: {nextClipPlayer}
					</span>
				)
			}
		}

		return (
			<div className="director-screen">
				<DirectorScreenTop partInstanceToCountTimeFrom={partInstanceToCountTimeFrom} playlist={playlist} />
				<div className="director-screen__body">
					{
						// Current Part:
					}
					<div className="director-screen__body__part">
						{!isFirstPieceAndNoDuration ? (
							<>
								<div
									className={ClassNames('director-screen__body__segment-name', {
										live: currentSegment !== undefined,
									})}
								>
									<AdjustLabelFit
										label={currentSegment?.name || ''}
										width={'80vw'}
										fontFamily="Roboto Flex"
										fontSize="0.9em"
										minFontWidth={70}
										defaultWidth={100}
										defaultOpticalSize={100}
										useLetterSpacing={false}
										hardCutText={true}
									/>
									{playlist.currentPartInfo?.partInstanceId ? (
										<span className="director-screen__body__segment__countdown">
											<CurrentPartOrSegmentRemaining
												currentPartInstanceId={playlist.currentPartInfo?.partInstanceId || null}
												heavyClassName="overtime"
												preferSegmentTime={true}
											/>
										</span>
									) : null}
								</div>

								{currentPartInstance && currentShowStyleBaseId && (
									<>
										<div className="director-screen__body__part__piece-icon">
											<PieceIconContainer
												partInstanceId={currentPartInstance.instance._id}
												showStyleBaseId={currentShowStyleBaseId}
												rundownIds={rundownIds}
												playlistActivationId={playlist?.activationId}
											/>
										</div>
										<div className="director-screen__body__part__piece-content">
											<div className="director-screen__body__part__piece-name">
												<PieceNameContainer
													partName={currentPartInstance.instance.part.title}
													partInstanceId={currentPartInstance.instance._id}
													showStyleBaseId={currentShowStyleBaseId}
													rundownIds={rundownIds}
													playlistActivationId={playlist?.activationId}
													autowidth={{
														label: '',
														width: '90vw',
														fontFamily: 'Roboto Flex',
														fontSize: '1.5em',
														minFontWidth: 55,
														defaultWidth: 100,
														useLetterSpacing: false,
														defaultOpticalSize: 100,
													}}
												/>
												{currentPlayerEl}
											</div>
											<div className="director-screen__body__part__piece-countdown">
												<CurrentPartOrSegmentRemaining
													currentPartInstanceId={playlist.currentPartInfo?.partInstanceId ?? null}
													heavyClassName="overtime"
												/>
												<span className="auto-next-status">
													<AutoNextStatus />
												</span>{' '}
												<span className="freeze-counter">
													<PieceFreezeContainer
														partInstanceId={currentPartInstance.instance._id}
														showStyleBaseId={currentShowStyleBaseId}
														rundownIds={rundownIds}
														partAutoNext={currentPartInstance.instance.part.autoNext || false}
														partExpectedDuration={calculatePartInstanceExpectedDurationWithTransition(
															currentPartInstance.instance
														)}
														partStartedPlayback={currentPartInstance.instance.timings?.plannedStartedPlayback}
														playlistActivationId={playlist?.activationId}
													/>
												</span>
											</div>
										</div>
									</>
								)}
							</>
						) : expectedStart ? (
							<div className="director-screen__body__part__timeto-content">
								<div className="director-screen__body__part__timeto-countdown">
									<Timediff time={expectedStart - getCurrentTime()} />
								</div>
								<div className="director-screen__body__part__timeto-name">{t('Time to planned start')}</div>
							</div>
						) : null}
					</div>
					{
						// Next Part:
					}
					<div className="director-screen__body__part director-screen__body__part--next-part">
						<div
							className={ClassNames('director-screen__body__segment-name', {
								next: nextSegment !== undefined && nextSegment?._id !== currentSegment?._id,
								notext: nextSegment === undefined || nextSegment?._id === currentSegment?._id,
							})}
						>
							{nextSegment?._id === currentSegment?._id ? undefined : (
								<AdjustLabelFit
									label={nextSegment?.name || ''}
									width={'80vw'}
									fontFamily="Roboto Flex"
									fontSize="0.9em"
									minFontWidth={70}
									defaultWidth={90}
									defaultOpticalSize={100}
									useLetterSpacing={false}
									hardCutText={true}
								/>
							)}
						</div>
						{nextPartInstance && nextShowStyleBaseId ? (
							<>
								{currentPartInstance?.instance.part.autoNext ? (
									<span
										className={ClassNames('director-screen__body__part__auto-icon', {
											'director-screen__body__part__auto-icon--notext':
												nextSegment === undefined || nextSegment?._id === currentSegment?._id,
										})}
									>
										{t('Auto')}
									</span>
								) : (
									<span
										className={ClassNames('director-screen__body__part__next-icon', {
											'director-screen__body__part__next-icon--notext':
												nextSegment === undefined || nextSegment?._id === currentSegment?._id,
										})}
									>
										{t('Next')}
									</span>
								)}
								<div className="director-screen__body__part__piece-icon">
									<PieceIconContainer
										partInstanceId={nextPartInstance.instance._id}
										showStyleBaseId={nextShowStyleBaseId}
										rundownIds={rundownIds}
										playlistActivationId={playlist?.activationId}
									/>
								</div>
								<div className="director-screen__body__part__piece-content">
									<div className="director-screen__body__part__piece-name">
										{nextPartInstance && nextShowStyleBaseId && nextPartInstance.instance.part.title ? (
											<PieceNameContainer
												partName={nextPartInstance.instance.part.title}
												partInstanceId={nextPartInstance.instance._id}
												showStyleBaseId={nextShowStyleBaseId}
												rundownIds={rundownIds}
												playlistActivationId={playlist?.activationId}
												autowidth={{
													label: '',
													width: '90vw',
													fontFamily: 'Roboto Flex',
													fontSize: '1.5em',
													minFontWidth: 55,
													defaultWidth: 100,
													useLetterSpacing: false,
													defaultOpticalSize: 100,
												}}
											/>
										) : (
											'_'
										)}
										{nextPlayerEl}
									</div>
								</div>
							</>
						) : null}
					</div>
				</div>
			</div>
		)
	}
	return null
}

/**
 * This component renders the Director screen for a given playlist
 */
export const DirectorScreen = withTracker<DirectorScreenProps, {}, DirectorScreenTrackedProps>(
	getDirectorScreenReactive
)(DirectorScreenWithSubscription)
