import * as React from 'react'

export function SwitchboardIcon(props: Readonly<React.SVGProps<SVGSVGElement>>): JSX.Element {
	return (
		<svg
			width="35"
			height="25"
			viewBox="0 0 35 25"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="presentation"
			{...props}
		>
			<path
				d="M2 22C2 22.5523 2.44772 23 3 23C3.55228 23 4 22.5523 4 22H2ZM17 3.79167C17 3.23938 16.5523 2.79167 16 2.79167C15.4477 2.79167 15 3.23938 15 3.79167H17ZM4 3C4 2.44772 3.55228 2 3 2C2.44772 2 2 2.44772 2 3H4ZM4 22V18.1042H2V22H4ZM9 13.1042H10V11.1042H9V13.1042ZM17 6.10417V3.79167H15V6.10417H17ZM2 3V12.5H4V3H2ZM2 12.5V18.1042H4V12.5H2ZM10 13.1042C13.866 13.1042 17 9.97016 17 6.10417H15C15 8.86559 12.7614 11.1042 10 11.1042V13.1042ZM4 18.1042C4 15.3427 6.23858 13.1042 9 13.1042V11.1042C5.13401 11.1042 2 14.2382 2 18.1042H4Z"
				fill="#8B8B8B"
			/>
			<path
				d="M16 21.3125C15.4477 21.3125 15 21.7602 15 22.3125C15 22.8648 15.4477 23.3125 16 23.3125V21.3125ZM33 3C33 2.44772 32.5523 2 32 2C31.4477 2 31 2.44772 31 3H33ZM16 23.3125H26V21.3125H16V23.3125ZM33 16.3125V3H31V16.3125H33ZM26 23.3125C29.866 23.3125 33 20.1785 33 16.3125H31C31 19.0739 28.7614 21.3125 26 21.3125V23.3125Z"
				fill="#8B8B8B"
			/>
			<path d="M16 22V3" stroke="#8B8B8B" strokeWidth="2" />
			<circle cx="3" cy="3" r="3" fill="white" />
			<circle cx="16" cy="3" r="3" fill="white" />
			<circle cx="3" cy="22" r="3" fill="white" />
			<circle cx="16" cy="22" r="3" fill="white" />
			<circle cx="32" cy="3" r="3" fill="white" />
		</svg>
	)
}

export function RouteSetOverrideIcon(props: Readonly<React.SVGProps<SVGSVGElement>>): JSX.Element {
	return (
		<svg
			width="28"
			height="28"
			viewBox="0 0 28 28"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
			style={{
				filter: 'drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5))',
			}}
			role="presentation"
		>
			<g clipPath="url(#clip0)">
				<path
					d="M23.63 12.82C23.63 7.39 19.24 3 13.82 3C8.4 3 4 7.39 4 12.82C4 18.25 8.39 22.64 13.82 22.64C19.25 22.64 23.63 18.24 23.63 12.82Z"
					fill="#FFFF00"
				/>
				<path
					d="M15.25 14.28C15.06 14.79 14.34 16.51 13.82 16.51C13.3 16.51 12.58 14.78 12.39 14.28C11.81 12.82 11.33 10.82 11.33 9.17001C11.33 7.20001 12.05 5.10001 13.82 5.10001C15.58 5.10001 16.31 7.20001 16.31 9.17001C16.3 10.82 15.83 12.82 15.25 14.28Z"
					fill="black"
				/>
				<path
					d="M13.82 20.57C13.01 20.57 12.34 19.9 12.34 19.09C12.34 18.28 13.01 17.61 13.82 17.61C14.63 17.61 15.3 18.28 15.3 19.09C15.29 19.91 14.63 20.57 13.82 20.57Z"
					fill="black"
				/>
			</g>
			<defs>
				<clipPath id="clip0">
					<rect width="19.63" height="19.63" fill="white" transform="translate(4 3)" />
				</clipPath>
			</defs>
		</svg>
	)
}
