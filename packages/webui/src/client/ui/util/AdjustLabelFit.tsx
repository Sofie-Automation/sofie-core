import React, { useEffect, useRef, CSSProperties, useLayoutEffect } from 'react'

export interface AdjustLabelFitProps {
	/**
	 * The text label to display and adjust
	 */
	label: string

	/**
	 * The available width for the text in any valid CSS width format (px, vw, %, etc.)
	 * If not specified, it will use the parent container's width
	 */
	width?: string | number

	/**
	 * Optional font family (defaults to the parent element's font)
	 */
	fontFamily?: string

	/**
	 * Initial font size in any valid CSS unit (px, pt, rem, etc.)
	 * Default is inherited from parent
	 */
	fontSize?: string | number

	/**
	 * Default Width of the font
	 */
	defaultWidth?: number

	/**
	 * Default Optical Size of the font
	 */
	defaultOpticalSize?: number

	/**
	 * Minimum font width in percentage relative to normal (for auto-scaling)
	 * Default is 50
	 */
	minFontWidth?: number

	/**
	 * Enable letter spacing adjustment to fit text
	 * Default is false
	 */
	useLetterSpacing?: boolean

	/**
	 * Minimum letter spacing in pixels
	 * Default is -1px
	 */
	minLetterSpacing?: number

	/**
	 * Additional CSS styles for the container
	 */
	containerStyle?: CSSProperties

	/**
	 * Additional CSS styles for the label
	 */
	labelStyle?: CSSProperties

	/**
	 * Additional class name for the container
	 */
	className?: string

	/**
	 * Hard cut length of the text if it doesn't fit
	 * When unset, it will wrap text per letter
	 */
	hardCutText?: boolean
}

/**
 * A component that automatically adjusts text to fit within a specified width
 * using font size scaling, variable font width adjustment, and letter spacing.
 */
