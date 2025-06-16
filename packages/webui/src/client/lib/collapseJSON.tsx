import classNames from 'classnames'
import { useMemo, useState } from 'react'
import Button from 'react-bootstrap/Button'

/**
 * pretty-prints JSON content, and collapses it if it's too long.
 */
export function CollapseJSON({ json }: { json: string }): JSX.Element {
	const [expanded, setExpanded] = useState(false)

	const originalString = useMemo(() => {
		try {
			const obj = JSON.parse(json)
			let str = JSON.stringify(obj, undefined, 2) // Pretty print JSON

			// If the JSON string is a pretty short one, use a condensed JSON instead:
			if (str.length < 200) {
				str = JSON.stringify(obj) // Condensed JSON
			}
			return str
		} catch (_e) {
			// Ignore parsing error
			return '' + json
		}
	}, [json])

	/** Position of the 5th line in the string, 0 if not found */
	const indexOf5thLine = useMemo(() => {
		let indexOf5thLine: null | number = null
		let foundIndex = 0
		for (let foundCount = 0; foundCount < 10; foundCount++) {
			foundIndex = originalString.indexOf('\n', foundIndex + 1)
			if (foundIndex === -1) {
				break
			} else {
				if (foundCount >= 5) {
					indexOf5thLine = foundIndex
					break
				}
			}
		}
		return indexOf5thLine
	}, [originalString])

	function copyContents() {
		if (!navigator.clipboard) return

		navigator.clipboard.writeText(json).catch((e) => console.error('Unable to copy JSON contents to clipboard', e))
	}

	if (originalString.length < 100 && indexOf5thLine === null) {
		return <pre className="collapse-json__block">{originalString}</pre>
	}

	const displayContents = expanded ? (
		<>
			{originalString}
			<div className="collapse-json__tools">
				<Button
					variant="light"
					size="sm"
					key={'collapse'}
					className="collapse-json__copy"
					tabIndex={0}
					onClick={(e) => {
						e.stopPropagation()
						copyContents()
					}}
				>
					Copy
				</Button>
				<Button
					variant="light"
					size="sm"
					key={'collapse'}
					className="collapse-json__collapser"
					tabIndex={0}
					onClick={(e) => {
						e.stopPropagation()
						setExpanded(false)
					}}
				>
					⮥
				</Button>
			</div>
		</>
	) : (
		<>
			{originalString.substring(0, Math.min(indexOf5thLine || 100, 100))}
			<div className="collapse-json__tools">
				<Button
					variant="light"
					size="sm"
					key={'expand'}
					className="collapse-json__collapser"
					tabIndex={0}
					onClick={(e) => {
						e.stopPropagation()
						setExpanded(true)
					}}
				>
					…
				</Button>
			</div>
		</>
	)

	return (
		<pre
			tabIndex={0}
			className={classNames('collapse-json__block', 'expanding', {
				expanded,
			})}
			onClick={() => {
				// Don't expand when user is selecting text:
				const selection = window.getSelection()
				if (selection?.type != 'Range') {
					setExpanded(!expanded)
				}
			}}
		>
			{displayContents}
		</pre>
	)
}
