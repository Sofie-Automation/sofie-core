import React from 'react'
import { HTMLMotionProps, motion } from 'motion/react'

export function PopUpPanel(props: HTMLMotionProps<'div'>): React.JSX.Element {
	return (
		<motion.div
			{...props}
			initial={{ translateX: '100%' }}
			animate={{ translateX: '0%', transition: { duration: 0.3, ease: 'easeOut' } }}
			exit={{ translateX: '100%', transition: { duration: 0.5, ease: 'easeIn' } }}
		>
			{props.children}
		</motion.div>
	)
}
