export function getSizeClassForLabel(label: string): string {
	if (label.length <= 5) {
		return 'segment-storyboard__thumbnail__label--lg'
	}

	return ''
}
