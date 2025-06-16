import { ModifierPhases } from '@popperjs/core'

export const sameWidth = {
	name: 'sameWidth',
	enabled: true,
	phase: 'beforeWrite' as ModifierPhases,
	requires: ['computeStyles'],
	fn: ({ state }: { state: any }): void => {
		const targetWidth = Math.max(208, state.rects.reference.width + 10)
		state.styles.popper.width = `${targetWidth}px`
		state.styles.popper.transform = state.styles.popper.transform + ' translate(4px, 0)'
	},
	effect: ({ state }: { state: any }): void => {
		state.elements.popper.style.width = `${state.elements.reference.offsetWidth + 10}px`
	},
}
