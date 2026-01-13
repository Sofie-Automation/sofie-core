import { useCallback, useMemo } from 'react'
import { VTContent } from '@sofie-automation/blueprints-integration'
import { VideoEditMonitor } from './VideoEditMonitor.js'
import { TimecodeEncoder } from './TimecodeEncoder.js'
import { faUndo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Tooltip from 'rc-tooltip'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import { useTranslation } from 'react-i18next'
import { useContentStatusForPiece } from '../SegmentTimeline/withMediaObjectStatus.js'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { PieceId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Pieces } from '../../collections/index.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'

export interface IProps {
	studio: UIStudio

	pieceId: PieceId
	rundownId: RundownId

	inPoint: number
	duration: number
	onChange: (inPoint: number, duration: number) => void

	invalidDuration?: boolean
	minDuration?: number
}

interface IState {
	inPoint: number
	duration: number
	outPoint: number
}

function checkInOutPoints(
	oldState: IState,
	minDurationFrames: number,
	maxDurationFrames: number,
	change: Partial<IState>
): IState {
	if (change.inPoint !== undefined && change.duration !== undefined) {
		if (change.duration < minDurationFrames) {
			if (change.inPoint + minDurationFrames > maxDurationFrames) {
				return {
					...oldState,
					duration: minDurationFrames,
					inPoint: maxDurationFrames - minDurationFrames,
				}
			} else {
				return {
					...oldState,
					duration: minDurationFrames,
					inPoint: change.inPoint,
				}
			}
		}
	} else if (change.duration !== undefined && change.outPoint !== undefined) {
		if (change.duration < minDurationFrames) {
			if (change.outPoint - minDurationFrames < 0) {
				return {
					...oldState,
					duration: minDurationFrames,
					outPoint: minDurationFrames,
				}
			} else {
				return {
					...oldState,
					duration: minDurationFrames,
				}
			}
		}
	}
	return { ...oldState, ...change }
}

export function ClipTrimPanel({
	studio,
	pieceId,
	rundownId,
	inPoint,
	duration,
	onChange,
	invalidDuration,
	minDuration: minDurationMs,
}: IProps): JSX.Element {
	const { t } = useTranslation()

	useSubscription(CorelibPubSub.pieces, [rundownId], null) // TODO: This should filter by pieceId, but that requires a different publication and this panel isnt used

	const piece = useTracker(() => Pieces.findOne(pieceId), [pieceId])

	const frameRate = studio.settings.frameRate || 25

	const contentStatus = useContentStatusForPiece(piece)
	const previewUrl = contentStatus?.previewUrl

	const content = piece?.content as VTContent | undefined
	const maxDurationMs = content?.sourceDuration ?? 0

	const maxDurationFrames = (maxDurationMs * frameRate) / 1000
	const minDurationFrames = ((minDurationMs === undefined ? 1000 : minDurationMs) * frameRate) / 1000

	const state: IState = useMemo(
		() => ({
			inPoint: (inPoint * frameRate) / 1000,
			duration: (duration * frameRate) / 1000,
			outPoint: ((inPoint + duration) * frameRate) / 1000,
		}),
		[inPoint, duration, frameRate]
	)

	const onInChange = useCallback(
		(val: number) => {
			if (val < state.outPoint) {
				const ns = checkInOutPoints(state, minDurationFrames, maxDurationFrames, {
					inPoint: val,
					duration: Math.min(maxDurationFrames - val, Math.max(0, state.outPoint - val)),
				})
				onChange((ns.inPoint / frameRate) * 1000, (ns.duration / frameRate) * 1000)
			} else {
				const inp = Math.max(0, state.outPoint - 1)
				const ns = {
					inPoint: inp,
					duration: Math.min(maxDurationFrames - inp, state.outPoint - inp),
				}
				onChange((ns.inPoint / frameRate) * 1000, (ns.duration / frameRate) * 1000)
			}
		},
		[onChange, minDurationFrames, maxDurationFrames, frameRate]
	)

	const onDurationChange = useCallback(
		(val: number) => {
			val = Math.max(val, minDurationFrames)
			const ns = checkInOutPoints(state, minDurationFrames, maxDurationFrames, {
				duration: Math.min(val, maxDurationFrames),
				outPoint: Math.min(state.inPoint + val, maxDurationFrames),
			})
			onChange(((ns.outPoint - ns.duration) / frameRate) * 1000, (ns.duration / frameRate) * 1000)
		},
		[onChange, minDurationFrames, maxDurationFrames, frameRate]
	)

	const onOutChange = useCallback(
		(val: number) => {
			if (val > state.inPoint) {
				const ns = checkInOutPoints(state, minDurationFrames, maxDurationFrames, {
					outPoint: Math.min(val, maxDurationFrames),
					duration: Math.min(maxDurationFrames - state.inPoint, Math.max(0, val - state.inPoint)),
				})
				onChange(((ns.outPoint - ns.duration) / frameRate) * 1000, (ns.duration / frameRate) * 1000)
			} else {
				const out = state.inPoint + 1
				const ns = checkInOutPoints(state, minDurationFrames, maxDurationFrames, {
					outPoint: Math.min(out, maxDurationFrames),
					duration: Math.min(maxDurationFrames - state.inPoint, out - state.inPoint),
				})
				onChange(((ns.outPoint - ns.duration) / frameRate) * 1000, (ns.duration / frameRate) * 1000)
			}
		},
		[onChange, minDurationFrames, maxDurationFrames, frameRate]
	)

	const onResetIn = useCallback(() => {
		const ns = checkInOutPoints(state, minDurationFrames, maxDurationFrames, {
			inPoint: 0,
			duration: state.duration + state.inPoint,
		})
		onChange((ns.inPoint / frameRate) * 1000, (ns.duration / frameRate) * 1000)
	}, [onChange, minDurationFrames, maxDurationFrames, frameRate])

	const onResetOut = useCallback(() => {
		const ns = checkInOutPoints(state, minDurationFrames, maxDurationFrames, {
			inPoint: state.inPoint,
			duration: maxDurationFrames - state.inPoint,
		})
		onChange((ns.inPoint / frameRate) * 1000, (ns.duration / frameRate) * 1000)
	}, [onChange, minDurationFrames, maxDurationFrames, frameRate])

	const onResetAll = useCallback(() => {
		const ns = checkInOutPoints(state, minDurationFrames, maxDurationFrames, {
			inPoint: 0,
			duration: maxDurationFrames,
		})
		onChange((ns.inPoint / frameRate) * 1000, (ns.duration / frameRate) * 1000)
	}, [onChange, minDurationFrames, maxDurationFrames, frameRate])

	return (
		<div className="clip-trim-panel">
			<div className="clip-trim-panel__monitors">
				<div className="clip-trim-panel__monitors__monitor">
					<VideoEditMonitor
						src={previewUrl}
						fps={frameRate}
						currentTime={state.inPoint / frameRate}
						duration={maxDurationMs / 1000}
						onCurrentTimeChange={(time) => onInChange(time * frameRate)}
					/>
				</div>
				<div className="clip-trim-panel__monitors__monitor">
					<VideoEditMonitor
						src={previewUrl}
						fps={frameRate}
						currentTime={state.outPoint / frameRate}
						duration={maxDurationMs / 1000}
						onCurrentTimeChange={(time) => onOutChange(time * frameRate)}
					/>
				</div>
			</div>
			<div className="clip-trim-panel__timecode-encoders">
				<div className="clip-trim-panel__timecode-encoders__input">
					<Tooltip overlay={t('Remove in-trimming')} placement="top">
						<button className="action-btn clip-trim-panel__timecode-encoders__input__reset" onClick={onResetIn}>
							<FontAwesomeIcon icon={faUndo} />
						</button>
					</Tooltip>
					<label>{t('In')}</label>
					<TimecodeEncoder fps={frameRate} value={state.inPoint} onChange={onInChange} />
				</div>
				<div className="clip-trim-panel__timecode-encoders__input">
					<Tooltip overlay={t('Remove all trimming')} placement="top">
						<button className="action-btn clip-trim-panel__timecode-encoders__input__reset" onClick={onResetAll}>
							<FontAwesomeIcon icon={faUndo} />
						</button>
					</Tooltip>
					<label>{t('Duration')}</label>
					<TimecodeEncoder
						fps={frameRate}
						value={state.duration}
						invalid={invalidDuration}
						onChange={onDurationChange}
					/>
				</div>
				<div className="clip-trim-panel__timecode-encoders__input">
					<Tooltip overlay={t('Remove out-trimming')} placement="top">
						<button className="action-btn clip-trim-panel__timecode-encoders__input__reset" onClick={onResetOut}>
							<FontAwesomeIcon icon={faUndo} />
						</button>
					</Tooltip>
					<label>{t('Out')}</label>
					<TimecodeEncoder fps={frameRate} value={state.outPoint} onChange={onOutChange} />
				</div>
			</div>
		</div>
	)
}
