import React from 'react'
import { HTMLMotionProps, motion } from 'motion/react'

export function RundownRightHandButton(props: HTMLMotionProps<'button'>): React.JSX.Element {
	return (
		<motion.button
			{...props}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } }}
			exit={{ opacity: 0, transition: { duration: 0.5, ease: 'easeIn' } }}
		>
			{props.children}
		</motion.button>
	)
}
