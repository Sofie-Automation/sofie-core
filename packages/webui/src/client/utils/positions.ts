/**
 * Coordinates for an elements upper left corner's position
 */
export interface OffsetPosition {
	top: number
	left: number
}

/**
 * Calculates an element's offset from the document top left. This function replicates jQuery's .offset().
 * Allows null as an argument to be able to operate directly on the result of a document.querySelector
 * call, even if the selector used does not yield a result.
 *
 * @param element - the element to calculate offset for
 * @returns the element's top left corner position relative to the document
 */
export function getElementDocumentOffset(element: Element | null): OffsetPosition | null {
	if (!element) {
		return null
	}

	const { top, left } = element.getBoundingClientRect()

	return {
		top: top + window.scrollY,
		left: left + window.scrollX,
	}
}
