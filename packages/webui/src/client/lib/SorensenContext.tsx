import React, { PropsWithChildren, useEffect, useState } from 'react'
import Sorensen from '@sofie-automation/sorensen'
import { catchError } from './lib'

export const SorensenContext = React.createContext<typeof Sorensen | null>(null)

export function preventDefault(e: KeyboardEvent): void {
	e.preventDefault()
}

export const SorensenContextProvider: React.FC<PropsWithChildren<{}>> = function SorensenContextProvider(props) {
	const [initializedSorensen, setInitializedSorensen] = useState<typeof Sorensen | null>(null)
	useEffect(() => {
		Sorensen.init()
			.then(() => {
				setInitializedSorensen(Sorensen)
			})
			.catch(catchError('Sorensen.init'))

		return () => {
			Sorensen.destroy().catch(catchError('Sorensen.destroy'))
		}
	}, [])

	useEffect(() => {
		if (initializedSorensen) {
			// block default system+Chromium F1 behavior (opening help)
			Sorensen.bind('F1', preventDefault, {
				global: true,
			})
			// block default Chromium F3 behavior (opening search)
			Sorensen.bind('F3', preventDefault, {
				global: true,
			})
			// block default Chromium F10 behavior (focus Window Menu)
			Sorensen.bind('F10', preventDefault, {
				global: true,
			})
			// block default Chromium F12 behavior (opening Inspector)
			Sorensen.bind('F12', preventDefault, {
				global: true,
			})
			// block default system Space behavior (scroll page down)
			Sorensen.bind('Space', preventDefault, {
				global: false,
			})
			// block default system Alt behavior (focus Window Menu)
			Sorensen.bind('Alt', preventDefault, {
				global: true,
				up: true,
			})
		}
	}, [initializedSorensen])

	return <SorensenContext.Provider value={initializedSorensen}>{props.children}</SorensenContext.Provider>
}
