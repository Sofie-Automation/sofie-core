import React from 'react'

export const RightArrow = (props: Readonly<React.SVGProps<SVGSVGElement>>): JSX.Element => (
	<svg width="6" height="13" viewBox="0 0 6 13" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<path d="M1.25 2.14003L5.31629 6.5L1.25 10.86L1.25 2.14003Z" fill="black" stroke="white" />
	</svg>
)

export const CenterHandle = (props: Readonly<React.SVGProps<SVGSVGElement>>): JSX.Element => (
	<svg width="9" height="13" viewBox="0 0 9 13" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<line x1="8.5" x2="8.5" y2="13" stroke="black" />
		<line x1="4.5" x2="4.5" y2="13" stroke="black" />
		<line x1="0.5" x2="0.5" y2="13" stroke="black" />
	</svg>
)

export const LeftArrow = (props: Readonly<React.SVGProps<SVGSVGElement>>): JSX.Element => (
	<svg width="6" height="13" viewBox="0 0 6 13" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<path d="M4.75 10.86L0.683707 6.5L4.75 2.14003L4.75 10.86Z" fill="black" stroke="white" />
	</svg>
)

export const SegmentEnd = (props: Readonly<React.SVGProps<SVGSVGElement>>): JSX.Element => (
	<svg width="24" height="22" viewBox="0 0 24 22" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<path
			d="M15.5 1H21C22.1046 1 23 1.89543 23 3V10.9104C23 12.015 22.1046 12.9104 21 12.9104H2M2 12.9104L9.5 5.41045M2 12.9104L9.5 20.4104"
			stroke="white"
			strokeWidth="2"
		/>
	</svg>
)

export const SmallPartFlag = (props: Readonly<React.SVGProps<SVGSVGElement>>): JSX.Element => (
	<svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<path
			d="M16 1L8.02307 1C6.9185 1 6.02307 1.89543 6.02307 3L6.02307 15M6.02307 15L11.0461 10M6.02307 15L1 10"
			stroke="white"
			strokeWidth="2"
		/>
	</svg>
)
