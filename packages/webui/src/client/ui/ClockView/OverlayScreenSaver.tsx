import { useEffect, useRef } from 'react'
import { Clock } from '../StudioScreenSaver/Clock.js'
import { useTracker, useSubscription } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { findNextPlaylist } from '../StudioScreenSaver/StudioScreenSaver.js'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { useSetDocumentClass } from '../util/useSetDocumentClass.js'
import { AnimationPlaybackControls, animate as motionAnimate } from 'motion'

export function OverlayScreenSaver({ studioId }: Readonly<{ studioId: StudioId }>): JSX.Element {
	const studioNameRef = useRef<HTMLDivElement>(null)
	const animationControlsRef = useRef<AnimationPlaybackControls | null>(null)

	useSetDocumentClass('transparent')

	useSubscription(MeteorPubSub.uiStudio, studioId)
	useSubscription(MeteorPubSub.rundownPlaylistForStudio, studioId, false)

	const data = useTracker(() => findNextPlaylist(studioId), [studioId])

	function animate() {
		const el = studioNameRef.current

		if (el) {
			let i = 0
			let position = 0
			const lastPosition = parseFloat(el.dataset.lastPosition || '0') || 0
			const { width } = el.getBoundingClientRect()
			if (width === 0) {
				// abort the animation, as we are still waiting for the element to be filled in
				return
			}

			let parentWidth = 0
			if (el.parentElement) {
				const parentRect = el.parentElement?.getBoundingClientRect()
				parentWidth = parentRect.width
			}

			// try and find a nice random position, thats significanlty different from the last postion
			do {
				position = Math.random() * ((parentWidth * 5) / 6 - width)
			} while (Math.abs(position - lastPosition) < 200 && i++ < 10)
			el.dataset.lastPosition = position.toString()

			el.style.transform = `translate3d(${position}px, 0, 0.2px)`
			el.style.position = 'absolute'
			el.style.left = '0.2em'

			const animation = motionAnimate([
				[el, { opacity: 1 }, { duration: 3, delay: 1 }],
				[el, { opacity: 0 }, { duration: 3, delay: 5 }],
			])
			animation
				.then(() => {
					animate()
				})
				.catch(() => {
					console.error('Unlikely animation failure')
				})
			animationControlsRef.current = animation
		}
	}

	useEffect(() => {
		const el = studioNameRef.current
		if (el && !data?.rundownPlaylist?.name) {
			animate()
		}
		return () => {
			animationControlsRef.current?.stop()

			if (!el) return
			el.style.transform = ''
			el.style.opacity = ''
			el.style.position = ''
			el.style.left = ''
		}
	}, [studioNameRef.current, data?.rundownPlaylist?.name, data?.studio?.name])

	return (
		<div className="clocks-overlay">
			<div className="clocks-lower-third bottom">
				{!data?.rundownPlaylist?.name && (
					<div className="clocks-current-segment-countdown clocks-segment-countdown"></div>
				)}
				<div className="clocks-studio-name" ref={studioNameRef}>
					{data?.studio?.name ?? null}
				</div>
				<div className="clocks-next-rundown">{data?.rundownPlaylist?.name ?? null}</div>
				<Clock className="clocks-time-now" />
			</div>
		</div>
	)
}
