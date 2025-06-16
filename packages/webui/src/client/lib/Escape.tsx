import React, { useRef, useEffect, PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'

/**
 * Creates DOM element to be used as React root.
 * @returns {HTMLElement}
 */
function createRootElement(id: string) {
	const rootContainer = document.createElement('div')
	rootContainer.setAttribute('id', id)
	return rootContainer
}

/**
 * Appends element as last child of body.
 * @param {HTMLElement} rootElem
 */
function addRootElement(rootElem: HTMLElement) {
	document.body.appendChild(rootElem)
}

/**
 * Hook to create a React Portal.
 * Automatically handles creating and tearing-down the root elements (no SRR
 * makes this trivial), so there is no need to ensure the parent target already
 * exists.
 * @example
 * const target = usePortal(id, [id]);
 * return createPortal(children, target);
 * @param {String} id The id of the target container, e.g 'modal' or 'spotlight'
 * @param {Partial<Record<keyof React.CSSProperties, string>>} style An optional object specifying inline styles to be applied on the portal's root element.
 * @returns {HTMLElement} The DOM node to use as the Portal target.
 */
function usePortal(id: string, style?: Partial<Record<keyof React.CSSProperties, string>>) {
	const rootElemRef = useRef<HTMLElement | null>(null)

	useEffect(
		function setupElement() {
			// Look for existing target dom element to append to
			const existingParent = document.querySelector<HTMLElement>(`#${id}`)
			// Parent is either a new root or the existing dom element
			const parentElem = existingParent || createRootElement(id)

			// If there is no existing DOM element, add a new one.
			if (!existingParent) {
				addRootElement(parentElem)
			}

			// Add the detached element to the parent
			if (rootElemRef.current) {
				parentElem.appendChild(rootElemRef.current)
			}

			return function removeElement() {
				rootElemRef.current?.remove()
				if (!parentElem.childElementCount) {
					parentElem.remove()
				}
			}
		},
		[id]
	)

	/**
	 * It's important we evaluate this lazily:
	 * - We need first render to contain the DOM element, so it shouldn't happen
	 *   in useEffect. We would normally put this in the constructor().
	 * - We can't do 'const rootElemRef = useRef(document.createElement('div))',
	 *   since this will run every single render (that's a lot).
	 * - We want the ref to consistently point to the same DOM element and only
	 *   ever run once.
	 * @link https://reactjs.org/docs/hooks-faq.html#how-to-create-expensive-objects-lazily
	 */
	function getRootElem() {
		if (!rootElemRef.current) {
			const el = document.createElement('div')
			if (style) {
				for (const [prop, value] of Object.entries<string>(style)) {
					el.style[prop as any] = value
				}
			}

			rootElemRef.current = el
		}
		return rootElemRef.current
	}

	return getRootElem()
}

export default function Escape({ to, children }: PropsWithChildren<{ to: 'viewport' | 'document' }>): JSX.Element {
	const portalContainer = usePortal(`escape-${to}`, {
		position: to === 'viewport' ? 'fixed' : 'absolute',
		left: '0',
		top: '0',
		right: '0',
		bottom: '0',
		zIndex: '10001',
		pointerEvents: 'none',
		overflow: 'visible',
	})

	return createPortal(children, portalContainer)
}