export const AdjustLabelFit: React.FC<AdjustLabelFitProps> = ({
	label,
	width,
	fontFamily,
	fontSize,
	minFontWidth = 30,
	defaultOpticalSize = 100,
	defaultWidth = 100,
	useLetterSpacing = false,
	minLetterSpacing = -1,
	containerStyle = {},
	labelStyle = {},
	className = '',
	hardCutText = false,
}) => {
	const labelRef = useRef<HTMLSpanElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const prevLabelRef = useRef<string>(label)

	// If label is longer than 140 characters, cut it off
	if (label.length > 140) {
		label = label.slice(0, 120) + '...'
	}

	// Convert to CSS values:
	const widthValue = typeof width === 'number' ? `${width}px` : width
	const fontSizeValue = typeof fontSize === 'number' ? `${fontSize}px` : fontSize
	const finalContainerStyle: CSSProperties = {
		display: 'block',
		overflow: 'hidden',
		...containerStyle,
		...(widthValue ? { width: widthValue } : {}),
		...(hardCutText ? {} : { wordBreak: 'break-all' }),
	}

	// Label style - add optional font settings
	const finalLabelStyle: CSSProperties = {
		display: 'inline-block',
		...labelStyle,
		...(fontFamily ? { fontFamily } : {}),
		...(fontSizeValue ? { fontSize: fontSizeValue } : {}),
	}

	const resetLabelStyles = () => {
		if (labelRef.current) {
			labelRef.current.style.letterSpacing = '0.05em'
			labelRef.current.style.fontVariationSettings = ''
			labelRef.current.textContent = label
			labelRef.current.style.wordBreak = 'normal'
			labelRef.current.style.whiteSpace = 'nowrap'

			// Remove any child spans if they were added in previous calculations
			while (labelRef.current.firstChild) {
				labelRef.current.removeChild(labelRef.current.firstChild)
			}
		}
	}

	const adjustTextToFit = () => {
		const labelElement = labelRef.current
		const containerElement = containerRef.current

		if (!labelElement || !containerElement) return

		resetLabelStyles()

		// Apply the new width setting
		//labelElement.style.fontVariationSettings = `'opsz' ${defaultOpticalSize}, 'wdth' ${defaultWidth}`
		labelElement.style.fontVariationSettings = `'GRAD' 0, 'XOPQ' 96, 'XTRA' 468, 'YOPQ' 79, 'YTAS' 750, 'YTDE' -203, 'YTFI' 738, 'YTLC' 548, 'YTUC' 712, 'opsz' ${defaultOpticalSize}, 'slnt' 0, 'wdth' ${defaultWidth}, 'wght' 550`

		// Reset label content if it was cut
		labelElement.textContent = label

		// Reset font size to initial value if specified, or to computed style if not
		if (fontSizeValue) {
			labelElement.style.fontSize = fontSizeValue
		} else {
			// Use computed style if no fontSize was specified
			const computedStyle = window.getComputedStyle(labelElement)
			const initialFontSize = computedStyle.fontSize
			labelElement.style.fontSize = initialFontSize
		}

		// Force reflow to ensure measurements are accurate
		void labelElement.offsetWidth

		const containerWidth = containerElement.clientWidth
		const newTextWidth = labelElement.getBoundingClientRect().width

		// If text now fits with font size adjustment alone, we're done
		if (newTextWidth <= containerWidth) return

		const widthRatio = containerWidth / newTextWidth
		let currentWidth = defaultWidth * widthRatio

		// Use a reasonable range for width variation
		currentWidth = Math.max(currentWidth, minFontWidth)

		//labelElement.style.fontVariationSettings = `'opsz' ${defaultOpticalSize}, 'wdth' ${currentWidth}`
		labelElement.style.fontVariationSettings = `'GRAD' 0, 'XOPQ' 96, 'XTRA' 468, 'YOPQ' 79, 'YTAS' 750, 'YTDE' -203, 'YTFI' 738, 'YTLC' 548, 'YTUC' 712, 'opsz' ${defaultOpticalSize}, 'slnt' 0, 'wdth' ${currentWidth}, 'wght' 550`

		// Remeasure text width after adjustment:
		void labelElement.offsetWidth
		const adjustedTextWidth = labelElement.getBoundingClientRect().width

		// Letter spacing if text still overflows
		if (useLetterSpacing && adjustedTextWidth > containerWidth) {
			const overflow = adjustedTextWidth - containerWidth
			const letterCount = label.length - 1 // Spaces between letters
			let letterSpacing = letterCount > 0 ? -overflow / letterCount : 0

			letterSpacing = Math.max(letterSpacing, minLetterSpacing)
			labelElement.style.letterSpacing = `${letterSpacing}px`
		}

		// Hard cut text or wrap per letter:
		if (hardCutText) {
			void labelElement.offsetWidth
			const finalTextWidth = labelElement.getBoundingClientRect().width
			if (finalTextWidth > containerWidth) {
				const ratio = containerWidth / finalTextWidth
				const visibleChars = Math.floor(label.length * ratio) - 1
				labelElement.textContent = label.slice(0, Math.max(visibleChars, 1))
			}
		} else {
			// Apply line wrapping per letter if hardCutText is not set
			void labelElement.offsetWidth
			const finalTextWidth = labelElement.getBoundingClientRect().width
			if (finalTextWidth > containerWidth) {
				labelElement.textContent = ''

				for (let i = 0; i < label.length; i++) {
					const charSpan = document.createElement('span')
					charSpan.textContent = label[i]
					charSpan.style.display = 'inline-block'
					charSpan.style.wordBreak = 'break-all'
					charSpan.style.whiteSpace = 'normal'
					labelElement.appendChild(charSpan)
				}

				// Apply wrapping styles
				labelElement.style.wordBreak = 'break-all'
				labelElement.style.whiteSpace = 'normal'
			}
		}
	}

	// Synchronous layout calculation before paint
	useLayoutEffect(() => {
		// Check if label has changed
		if (prevLabelRef.current !== label) {
			prevLabelRef.current = label
			adjustTextToFit()
		}
	}, [label])

	useEffect(() => {
		// Initial adjustment
		const adjustmentTimer = requestAnimationFrame(() => {
			adjustTextToFit()
		})

		// Add debouncing for resize events
		let resizeTimer: number
		const handleResize = () => {
			cancelAnimationFrame(resizeTimer)
			resizeTimer = requestAnimationFrame(() => {
				adjustTextToFit()
			})
		}

		// Properties change
		const handlePropsChange = () => {
			adjustTextToFit()
		}

		// Adjust on window resize
		window.addEventListener('resize', handleResize)

		// Run adjustment when width or font settings change
		if (width || fontFamily || fontSize || minFontWidth || minLetterSpacing) {
			handlePropsChange()
		}

		return () => {
			window.removeEventListener('resize', handleResize)
			cancelAnimationFrame(adjustmentTimer)
			if (resizeTimer) cancelAnimationFrame(resizeTimer)
		}
	}, [label, width, fontFamily, fontSize, minFontWidth, minLetterSpacing])

	return (
		<div ref={containerRef} className={`adjust-label-fit ${className}`} style={finalContainerStyle}>
			<span ref={labelRef} style={finalLabelStyle}>
				{label}
			</span>
		</div>
	)
}
