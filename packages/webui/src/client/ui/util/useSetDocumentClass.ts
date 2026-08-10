import { useEffect, useRef, useLayoutEffect } from 'react'

/**
 * Adds the provided classes to `document.body` upon mount, and removes them when unmounted
 * @param classNames Classnames to add
 */
export function useSetDocumentClass(...classNames: string[]): void {
	useLayoutEffect(() => {
		document.body.classList.add(...classNames)

		return () => {
			document.body.classList.remove(...classNames)
		}
	}, [JSON.stringify(classNames)])
}

export function useSetDocumentDarkTheme(): void {
	useLayoutEffect(() => {
		document.body.setAttribute('data-bs-theme', 'dark')

		return () => {
			document.body.removeAttribute('data-bs-theme')
		}
	}, [])
}

/**
 * Removes a class from an element on mount and adds it back on unmount,
 * but only if this hook instance removed it.
 */
export function useOwnedElementClassToggle(selector: string, className: string, removeOnMount = true): void {
	const removedByHookRef = useRef(false)
	const ownedElementRef = useRef<HTMLElement | null>(null)

	useEffect(() => {
		removedByHookRef.current = false
		ownedElementRef.current = null

		const element = document.querySelector(selector)
		if (element instanceof HTMLElement && element.isConnected && removeOnMount) {
			removedByHookRef.current = element.classList.contains(className)
			if (removedByHookRef.current) {
				element.classList.remove(className)
				ownedElementRef.current = element
			}
		}

		return () => {
			const ownedElement = ownedElementRef.current
			if (removedByHookRef.current && ownedElement && ownedElement.isConnected) {
				ownedElement.classList.add(className)
			}

			removedByHookRef.current = false
			ownedElementRef.current = null
		}
	}, [selector, className, removeOnMount])
}
