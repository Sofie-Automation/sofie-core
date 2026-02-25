import React, { JSX, useEffect, useRef } from 'react'
import loopAnimation from './icon-loop.json'
import Lottie, { LottieComponentProps, LottieRefCurrentProps } from 'lottie-react'

export function LoopingIcon(props?: Readonly<React.SVGProps<SVGSVGElement>>): JSX.Element {
	return (
		<svg
			version="1.1"
			viewBox="0 0 14.61 12.02"
			width="1em"
			height="1em"
			className="icon looping"
			aria-label="Loop"
			{...props}
		>
			<path
				fill="currentColor"
				d="M0,7.83v1.9A2.3,2.3,0,0,0,2.29,12h10a2.29,2.29,0,0,0,2.28-2.29V5.64a2.28,2.28,0,0,0-2.28-2.28h-1.8l.85.85-.85.85h1.8a.58.58,0,0,1,.58.58V9.73a.59.59,0,0,1-.58.59h-10a.59.59,0,0,1-.59-.59V5.65a.58.58,0,0,1,.59-.59h3.4V8.41L9.9,4.21,5.69,0V3.36H2.29A2.3,2.3,0,0,0,0,5.65Z"
				transform="scale(0.75 0.75) translate(2 1)"
			/>
		</svg>
	)
}

export function LoopingPieceIcon({
	className,
	playing,
}: Readonly<{ className?: string; playing?: boolean }>): JSX.Element {
	const lottieRef = useRef<LottieRefCurrentProps>(null)

	useEffect(() => {
		if (!lottieRef.current) return
		if (playing) {
			lottieRef.current.play()
		} else {
			lottieRef.current.stop()
		}
	}, [playing])

	return (
		<div className={`${className} label-icon label-loop-icon`}>
			<Lottie lottieRef={lottieRef} {...LOOPING_PIECE_ICON} autoplay={playing} />
		</div>
	)
}

const LOOPING_PIECE_ICON: LottieComponentProps = {
	loop: true,
	autoplay: false,
	animationData: loopAnimation,
	rendererSettings: {
		preserveAspectRatio: 'xMidYMid slice',
	},
	style: {
		width: '24px',
		height: '24px',
	},
}
